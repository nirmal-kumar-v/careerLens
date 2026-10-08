const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');
const StudentProfile = require('../models/StudentProfile');
const Analysis = require('../models/Analysis');
const { extractResumeData } = require('../services/extractors/resumeExtractor');
const { extractGithubData } = require('../services/extractors/githubExtractor');
const { extractPortfolioData } = require('../services/extractors/portfolioExtractor');
const { extractLeetcodeData } = require('../services/extractors/leetcodeExtractor');
const { extractGfgData } = require('../services/extractors/gfgExtractor');
const { extractLinkedinData } = require('../services/extractors/linkedinExtractor');
const { extractFigmaData } = require('../services/extractors/figmaExtractor');
const { normalizeEvidence } = require('../services/evidenceNormalizer');
const { evaluateStudent } = require('../services/aiEvaluator');
const { memoryProfiles, memoryAnalyses, saveMemoryDb } = require('../services/userStore');
const { syncAnalysisToPg, syncProfileToPg, findInPg, listInPg } = require('../services/dbService');
const { getMongoStatus } = require('../config/mongodb');
const { getPgStatus } = require('../config/postgresql');

const router = express.Router();

router.use(authenticate);
router.use(authorize('student'));

/**
 * Trigger a fresh analysis for the logged‑in student.
 * Steps:
 *   1. Load student profile (resume path + URLs)
 *   2. Run each extractor (resume, github, optional sources)
 *   3. Normalize evidence
 *   4. Call Gemini evaluator
 *   5. Store result in MongoDB and sync to PostgreSQL
 */
router.post('/run', async (req, res) => {
  try {
    let profile;
    const pgProfile = getPgStatus()
      ? await findInPg('student_profiles', { user_id: req.user._id.toString() })
      : null;
    const mongoProfile = getMongoStatus()
      ? await StudentProfile.findOne({ userId: req.user._id })
      : null;
    const memProfile = memoryProfiles.find(p => p.userId?.toString() === req.user._id?.toString());

    if (pgProfile) {
      profile = {
        resumePath: pgProfile.resume_path || mongoProfile?.resumePath || memProfile?.resumePath,
        githubUrl: pgProfile.github_url || mongoProfile?.githubUrl || memProfile?.githubUrl,
        portfolioUrl: pgProfile.portfolio_url || mongoProfile?.portfolioUrl || memProfile?.portfolioUrl,
        leetcodeUrl: pgProfile.leetcode_url || mongoProfile?.leetcodeUrl || memProfile?.leetcodeUrl,
        gfgUrl: pgProfile.gfg_url || mongoProfile?.gfgUrl || memProfile?.gfgUrl,
        linkedinUrl: pgProfile.linkedin_url || mongoProfile?.linkedinUrl || memProfile?.linkedinUrl,
        figmaUrl: pgProfile.figma_url || mongoProfile?.figmaUrl || memProfile?.figmaUrl,
        linkedinPdfPath: pgProfile.linkedin_pdf_path || mongoProfile?.linkedinPdfPath || memProfile?.linkedinPdfPath,
        targetRole: pgProfile.target_role || mongoProfile?.targetRole || memProfile?.targetRole
      };
      if (getMongoStatus() && mongoProfile && (!pgProfile.resume_path || !pgProfile.github_url)) {
        await syncProfileToPg(mongoProfile);
      }
    } else if (mongoProfile) {
      profile = mongoProfile;
      if (getPgStatus()) await syncProfileToPg(mongoProfile);
    } else if (memProfile) {
      profile = memProfile;
    }
    if (!profile) return res.status(400).json({ error: 'Student profile not found' });

    // Validate mandatory sources
    if (!profile.resumePath) {
      return res.status(400).json({ error: 'Resume not uploaded yet' });
    }
    if (!profile.githubUrl) {
      return res.status(400).json({ error: 'GitHub profile URL required' });
    }

    // Fetch previous analysis to check for reusable extractions
    let previousExtractedData = null;
    if (getPgStatus()) {
      const pgAnalyses = await listInPg('analyses', { student_id: req.user._id.toString() });
      if (pgAnalyses && pgAnalyses.length > 0) {
        const rawAnalysisData = pgAnalyses[0].analysis_data;
        if (typeof rawAnalysisData === 'string') {
          try {
            previousExtractedData = JSON.parse(rawAnalysisData);
          } catch (e) {
            previousExtractedData = null;
          }
        } else if (rawAnalysisData && typeof rawAnalysisData === 'object') {
          previousExtractedData = rawAnalysisData;
        }
      }
    }
    if (!previousExtractedData && getMongoStatus()) {
      const mongoAnalysis = await Analysis.findOne({ studentId: req.user._id }).sort({ createdAt: -1 });
      if (mongoAnalysis && mongoAnalysis.extractedData) {
        previousExtractedData = typeof mongoAnalysis.extractedData.toObject === 'function'
          ? mongoAnalysis.extractedData.toObject()
          : mongoAnalysis.extractedData;
      }
    }
    if (!previousExtractedData) {
      const memAnalysis = memoryAnalyses.find(a => a.studentId?.toString() === req.user._id?.toString());
      if (memAnalysis && memAnalysis.extractedData) {
        previousExtractedData = memAnalysis.extractedData;
      }
    }

    const prevResume = previousExtractedData?.resume;
    const isExplicitRefresh = Boolean(
      req.body?.refreshResume ||
      req.body?.forceRefresh ||
      req.body?.forceRefreshResume ||
      req.query?.refreshResume ||
      req.query?.forceRefresh
    );

    let currentResumeHash = null;
    const resolvedResumePath = profile.resumePath ? path.resolve(profile.resumePath) : null;
    if (resolvedResumePath && fs.existsSync(resolvedResumePath)) {
      try {
        const fileBuffer = fs.readFileSync(resolvedResumePath);
        currentResumeHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } catch (err) {
        // Suppress buffer reading error in debug log
      }
    }

    const existingResumeExtractionFound = Boolean(
      prevResume &&
      !prevResume.error &&
      (prevResume.rawText || (Array.isArray(prevResume.skills) && prevResume.skills.length > 0) || prevResume.personal)
    );

    let resumeChanged = false;
    if (!existingResumeExtractionFound) {
      resumeChanged = true;
    } else if (isExplicitRefresh) {
      resumeChanged = true;
    } else if (prevResume.resumeHash && currentResumeHash) {
      resumeChanged = prevResume.resumeHash !== currentResumeHash;
    } else if (prevResume.resumePath && profile.resumePath && prevResume.resumePath !== profile.resumePath) {
      resumeChanged = true;
    } else {
      resumeChanged = false;
    }

    const reusingStoredResume = existingResumeExtractionFound && !resumeChanged && !isExplicitRefresh;
    const callingResumeAiExtraction = !reusingStoredResume;

    console.log(`[ANALYSIS] Existing resume extraction found: ${existingResumeExtractionFound}`);
    console.log(`[ANALYSIS] Resume changed: ${resumeChanged}`);
    console.log(`[ANALYSIS] Reusing stored resume extraction: ${reusingStoredResume}`);
    console.log(`[ANALYSIS] Calling resume AI extraction: ${callingResumeAiExtraction}`);

    // Extraction
    const extracted = {};

    if (reusingStoredResume) {
      extracted.resume = {
        ...prevResume,
        resumeHash: currentResumeHash || prevResume.resumeHash,
        resumePath: profile.resumePath
      };
    } else {
      try {
        const freshResume = await extractResumeData(profile.resumePath);
        extracted.resume = {
          ...freshResume,
          resumeHash: currentResumeHash,
          resumePath: profile.resumePath
        };
      } catch (e) {
        extracted.resume = { error: e.message };
      }
    }

    const prevGithub = previousExtractedData?.github;
    const isGithubSame = Boolean(
      prevGithub &&
      !prevGithub.error &&
      !isExplicitRefresh &&
      (prevGithub.profileUrl === profile.githubUrl || !prevGithub.profileUrl)
    );
    if (isGithubSame) {
      extracted.github = prevGithub;
    } else {
      try {
        extracted.github = await extractGithubData(profile.githubUrl);
        if (extracted.github && !extracted.github.error) {
          extracted.github.profileUrl = profile.githubUrl;
        }
      } catch (e) {
        extracted.github = { error: e.message };
      }
    }

    const requiredSourceErrors = ['resume', 'github']
      .filter(source => extracted[source]?.error)
      .reduce((errors, source) => ({ ...errors, [source]: extracted[source].error }), {});
    if (Object.keys(requiredSourceErrors).length) {
      return res.status(422).json({
        error: 'Could not analyze the required resume and GitHub evidence',
        sourceErrors: requiredSourceErrors
      });
    }

    if (profile.portfolioUrl) {
      const prevPortfolio = previousExtractedData?.portfolio;
      const isPortfolioSame = Boolean(
        prevPortfolio &&
        !prevPortfolio.error &&
        !isExplicitRefresh &&
        (prevPortfolio.sourceUrl === profile.portfolioUrl || !prevPortfolio.sourceUrl)
      );
      if (isPortfolioSame) {
        extracted.portfolio = prevPortfolio;
      } else {
        try {
          extracted.portfolio = await extractPortfolioData(profile.portfolioUrl);
          if (extracted.portfolio && !extracted.portfolio.error) {
            extracted.portfolio.sourceUrl = profile.portfolioUrl;
          }
        } catch (e) {
          extracted.portfolio = { error: e.message };
        }
      }
    }

    if (profile.leetcodeUrl) {
      const prevLeetcode = previousExtractedData?.leetcode;
      const isLeetcodeSame = Boolean(
        prevLeetcode &&
        !prevLeetcode.error &&
        !isExplicitRefresh &&
        (prevLeetcode.sourceUrl === profile.leetcodeUrl || !prevLeetcode.sourceUrl)
      );
      if (isLeetcodeSame) {
        extracted.leetcode = prevLeetcode;
      } else {
        try {
          extracted.leetcode = await extractLeetcodeData(profile.leetcodeUrl);
          if (extracted.leetcode && !extracted.leetcode.error) {
            extracted.leetcode.sourceUrl = profile.leetcodeUrl;
          }
        } catch (e) {
          extracted.leetcode = { error: e.message };
        }
      }
    }

    if (profile.gfgUrl) {
      const prevGfg = previousExtractedData?.gfg;
      const isGfgSame = Boolean(
        prevGfg &&
        !prevGfg.error &&
        !isExplicitRefresh &&
        (prevGfg.sourceUrl === profile.gfgUrl || !prevGfg.sourceUrl)
      );
      if (isGfgSame) {
        extracted.gfg = prevGfg;
      } else {
        try {
          extracted.gfg = await extractGfgData(profile.gfgUrl);
          if (extracted.gfg && !extracted.gfg.error) {
            extracted.gfg.sourceUrl = profile.gfgUrl;
          }
        } catch (e) {
          extracted.gfg = { error: e.message };
        }
      }
    }

    if (profile.linkedinUrl || profile.linkedinPdfPath) {
      const prevLinkedin = previousExtractedData?.linkedin;
      const isLinkedinSame = Boolean(
        prevLinkedin &&
        !prevLinkedin.error &&
        prevLinkedin.extracted !== false &&
        !isExplicitRefresh &&
        (prevLinkedin.sourceUrl === profile.linkedinUrl || !prevLinkedin.sourceUrl) &&
        (prevLinkedin.pdfPath === profile.linkedinPdfPath || !prevLinkedin.pdfPath)
      );
      if (isLinkedinSame) {
        extracted.linkedin = prevLinkedin;
      } else {
        try {
          extracted.linkedin = await extractLinkedinData({
            url: profile.linkedinUrl,
            pdfPath: profile.linkedinPdfPath
          });
          if (extracted.linkedin && !extracted.linkedin.error) {
            extracted.linkedin.sourceUrl = profile.linkedinUrl;
            extracted.linkedin.pdfPath = profile.linkedinPdfPath;
          }
        } catch (e) {
          extracted.linkedin = { error: e.message, extracted: false };
        }
      }
    }

    if (profile.figmaUrl) {
      const prevFigma = previousExtractedData?.figma;
      const isFigmaSame = Boolean(
        prevFigma &&
        !prevFigma.error &&
        !isExplicitRefresh &&
        (prevFigma.sourceUrl === profile.figmaUrl || !prevFigma.sourceUrl)
      );
      if (isFigmaSame) {
        extracted.figma = prevFigma;
      } else {
        try {
          extracted.figma = await extractFigmaData(profile.figmaUrl);
          if (extracted.figma && !extracted.figma.error) {
            extracted.figma.sourceUrl = profile.figmaUrl;
          }
        } catch (e) {
          extracted.figma = { error: e.message };
        }
      }
    }

    // Normalization & Source-Specific Plain Text Separation
    const structuredEvidence = normalizeEvidence(extracted);
    const { normalizeAllSourceTexts } = require('../services/sourceTextNormalizer');
    const sourceTexts = normalizeAllSourceTexts(extracted);

    // AI evaluation with clearly separated source texts
    const evaluation = await evaluateStudent(structuredEvidence, profile.targetRole, extracted, sourceTexts);

    // Store analysis document with preserved extraction objects and source-specific texts
    const analysisFields = {
      studentId: req.user._id,
      status: 'complete',
      extractedData: extracted,
      sourceTexts: evaluation.sourceTexts || sourceTexts,
      structuredEvidence,
      claimValidation: evaluation.claimValidation,
      scores: evaluation.scores,
      roleAnalysis: evaluation.roleAnalysis,
      recommendations: evaluation.recommendations,
      roadmap: evaluation.roadmap,
      overallProfile: evaluation.overallProfile,
      alreadyStrongIn: evaluation.alreadyStrongIn,
      scoreExplanation: evaluation.scoreExplanation,
      nextBestAction: evaluation.nextBestAction,
      personSpecificGaps: evaluation.personSpecificGaps,
      learningRecommendations: evaluation.learningRecommendations,
      roadmapMilestones: evaluation.roadmapMilestones,
      finalLearningSummary: evaluation.finalLearningSummary,
      recommendationObject: evaluation.recommendationObject,
      skillAnalysis: evaluation.skillAnalysis,
      projectAnalysis: evaluation.projectAnalysis,
      codingAnalysis: evaluation.codingAnalysis,
      crossSourceConsistencyData: evaluation.crossSourceConsistencyData,
      bestFitRoles: evaluation.bestFitRoles
    };
    const analysisDoc = getMongoStatus()
      ? new Analysis(analysisFields)
      : { _id: crypto.randomUUID(), ...analysisFields, createdAt: new Date(), updatedAt: new Date() };
    await syncAnalysisToPg(analysisDoc);
    if (getMongoStatus()) {
      await analysisDoc.save();
    } else {
      const idx = memoryAnalyses.findIndex(a => a.studentId?.toString() === req.user._id?.toString());
      if (idx !== -1) memoryAnalyses[idx] = analysisDoc;
      else memoryAnalyses.push(analysisDoc);
      saveMemoryDb();
    }

    res.json({ message: 'Analysis completed', analysisId: analysisDoc._id, evaluation, sourceTexts: analysisFields.sourceTexts, extractedData: extracted });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

module.exports = router;
