const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadResume, uploadLinkedinPdf } = require('../middleware/upload');
const StudentProfile = require('../models/StudentProfile');
const Analysis = require('../models/Analysis');
const { memoryProfiles, memoryAnalyses, saveMemoryDb } = require('../services/userStore');
const { syncProfileToPg, findInPg, listInPg } = require('../services/dbService');
const { getMongoStatus } = require('../config/mongodb');
const { getPgStatus } = require('../config/postgresql');

const router = express.Router();

// All student routes require authentication
router.use(authenticate);
router.use(authorize('student'));

// Get student profile
router.get('/profile', async (req, res) => {
  try {
    let pgProfile;
    if (getPgStatus()) {
      pgProfile = await findInPg('student_profiles', { user_id: req.user._id.toString() });
    }
    if (getMongoStatus()) {
      let mongoProfile = await StudentProfile.findOne({ userId: req.user._id })
        .populate('placementCellId', 'name institutionName');
      if (!mongoProfile) {
        mongoProfile = new StudentProfile({ userId: req.user._id });
        await syncProfileToPg(mongoProfile);
        await mongoProfile.save();
      }
      if (!pgProfile || !pgProfile.resume_path || !pgProfile.github_url) {
        await syncProfileToPg(mongoProfile);
        pgProfile = await findInPg('student_profiles', { user_id: req.user._id.toString() });
      }
      if (!pgProfile) return res.json(mongoProfile);
    }
    if (pgProfile) return res.json(mapPgProfile(pgProfile));

    // Memory store fallback
    let memProfile = memoryProfiles.find(p => p.userId?.toString() === req.user._id?.toString());
    if (!memProfile) {
      memProfile = { userId: req.user._id, approvalStatus: 'approved' };
      memoryProfiles.push(memProfile);
    }
    return res.json(memProfile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile links
router.put('/profile', async (req, res) => {
  try {
    const { githubUrl, portfolioUrl, leetcodeUrl, gfgUrl, linkedinUrl, figmaUrl, targetRole } = req.body;

    // Validate URLs
    const urlFields = { githubUrl, portfolioUrl, leetcodeUrl, gfgUrl, linkedinUrl, figmaUrl };
    for (const [key, val] of Object.entries(urlFields)) {
      if (val && val.trim()) {
        try {
          new URL(val);
        } catch {
          return res.status(400).json({ error: `Invalid URL for ${key}` });
        }
      }
    }

    // GitHub is required
    if (!githubUrl || !githubUrl.trim()) {
      return res.status(400).json({ error: 'GitHub profile URL is required' });
    }

    let profileData = {
      userId: req.user._id,
      githubUrl: githubUrl.trim(),
      portfolioUrl: portfolioUrl !== undefined ? (portfolioUrl ? portfolioUrl.trim() : '') : undefined,
      leetcodeUrl: leetcodeUrl !== undefined ? (leetcodeUrl ? leetcodeUrl.trim() : '') : undefined,
      gfgUrl: gfgUrl !== undefined ? (gfgUrl ? gfgUrl.trim() : '') : undefined,
      linkedinUrl: linkedinUrl !== undefined ? (linkedinUrl ? linkedinUrl.trim() : '') : undefined,
      figmaUrl: figmaUrl !== undefined ? (figmaUrl ? figmaUrl.trim() : '') : undefined,
      targetRole: targetRole !== undefined ? (targetRole ? targetRole.trim() : '') : undefined
    };
    
    // Remove undefined values
    Object.keys(profileData).forEach(key => profileData[key] === undefined && delete profileData[key]);

    if (getMongoStatus()) {
      let profile = await StudentProfile.findOne({ userId: req.user._id });
      if (!profile) profile = new StudentProfile({ userId: req.user._id });
      Object.assign(profile, profileData);
      const savedProfile = await syncProfileToPg(profile);
      await profile.save();
      return res.json(mapPgProfile(savedProfile));
    } else {
      const savedProfile = await syncProfileToPg(profileData);
      let memProfile = memoryProfiles.find(p => p.userId?.toString() === req.user._id?.toString());
      if (!memProfile) {
        memProfile = { userId: req.user._id, ...profileData };
        memoryProfiles.push(memProfile);
      } else {
        Object.assign(memProfile, profileData);
      }
      saveMemoryDb();
      return res.json(savedProfile ? mapPgProfile(savedProfile) : memProfile);
    }
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload resume
router.post('/resume', (req, res) => {
  uploadResume(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    try {
      const profileData = { userId: req.user._id, resumePath: req.file.path };
      let mongoProfile;
      if (getMongoStatus()) {
        mongoProfile = await StudentProfile.findOne({ userId: req.user._id });
        if (!mongoProfile) mongoProfile = new StudentProfile({ userId: req.user._id });
        mongoProfile.resumePath = req.file.path;
      }
      
      await syncProfileToPg(profileData);
      if (mongoProfile) await mongoProfile.save();

      let memProfile = memoryProfiles.find(p => p.userId?.toString() === req.user._id?.toString());
      if (!memProfile) {
        memProfile = { userId: req.user._id, resumePath: req.file.path };
        memoryProfiles.push(memProfile);
      } else {
        memProfile.resumePath = req.file.path;
      }
      saveMemoryDb();

      res.json({ message: 'Resume uploaded successfully', filename: req.file.filename, resumePath: req.file.path });
    } catch (err) {
      console.error('Resume upload error:', err);
      res.status(500).json({ error: 'Failed to save resume' });
    }
  });
});

// Upload LinkedIn profile PDF
router.post('/linkedin-pdf', (req, res) => {
  uploadLinkedinPdf(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No LinkedIn PDF uploaded' });
    }

    try {
      const profileData = { userId: req.user._id, linkedinPdfPath: req.file.path };
      let mongoProfile;
      if (getMongoStatus()) {
        mongoProfile = await StudentProfile.findOne({ userId: req.user._id });
        if (!mongoProfile) mongoProfile = new StudentProfile({ userId: req.user._id });
        mongoProfile.linkedinPdfPath = req.file.path;
      }
      
      await syncProfileToPg(profileData);
      if (mongoProfile) await mongoProfile.save();

      let memProfile = memoryProfiles.find(p => p.userId?.toString() === req.user._id?.toString());
      if (!memProfile) {
        memProfile = { userId: req.user._id, linkedinPdfPath: req.file.path };
        memoryProfiles.push(memProfile);
      } else {
        memProfile.linkedinPdfPath = req.file.path;
      }
      saveMemoryDb();

      res.json({ message: 'LinkedIn PDF uploaded successfully', filename: req.file.filename, linkedinPdfPath: req.file.path });
    } catch (err) {
      console.error('LinkedIn PDF upload error:', err);
      res.status(500).json({ error: 'Failed to save LinkedIn PDF' });
    }
  });
});

// Get analysis status/results
router.get('/analysis', async (req, res) => {
  try {
    if (getPgStatus()) {
      const rows = await listInPg('analyses', { student_id: req.user._id.toString() });
      if (rows?.length) return res.json({ exists: true, analysis: mapPgAnalysis(rows[0]) });
    }
    if (getMongoStatus()) {
      const analysis = await Analysis.findOne({ studentId: req.user._id })
        .sort({ createdAt: -1 });
      if (analysis) {
        return res.json({ exists: true, analysis });
      }
    }
    const memAnalysis = memoryAnalyses.find(a => a.studentId?.toString() === req.user._id?.toString());
    if (memAnalysis) {
      return res.json({ exists: true, analysis: memAnalysis });
    }
    return res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// Get dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    let profileData = null;
    let analysisData = null;

    if (getPgStatus()) {
      const pgProfile = await findInPg('student_profiles', { user_id: req.user._id.toString() });
      if (pgProfile) profileData = mapPgProfile(pgProfile);
      const pgAnalyses = await listInPg('analyses', { student_id: req.user._id.toString() });
      if (pgAnalyses?.length) analysisData = mapPgAnalysis(pgAnalyses[0]);
    }

    if ((!profileData || !analysisData) && getMongoStatus()) {
      const profile = await StudentProfile.findOne({ userId: req.user._id })
        .populate('placementCellId', 'name institutionName');
      const analysis = await Analysis.findOne({ studentId: req.user._id })
        .sort({ createdAt: -1 });
      if (!profileData) profileData = profile;
      if (!analysisData) analysisData = analysis;
    }

    if (!profileData) {
      profileData = memoryProfiles.find(p => p.userId?.toString() === req.user._id?.toString()) || null;
    }
    if (!analysisData) {
      analysisData = memoryAnalyses.find(a => a.studentId?.toString() === req.user._id?.toString()) || null;
    }

    res.json({
      user: req.user.toJSON ? req.user.toJSON() : { ...req.user },
      profile: profileData || null,
      hasAnalysis: !!analysisData,
      analysisStatus: analysisData ? analysisData.status : null,
      overallScore: analysisData?.scores?.overall || null,
      lastAnalysisDate: analysisData?.updatedAt || null
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

function mapPgProfile(profile) {
  return {
    _id: profile.id,
    userId: profile.user_id,
    resumePath: profile.resume_path,
    githubUrl: profile.github_url,
    portfolioUrl: profile.portfolio_url,
    leetcodeUrl: profile.leetcode_url,
    gfgUrl: profile.gfg_url,
    linkedinUrl: profile.linkedin_url,
    linkedinPdfPath: profile.linkedin_pdf_path,
    figmaUrl: profile.figma_url,
    targetRole: profile.target_role,
    placementCellId: profile.placement_cell_id,
    approvalStatus: profile.approval_status,
    profileComplete: Boolean(profile.resume_path && profile.github_url),
    updatedAt: profile.updated_at
  };
}

function mapPgAnalysis(analysis) {
  const recs = analysis.recommendations || {};
  const extracted = analysis.analysis_data || {};
  return {
    _id: analysis.mongo_id || String(analysis.id),
    studentId: analysis.student_id,
    status: analysis.status,
    extractedData: extracted,
    structuredEvidence: analysis.structured_evidence,
    claimValidation: analysis.claim_validation,
    scores: analysis.scores,
    roleAnalysis: analysis.role_analysis,
    recommendations: analysis.recommendations,
    roadmap: analysis.roadmap,

    // Personalized Learning & YouTube Recommendation fields
    recommendationObject: recs.recommendationObject || extracted.recommendationObject || null,
    personSpecificGaps: recs.personSpecificGaps || extracted.personSpecificGaps || [],
    learningRecommendations: recs.learningRecommendations || extracted.learningRecommendations || [],
    roadmapMilestones: recs.roadmapMilestones || extracted.roadmapMilestones || [],
    finalLearningSummary: recs.finalLearningSummary || extracted.finalLearningSummary || {},
    alreadyStrongIn: recs.alreadyStrongIn || extracted.alreadyStrongIn || [],
    overallProfile: recs.overallProfile || extracted.overallProfile || '',
    scoreExplanation: recs.scoreExplanation || extracted.scoreExplanation || '',
    nextBestAction: recs.nextBestAction || extracted.nextBestAction || '',
    sourceTexts: recs.sourceTexts || extracted.sourceTexts || {},

    createdAt: analysis.created_at,
    updatedAt: analysis.updated_at
  };
}

module.exports = router;
