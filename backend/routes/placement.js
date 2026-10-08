const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const StudentProfile = require('../models/StudentProfile');
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const { findInPg, listInPg, syncProfileToPg, updateInPg } = require('../services/dbService');
const { getPgStatus } = require('../config/postgresql');
const { getMongoStatus } = require('../config/mongodb');

const router = express.Router();

router.use(authenticate);
router.use(authorize('placement'));

// Get all students linked to this placement cell
router.get('/students', async (req, res) => {
  try {
    if (getPgStatus()) {
      const pgProfiles = await listInPg('student_profiles', { placement_cell_id: req.user._id.toString() });
      if (pgProfiles?.length) {
        const students = await Promise.all(pgProfiles.map(async profile => {
          const user = await findInPg('users', { mongo_id: profile.user_id });
          return user ? {
            id: user.mongo_id,
            name: user.name,
            email: user.email,
            regNo: user.reg_no,
            approvalStatus: profile.approval_status,
            profileComplete: Boolean(profile.resume_path && profile.github_url),
            targetRole: profile.target_role
          } : null;
        }));
        return res.json(students.filter(Boolean));
      }
    }
    if (!getMongoStatus()) return res.json([]);
    const profiles = await StudentProfile.find({ placementCellId: req.user._id })
      .populate('userId', 'name email regNo');

    const students = profiles.map(p => ({
      id: p.userId._id,
      name: p.userId.name,
      email: p.userId.email,
      regNo: p.userId.regNo,
      approvalStatus: p.approvalStatus,
      profileComplete: p.profileComplete,
      targetRole: p.targetRole
    }));

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Approve a student
router.post('/approve/:studentId', async (req, res) => {
  try {
    if (getPgStatus()) {
      const pgProfile = await findInPg('student_profiles', { user_id: req.params.studentId });
      if (pgProfile && pgProfile.placement_cell_id === req.user._id.toString()) {
        await updateInPg('student_profiles', { user_id: req.params.studentId }, { approval_status: 'approved' });
        if (getMongoStatus()) {
          const mongoProfile = await StudentProfile.findOne({ userId: req.params.studentId, placementCellId: req.user._id });
          if (mongoProfile) {
            mongoProfile.approvalStatus = 'approved';
            await mongoProfile.save();
          }
        }
        return res.json({ message: 'Student approved', approvalStatus: 'approved' });
      }
    }
    if (!getMongoStatus()) return res.status(404).json({ error: 'Student not found' });
    const profile = await StudentProfile.findOne({
      userId: req.params.studentId,
      placementCellId: req.user._id
    });

    if (!profile) {
      return res.status(404).json({ error: 'Student not found or not linked to your placement cell' });
    }

    profile.approvalStatus = 'approved';
    await syncProfileToPg(profile);
    await profile.save();

    res.json({ message: 'Student approved', approvalStatus: 'approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve student' });
  }
});

// Reject a student
router.post('/reject/:studentId', async (req, res) => {
  try {
    if (getPgStatus()) {
      const pgProfile = await findInPg('student_profiles', { user_id: req.params.studentId });
      if (pgProfile && pgProfile.placement_cell_id === req.user._id.toString()) {
        await updateInPg('student_profiles', { user_id: req.params.studentId }, { approval_status: 'rejected' });
        if (getMongoStatus()) {
          const mongoProfile = await StudentProfile.findOne({ userId: req.params.studentId, placementCellId: req.user._id });
          if (mongoProfile) {
            mongoProfile.approvalStatus = 'rejected';
            await mongoProfile.save();
          }
        }
        return res.json({ message: 'Student rejected', approvalStatus: 'rejected' });
      }
    }
    if (!getMongoStatus()) return res.status(404).json({ error: 'Student not found' });
    const profile = await StudentProfile.findOne({
      userId: req.params.studentId,
      placementCellId: req.user._id
    });

    if (!profile) {
      return res.status(404).json({ error: 'Student not found' });
    }

    profile.approvalStatus = 'rejected';
    await syncProfileToPg(profile);
    await profile.save();

    res.json({ message: 'Student rejected', approvalStatus: 'rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject student' });
  }
});

// View approved student's analysis (ONLY approved students)
router.get('/student-analysis/:studentId', async (req, res) => {
  try {
    if (getPgStatus()) {
      const pgProfile = await findInPg('student_profiles', { user_id: req.params.studentId });
      if (pgProfile && pgProfile.placement_cell_id === req.user._id.toString() && pgProfile.approval_status === 'approved') {
        const user = await findInPg('users', { mongo_id: req.params.studentId });
        const pgAnalyses = await listInPg('analyses', { student_id: req.params.studentId });
        const analysis = pgAnalyses?.find(item => item.status === 'complete');
        return res.json({
          student: {
            name: user?.name,
            email: user?.email,
            regNo: user?.reg_no,
            targetRole: pgProfile.target_role,
            githubUrl: pgProfile.github_url,
            profileComplete: Boolean(pgProfile.resume_path && pgProfile.github_url)
          },
          analysis: analysis ? mapPgAnalysis(analysis) : null
        });
      }
      if (!getMongoStatus()) {
        return res.status(403).json({ error: 'Access denied. Student is not approved or not linked to your placement cell.' });
      }
    }
    if (!getMongoStatus()) return res.status(404).json({ error: 'Student not found' });
    // Authorization: only approved students
    const profile = await StudentProfile.findOne({
      userId: req.params.studentId,
      placementCellId: req.user._id,
      approvalStatus: 'approved'
    }).populate('userId', 'name email regNo');

    if (!profile) {
      return res.status(403).json({ error: 'Access denied. Student is not approved or not linked to your placement cell.' });
    }

    const analysis = await Analysis.findOne({ studentId: req.params.studentId })
      .sort({ createdAt: -1 });

    res.json({
      student: {
        name: profile.userId.name,
        email: profile.userId.email,
        regNo: profile.userId.regNo,
        targetRole: profile.targetRole,
        githubUrl: profile.githubUrl,
        profileComplete: profile.profileComplete
      },
      analysis: analysis || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student analysis' });
  }
});

// Batch analytics (only from approved students)
router.get('/analytics', async (req, res) => {
  try {
    if (getPgStatus()) {
      const profiles = await listInPg('student_profiles', { placement_cell_id: req.user._id.toString() }) || [];
      const approvedProfiles = profiles.filter(profile => profile.approval_status === 'approved');
      const analysisGroups = await Promise.all(approvedProfiles.map(profile =>
        listInPg('analyses', { student_id: profile.user_id })
      ));
      const analyses = analysisGroups.flat().filter(analysis => analysis?.status === 'complete');
      return res.json(buildAnalyticsPayload(profiles, analyses));
    }
    if (!getMongoStatus()) return res.json(buildAnalyticsPayload([], []));
    // Get all approved students for this placement cell
    const approvedProfiles = await StudentProfile.find({
      placementCellId: req.user._id,
      approvalStatus: 'approved'
    }).populate('userId', 'name');

    const approvedIds = approvedProfiles.map(p => p.userId._id);

    // Get analyses for approved students
    const analyses = await Analysis.find({
      studentId: { $in: approvedIds },
      status: 'complete'
    });

    // Aggregate analytics
    const totalApproved = approvedProfiles.length;
    const totalAnalyzed = analyses.length;

    // Skill claim vs proof aggregation
    const skillCounts = {};
    const skillVerified = {};
    const roleCounts = {};
    const scoreDistribution = [];

    analyses.forEach(a => {
      // Scores
      if (a.scores && a.scores.overall) {
        scoreDistribution.push(a.scores.overall);
      }

      // Claim validation
      (a.claimValidation || []).forEach(cv => {
        const skill = cv.skill.toLowerCase();
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        if (cv.status === 'verified' || cv.status === 'partially_supported') {
          skillVerified[skill] = (skillVerified[skill] || 0) + 1;
        }
      });

      // Role analysis
      if (a.roleAnalysis && a.roleAnalysis.targetRole) {
        const role = a.roleAnalysis.targetRole;
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      }
    });

    // Build claim vs proof insights
    const claimVsProof = Object.entries(skillCounts).map(([skill, claimed]) => ({
      skill,
      claimed,
      verified: skillVerified[skill] || 0,
      claimRate: Math.round((claimed / totalAnalyzed) * 100),
      verifyRate: Math.round(((skillVerified[skill] || 0) / totalAnalyzed) * 100),
      gap: claimed - (skillVerified[skill] || 0)
    })).sort((a, b) => b.gap - a.gap);

    // Average scores
    const avgScore = scoreDistribution.length > 0
      ? Math.round(scoreDistribution.reduce((a, b) => a + b, 0) / scoreDistribution.length)
      : 0;

    // Common gaps from analyses
    const allGaps = [];
    analyses.forEach(a => {
      if (a.roleAnalysis && a.roleAnalysis.gaps) {
        allGaps.push(...a.roleAnalysis.gaps);
      }
    });
    const gapCounts = {};
    allGaps.forEach(g => {
      gapCounts[g] = (gapCounts[g] || 0) + 1;
    });
    const commonGaps = Object.entries(gapCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([gap, count]) => ({ gap, count, percentage: Math.round((count / totalAnalyzed) * 100) }));

    res.json({
      summary: {
        totalStudents: await StudentProfile.countDocuments({ placementCellId: req.user._id }),
        totalApproved,
        totalAnalyzed,
        pendingApproval: await StudentProfile.countDocuments({
          placementCellId: req.user._id,
          approvalStatus: 'pending'
        }),
        averageScore: avgScore
      },
      claimVsProof: claimVsProof.slice(0, 20),
      commonGaps,
      roleDistribution: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
      scoreDistribution
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Placement cell dashboard
router.get('/dashboard', async (req, res) => {
  try {
    if (getPgStatus()) {
      const profiles = await listInPg('student_profiles', { placement_cell_id: req.user._id.toString() }) || [];
      return res.json({
        user: req.user.toJSON(),
        stats: {
          totalStudents: profiles.length,
          pendingCount: profiles.filter(profile => profile.approval_status === 'pending').length,
          approvedCount: profiles.filter(profile => profile.approval_status === 'approved').length
        }
      });
    }
    if (!getMongoStatus()) return res.json({ user: req.user, stats: { totalStudents: 0, pendingCount: 0, approvedCount: 0 } });
    const totalStudents = await StudentProfile.countDocuments({ placementCellId: req.user._id });
    const pendingCount = await StudentProfile.countDocuments({
      placementCellId: req.user._id,
      approvalStatus: 'pending'
    });
    const approvedCount = await StudentProfile.countDocuments({
      placementCellId: req.user._id,
      approvalStatus: 'approved'
    });

    res.json({
      user: req.user.toJSON(),
      stats: { totalStudents, pendingCount, approvedCount }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

function buildAnalyticsPayload(profiles, analyses) {
  const skillCounts = {};
  const skillVerified = {};
  const roleCounts = {};
  const scoreDistribution = [];
  const allGaps = [];

  analyses.forEach(analysis => {
    const overall = analysis.scores?.overall;
    if (Number.isFinite(overall)) scoreDistribution.push(overall);
    (analysis.claim_validation || []).forEach(claim => {
      const skill = String(claim.skill || '').toLowerCase();
      if (!skill) return;
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      if (claim.status === 'verified' || claim.status === 'partially_supported') {
        skillVerified[skill] = (skillVerified[skill] || 0) + 1;
      }
    });
    const role = analysis.role_analysis?.targetRole;
    if (role) roleCounts[role] = (roleCounts[role] || 0) + 1;
    allGaps.push(...(analysis.role_analysis?.gaps || []));
  });

  const totalAnalyzed = analyses.length;
  const denominator = Math.max(totalAnalyzed, 1);
  const claimVsProof = Object.entries(skillCounts).map(([skill, claimed]) => ({
    skill,
    claimed,
    verified: skillVerified[skill] || 0,
    claimRate: Math.round((claimed / denominator) * 100),
    verifyRate: Math.round(((skillVerified[skill] || 0) / denominator) * 100),
    gap: claimed - (skillVerified[skill] || 0)
  })).sort((a, b) => b.gap - a.gap);
  const gapCounts = {};
  allGaps.forEach(gap => { gapCounts[gap] = (gapCounts[gap] || 0) + 1; });
  const commonGaps = Object.entries(gapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([gap, count]) => ({ gap, count, percentage: Math.round((count / denominator) * 100) }));

  return {
    summary: {
      totalStudents: profiles.length,
      totalApproved: profiles.filter(profile => profile.approval_status === 'approved').length,
      totalAnalyzed,
      pendingApproval: profiles.filter(profile => profile.approval_status === 'pending').length,
      averageScore: scoreDistribution.length
        ? Math.round(scoreDistribution.reduce((total, score) => total + score, 0) / scoreDistribution.length)
        : 0
    },
    claimVsProof: claimVsProof.slice(0, 20),
    commonGaps,
    roleDistribution: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
    scoreDistribution
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
