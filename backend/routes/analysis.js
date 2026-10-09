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

const { uploadProofFlexible } = require('../middleware/upload');
const { extractFileProof, extractUrlProof } = require('../services/proofExtractor');
const { reEvaluateWithProof } = require('../services/proofReEvaluator');
const { verifyAllEvidenceIntegrity } = require('../services/evidenceIntegrity');

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
        prevGfg.extracted !== false &&
        !isExplicitRefresh &&
        prevGfg.sourceUrl === profile.gfgUrl
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
          extracted.gfg = { error: e.message, extracted: false };
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
        (profile.linkedinUrl ? prevLinkedin.sourceUrl === profile.linkedinUrl : !prevLinkedin.sourceUrl) &&
        (profile.linkedinPdfPath ? prevLinkedin.pdfPath === profile.linkedinPdfPath : !prevLinkedin.pdfPath)
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

    // Evidence Integrity & Verification Layer
    try {
      const { integrityReport } = await verifyAllEvidenceIntegrity(extracted, profile.resumePath);
      extracted.integrityReport = integrityReport;
    } catch (integrityErr) {
      console.warn('[Analysis] Evidence integrity check warning:', integrityErr.message);
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

/**
 * Add claim-level proof, extract evidence, re-evaluate with AI, and update report.
 */
router.post('/add-proof', (req, res) => {
  uploadProofFlexible(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }

    try {
      const claim = req.body.claim || req.query.claim;
      if (!claim || !claim.trim()) {
        return res.status(400).json({ error: 'Claim name is required for proof submission' });
      }

      const rawUrl = req.body.url || req.body.sourceUrl || req.body.proofUrl || req.body.websiteUrl;
      const uploadedFiles = req.files && req.files.length > 0
        ? req.files
        : (req.file ? [req.file] : []);

      if (!rawUrl && uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'Please upload a proof file or provide a valid website URL' });
      }

      // 1. Fetch previous analysis (Postgres -> Mongo -> Memory)
      let previousAnalysis = null;
      let previousExtractedData = null;

      if (getPgStatus()) {
        const pgAnalyses = await listInPg('analyses', { student_id: req.user._id.toString() });
        if (pgAnalyses && pgAnalyses.length > 0) {
          const row = pgAnalyses[0];
          const rawAnalysisData = row.analysis_data;
          let parsedData = {};
          if (typeof rawAnalysisData === 'string') {
            try { parsedData = JSON.parse(rawAnalysisData); } catch (e) { parsedData = {}; }
          } else if (rawAnalysisData && typeof rawAnalysisData === 'object') {
            parsedData = rawAnalysisData;
          }

          let parsedClaims = [];
          if (typeof row.claim_validation === 'string') {
            try { parsedClaims = JSON.parse(row.claim_validation); } catch (e) { parsedClaims = []; }
          } else if (Array.isArray(row.claim_validation)) {
            parsedClaims = row.claim_validation;
          }

          let parsedScores = {};
          if (typeof row.scores === 'string') {
            try { parsedScores = JSON.parse(row.scores); } catch (e) { parsedScores = {}; }
          } else if (row.scores && typeof row.scores === 'object') {
            parsedScores = row.scores;
          }

          let parsedRole = {};
          if (typeof row.role_analysis === 'string') {
            try { parsedRole = JSON.parse(row.role_analysis); } catch (e) { parsedRole = {}; }
          } else if (row.role_analysis && typeof row.role_analysis === 'object') {
            parsedRole = row.role_analysis;
          }

          let parsedRecs = {};
          if (typeof row.recommendations === 'string') {
            try { parsedRecs = JSON.parse(row.recommendations); } catch (e) { parsedRecs = {}; }
          } else if (row.recommendations && typeof row.recommendations === 'object') {
            parsedRecs = row.recommendations;
          }

          previousExtractedData = parsedData;
          previousAnalysis = {
            _id: row.mongo_id || String(row.id),
            studentId: row.student_id,
            status: row.status,
            extractedData: parsedData,
            claimValidation: parsedClaims,
            scores: parsedScores,
            roleAnalysis: parsedRole,
            recommendations: parsedRecs,
            personSpecificGaps: parsedRecs.personSpecificGaps || parsedData.personSpecificGaps || [],
            learningRecommendations: parsedRecs.learningRecommendations || parsedData.learningRecommendations || [],
            roadmapMilestones: parsedRecs.roadmapMilestones || parsedData.roadmapMilestones || [],
            finalLearningSummary: parsedRecs.finalLearningSummary || parsedData.finalLearningSummary || {},
            overallProfile: parsedRecs.overallProfile || parsedData.overallProfile || '',
            scoreExplanation: parsedRecs.scoreExplanation || parsedData.scoreExplanation || '',
            strengths: parsedRole.strengths || [],
            gaps: parsedRole.gaps || []
          };
        }
      }

      if (!previousAnalysis && getMongoStatus()) {
        const mongoAnalysis = await Analysis.findOne({ studentId: req.user._id }).sort({ createdAt: -1 });
        if (mongoAnalysis) {
          previousAnalysis = typeof mongoAnalysis.toObject === 'function' ? mongoAnalysis.toObject() : mongoAnalysis;
          previousExtractedData = previousAnalysis.extractedData || {};
        }
      }

      if (!previousAnalysis) {
        const memAnalysis = memoryAnalyses.find(a => a.studentId?.toString() === req.user._id?.toString());
        if (memAnalysis) {
          previousAnalysis = memAnalysis;
          previousExtractedData = memAnalysis.extractedData || {};
        }
      }

      if (!previousAnalysis) {
        return res.status(400).json({ error: 'No previous analysis found. Please run an initial analysis first before adding proof.' });
      }

      // 2. Extract new proof items
      const proofItems = [];

      for (const file of uploadedFiles) {
        try {
          const fileProof = await extractFileProof(file, claim.trim());
          proofItems.push(fileProof);
        } catch (fileErr) {
          console.warn('[AddProof] File extract warning:', fileErr.message);
          return res.status(422).json({ error: `File extraction failed: ${fileErr.message}` });
        }
      }

      if (rawUrl && rawUrl.trim()) {
        try {
          const urlProof = await extractUrlProof(rawUrl.trim(), claim.trim());
          proofItems.push(urlProof);
        } catch (urlErr) {
          console.warn('[AddProof] URL extract warning:', urlErr.message);
          return res.status(422).json({ error: `URL extraction failed: ${urlErr.message}` });
        }
      }

      if (proofItems.length === 0) {
        return res.status(422).json({ error: 'Could not extract readable proof content. Please check the file or URL provided.' });
      }

      // 3. Combine with original sources and preserve USER-PROVIDED PROOF separation
      const updatedExtractedData = {
        ...(previousExtractedData || {}),
        userProvidedProofs: [
          ...(Array.isArray(previousExtractedData?.userProvidedProofs) ? previousExtractedData.userProvidedProofs : []),
          ...proofItems
        ]
      };

      // 4. Fetch target role
      let targetRole = previousAnalysis.roleAnalysis?.targetRole || 'Software Engineer';
      if (getPgStatus()) {
        const pgProfile = await findInPg('student_profiles', { user_id: req.user._id.toString() });
        if (pgProfile?.target_role) targetRole = pgProfile.target_role;
      }

      // 5. Run AI Re-Evaluation with new proof
      const latestProofItem = proofItems[proofItems.length - 1];
      const reEvalResult = await reEvaluateWithProof(previousAnalysis, latestProofItem, targetRole, updatedExtractedData);

      // 6. Construct updated analysis document preserving previous history
      const updatedAnalysisFields = {
        studentId: req.user._id,
        status: 'complete',
        extractedData: updatedExtractedData,
        sourceTexts: reEvalResult.sourceTexts,
        structuredEvidence: previousAnalysis.structuredEvidence || {},
        claimValidation: reEvalResult.claimValidation,
        scores: reEvalResult.scores,
        roleAnalysis: {
          ...(previousAnalysis.roleAnalysis || {}),
          strengths: reEvalResult.strengths || previousAnalysis.roleAnalysis?.strengths || [],
          gaps: reEvalResult.gaps || previousAnalysis.roleAnalysis?.gaps || []
        },
        recommendations: {
          ...(previousAnalysis.recommendations || {}),
          personSpecificGaps: reEvalResult.personSpecificGaps || [],
          learningRecommendations: reEvalResult.learningRecommendations || [],
          roadmapMilestones: reEvalResult.roadmapMilestones || [],
          finalLearningSummary: reEvalResult.finalLearningSummary || {},
          previousScore: reEvalResult.previous_score,
          scoreChange: reEvalResult.score_change,
          scoreChangeReason: reEvalResult.score_change_reason,
          updatedFromProof: true,
          latestProofUpdate: reEvalResult.updated_claim,
          latestProof: latestProofItem
        },
        roadmap: previousAnalysis.roadmap || {},
        overallProfile: reEvalResult.overallProfile || previousAnalysis.overallProfile,
        scoreExplanation: reEvalResult.scoreExplanation || previousAnalysis.scoreExplanation,
        personSpecificGaps: reEvalResult.personSpecificGaps || [],
        learningRecommendations: reEvalResult.learningRecommendations || [],
        roadmapMilestones: reEvalResult.roadmapMilestones || [],
        finalLearningSummary: reEvalResult.finalLearningSummary || {},
        previousScore: reEvalResult.previous_score,
        scoreChange: reEvalResult.score_change,
        scoreChangeReason: reEvalResult.score_change_reason,
        updatedFromProof: true,
        latestProofUpdate: reEvalResult.updated_claim,
        latestProof: latestProofItem
      };

      const newAnalysisDoc = getMongoStatus()
        ? new Analysis(updatedAnalysisFields)
        : { _id: crypto.randomUUID(), ...updatedAnalysisFields, createdAt: new Date(), updatedAt: new Date() };

      await syncAnalysisToPg(newAnalysisDoc);
      if (getMongoStatus()) {
        await newAnalysisDoc.save();
      } else {
        const idx = memoryAnalyses.findIndex(a => a.studentId?.toString() === req.user._id?.toString());
        if (idx !== -1) memoryAnalyses[idx] = newAnalysisDoc;
        else memoryAnalyses.push(newAnalysisDoc);
        saveMemoryDb();
      }

      res.json({
        message: 'Proof added and analysis updated successfully',
        analysisId: newAnalysisDoc._id,
        previous_score: reEvalResult.previous_score,
        new_score: reEvalResult.new_score,
        score_change: reEvalResult.score_change,
        score_change_reason: reEvalResult.score_change_reason,
        updated_claim: reEvalResult.updated_claim,
        analysis: newAnalysisDoc
      });
    } catch (err) {
      console.error('Proof submission and re-analysis error:', err);
      res.status(500).json({ error: 'Failed to process proof and update analysis', details: err.message });
    }
  });
});

module.exports = router;
