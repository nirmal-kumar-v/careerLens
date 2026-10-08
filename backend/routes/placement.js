const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const StudentProfile = require('../models/StudentProfile');
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const { findInPg, listInPg, syncProfileToPg, updateInPg } = require('../services/dbService');
const { getPgStatus } = require('../config/postgresql');
const { getMongoStatus } = require('../config/mongodb');
const { memoryUsers, memoryProfiles, memoryAnalyses, saveMemoryDb } = require('../services/userStore');

const router = express.Router();

router.use(authenticate);
router.use(authorize('placement'));

/**
 * Helper: Check if a student user/profile belongs to the logged-in placement cell
 */
function studentMatchesPlacementCell(user, profile, placementOfficer) {
  if (!user && !profile) return false;

  const officerId = placementOfficer._id?.toString();
  const officerInstCode = (placementOfficer.institutionCode || '').trim().toLowerCase();
  const officerInstName = (placementOfficer.institutionName || '').trim().toLowerCase();
  const officerDomain = (placementOfficer.email || '').split('@')[1]?.toLowerCase();

  // 1. Direct placementCellId match
  const profileCellId = (profile?.placementCellId || profile?.placement_cell_id)?.toString();
  if (profileCellId && officerId && profileCellId === officerId) {
    return true;
  }

  // 2. Email domain match (e.g. @kongu.edu)
  const studentEmail = (user?.email || '').toLowerCase();
  const studentDomain = studentEmail.split('@')[1];
  if (officerDomain && studentDomain && officerDomain === studentDomain && officerDomain !== 'gmail.com' && officerDomain !== 'outlook.com' && officerDomain !== 'yahoo.com') {
    return true;
  }

  // 3. Institution code match (e.g. KEC)
  const userInstCode = (user?.institutionCode || user?.institution || '').trim().toLowerCase();
  if (officerInstCode && userInstCode && (officerInstCode === userInstCode || userInstCode.includes(officerInstCode) || officerInstCode.includes(userInstCode))) {
    return true;
  }

  // 4. Institution name match (e.g. Kongu Engineering College)
  const userInstName = (user?.institutionName || user?.institution || '').trim().toLowerCase();
  if (officerInstName && userInstName && (officerInstName === userInstName || userInstName.includes(officerInstName) || officerInstName.includes(userInstName))) {
    return true;
  }

  return false;
}

/**
 * Helper: Fetch all student records (user + profile + analysis) belonging to this placement cell
 */
async function getInstitutionStudents(placementOfficer) {
  const officerId = placementOfficer._id?.toString();
  const studentMap = new Map();

  // 1. Query PostgreSQL if active
  if (getPgStatus()) {
    try {
      const pgProfiles = await listInPg('student_profiles') || [];
      const pgUsers = await listInPg('users', { role: 'student' }) || [];
      const pgAnalyses = await listInPg('analyses') || [];

      for (const p of pgProfiles) {
        const u = pgUsers.find(user => user.mongo_id === p.user_id || user.id?.toString() === p.user_id?.toString());
        if (studentMatchesPlacementCell(u, p, placementOfficer)) {
          const studentId = (u?.mongo_id || u?.id || p.user_id).toString();
          const userAnalyses = pgAnalyses.filter(a => a.student_id === studentId && a.status === 'complete');
          studentMap.set(studentId, {
            id: studentId,
            name: u?.name || 'Student',
            email: u?.email || '',
            regNo: u?.reg_no || '',
            targetRole: p.target_role || '',
            githubUrl: p.github_url || '',
            approvalStatus: p.approval_status || 'pending',
            profileComplete: Boolean(p.resume_path && p.github_url),
            approvedAt: p.approved_at || null,
            createdAt: u?.created_at || p.created_at || null,
            analyses: userAnalyses.map(mapPgAnalysis)
          });
        }
      }
    } catch (e) {
      console.warn('[Placement] PG query warning:', e.message);
    }
  }

  // 2. Query MongoDB if active
  if (getMongoStatus()) {
    try {
      const mongoProfiles = await StudentProfile.find().populate('userId', 'name email regNo institutionName institutionCode createdAt');
      const studentIds = mongoProfiles.map(p => p.userId?._id).filter(Boolean);
      const mongoAnalyses = await Analysis.find({ studentId: { $in: studentIds } }).sort({ createdAt: -1 });

      for (const p of mongoProfiles) {
        const u = p.userId;
        if (u && studentMatchesPlacementCell(u, p, placementOfficer)) {
          const studentId = u._id.toString();
          const userAnalyses = mongoAnalyses.filter(a => a.studentId?.toString() === studentId);
          studentMap.set(studentId, {
            id: studentId,
            name: u.name,
            email: u.email,
            regNo: u.regNo || '',
            targetRole: p.targetRole || '',
            githubUrl: p.githubUrl || '',
            approvalStatus: p.approvalStatus || 'pending',
            profileComplete: Boolean(p.resumePath && p.githubUrl),
            approvedAt: p.approvedAt || null,
            createdAt: u.createdAt || p.updatedAt,
            analyses: userAnalyses
          });
        }
      }
    } catch (e) {
      console.warn('[Placement] Mongo query warning:', e.message);
    }
  }

  // 3. Fallback / Synchronize with Memory Store
  for (const p of memoryProfiles) {
    const u = memoryUsers.find(user => user._id?.toString() === p.userId?.toString() && user.role === 'student');
    if (u && studentMatchesPlacementCell(u, p, placementOfficer)) {
      const studentId = u._id.toString();
      const userAnalyses = memoryAnalyses.filter(a => a.studentId?.toString() === studentId && (a.status === 'complete' || a.scores));
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: u.name,
          email: u.email,
          regNo: u.regNo || '',
          targetRole: p.targetRole || '',
          githubUrl: p.githubUrl || '',
          approvalStatus: p.approvalStatus || 'pending',
          profileComplete: Boolean(p.resumePath && p.githubUrl),
          approvedAt: p.approvedAt || null,
          createdAt: u.createdAt || new Date(),
          analyses: userAnalyses
        });
      }
    }
  }

  return Array.from(studentMap.values());
}

// Get all students linked to this placement cell
router.get('/students', async (req, res) => {
  try {
    const students = await getInstitutionStudents(req.user);
    const payload = students.map(s => {
      const latestAnalysis = s.analyses?.[0] || null;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        regNo: s.regNo,
        targetRole: s.targetRole || latestAnalysis?.roleAnalysis?.targetRole || 'Not specified',
        approvalStatus: s.approvalStatus,
        profileComplete: s.profileComplete,
        latestScore: latestAnalysis?.scores?.overall || latestAnalysis?.jobReadinessScore || null,
        analysisCount: s.analyses?.length || 0,
        approvedAt: s.approvedAt,
        createdAt: s.createdAt
      };
    });
    res.json(payload);
  } catch (err) {
    console.error('Failed to fetch students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Approve a student
router.post('/approve/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const now = new Date();
    let updated = false;

    // 1. Update PG
    if (getPgStatus()) {
      try {
        await updateInPg('student_profiles', { user_id: studentId }, {
          approval_status: 'approved',
          placement_cell_id: req.user._id.toString(),
          approved_at: now
        });
        updated = true;
      } catch (e) {}
    }

    // 2. Update Mongo
    if (getMongoStatus()) {
      try {
        let profile = await StudentProfile.findOne({ userId: studentId });
        if (profile) {
          profile.approvalStatus = 'approved';
          profile.placementCellId = req.user._id;
          profile.approvedAt = now;
          await profile.save();
          updated = true;
        }
      } catch (e) {}
    }

    // 3. Update Memory Store
    const memProfile = memoryProfiles.find(p => p.userId?.toString() === studentId.toString());
    if (memProfile) {
      memProfile.approvalStatus = 'approved';
      memProfile.placementCellId = req.user._id.toString();
      memProfile.approvedAt = now;
      saveMemoryDb();
      updated = true;
    }

    if (!updated) {
      // Create profile record if missing
      memoryProfiles.push({
        _id: 'prof_' + Date.now(),
        userId: studentId,
        placementCellId: req.user._id.toString(),
        approvalStatus: 'approved',
        approvedAt: now
      });
      saveMemoryDb();
    }

    res.json({
      message: 'Student approved successfully',
      approvalStatus: 'approved',
      studentId,
      approvedAt: now
    });
  } catch (err) {
    console.error('Failed to approve student:', err);
    res.status(500).json({ error: 'Failed to approve student' });
  }
});

// Reject a student
router.post('/reject/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const now = new Date();

    if (getPgStatus()) {
      try {
        await updateInPg('student_profiles', { user_id: studentId }, {
          approval_status: 'rejected',
          placement_cell_id: req.user._id.toString()
        });
      } catch (e) {}
    }

    if (getMongoStatus()) {
      try {
        let profile = await StudentProfile.findOne({ userId: studentId });
        if (profile) {
          profile.approvalStatus = 'rejected';
          await profile.save();
        }
      } catch (e) {}
    }

    const memProfile = memoryProfiles.find(p => p.userId?.toString() === studentId.toString());
    if (memProfile) {
      memProfile.approvalStatus = 'rejected';
      saveMemoryDb();
    }

    res.json({ message: 'Student rejected', approvalStatus: 'rejected', studentId });
  } catch (err) {
    console.error('Failed to reject student:', err);
    res.status(500).json({ error: 'Failed to reject student' });
  }
});

// View approved student's analysis & past history
router.get('/student-analysis/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const allStudents = await getInstitutionStudents(req.user);
    const targetStudent = allStudents.find(s => s.id === studentId);

    if (!targetStudent) {
      return res.status(403).json({ error: 'Access denied. Student is not linked to your placement cell.' });
    }

    if (targetStudent.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Access denied. Student profile is pending approval by your placement cell.' });
    }

    const analyses = targetStudent.analyses || [];
    const latestAnalysis = analyses[0] || null;

    // Generate historical record items
    const history = analyses.map((a, idx) => ({
      id: a._id || `analysis_${idx}`,
      createdAt: a.createdAt || a.created_at || new Date(),
      score: a.scores?.overall || a.jobReadinessScore || 0,
      scores: a.scores || {},
      targetRole: a.roleAnalysis?.targetRole || 'Software Engineer',
      verifiedCount: (a.claimValidation || a.claim_validation || []).filter(c => c.status === 'verified').length,
      unsupportedCount: (a.claimValidation || a.claim_validation || []).filter(c => c.status === 'requires_proof' || c.status === 'unsupported').length,
      updatedFromProof: Boolean(a.updatedFromProof || a.latestProofUpdate),
      latestProofUpdate: a.latestProofUpdate || null,
      scoreChangeReason: a.scoreChangeReason || a.scoreExplanation || null
    }));

    // Personalized Summary for Placement Officer
    const overallScore = latestAnalysis?.scores?.overall || latestAnalysis?.jobReadinessScore || 0;
    const verifiedSkills = (latestAnalysis?.claimValidation || []).filter(c => c.status === 'verified').map(c => c.skill);
    const unverifiedSkills = (latestAnalysis?.claimValidation || []).filter(c => c.status === 'requires_proof').map(c => c.skill);
    const roleFit = latestAnalysis?.roleAnalysis?.targetRole || targetStudent.targetRole || 'Technical Candidate';

    const personalizedSummary = {
      readiness: overallScore,
      strengths: latestAnalysis?.alreadyStrongIn?.length ? latestAnalysis.alreadyStrongIn : verifiedSkills.slice(0, 4),
      gaps: latestAnalysis?.personSpecificGaps?.length ? latestAnalysis.personSpecificGaps.map(g => g.gap) : unverifiedSkills.slice(0, 4),
      bestFitRoles: latestAnalysis?.bestFitRoles || latestAnalysis?.roleAnalysis?.suggestedRoles || [{ role: roleFit, fitScore: overallScore }],
      nextAction: latestAnalysis?.nextBestAction || 'Review repository code contributions and verify technical claims.',
      recommendationNote: overallScore >= 70
        ? `Candidate shows strong verified alignment for ${roleFit}. Ready for technical campus placement rounds.`
        : `Candidate needs focused project proof in ${unverifiedSkills.slice(0, 2).join(' & ') || 'core domains'} before final interview shortlisting.`
    };

    res.json({
      student: {
        name: targetStudent.name,
        email: targetStudent.email,
        regNo: targetStudent.regNo,
        targetRole: targetStudent.targetRole,
        githubUrl: targetStudent.githubUrl,
        profileComplete: targetStudent.profileComplete,
        approvedAt: targetStudent.approvedAt
      },
      analysis: latestAnalysis,
      history,
      personalizedSummary
    });
  } catch (err) {
    console.error('Failed to fetch student analysis:', err);
    res.status(500).json({ error: 'Failed to fetch student analysis' });
  }
});

// Batch analytics
router.get('/analytics', async (req, res) => {
  try {
    const allStudents = await getInstitutionStudents(req.user);
    const approvedStudents = allStudents.filter(s => s.approvalStatus === 'approved');
    const analyses = approvedStudents.flatMap(s => s.analyses || []).filter(a => a && (a.scores || a.jobReadinessScore));

    res.json(buildAnalyticsPayload(allStudents, analyses, req.user));
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Placement cell dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const allStudents = await getInstitutionStudents(req.user);
    const totalStudents = allStudents.length;
    const pendingCount = allStudents.filter(s => s.approvalStatus === 'pending').length;
    const approvedCount = allStudents.filter(s => s.approvalStatus === 'approved').length;
    const analyzedCount = allStudents.filter(s => s.approvalStatus === 'approved' && s.analyses?.length > 0).length;

    const scores = allStudents
      .filter(s => s.approvalStatus === 'approved' && s.analyses?.[0]?.scores?.overall)
      .map(s => s.analyses[0].scores.overall);
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const instName = req.user.institutionName || req.user.institutionCode || 'your institution';
    let personalizedInsights = '';
    if (approvedCount === 0) {
      personalizedInsights = `You have ${pendingCount} student${pendingCount === 1 ? '' : 's'} awaiting approval. Review the pending queue to activate institutional cohort monitoring.`;
    } else if (analyzedCount > 0) {
      personalizedInsights = `Among the currently approved ${instName} students, the cohort average readiness is ${averageScore}/100 across ${analyzedCount} active diagnostic reports.`;
    } else {
      personalizedInsights = `${approvedCount} approved students actively linked to ${instName}. Diagnostics in progress.`;
    }

    res.json({
      user: req.user.toJSON ? req.user.toJSON() : { ...req.user },
      stats: {
        totalStudents,
        pendingCount,
        approvedCount,
        analyzedCount,
        averageScore,
        personalizedInsights
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

function buildAnalyticsPayload(students, analyses, placementOfficer) {
  const skillCounts = {};
  const skillVerified = {};
  const roleCounts = {};
  const scoreDistribution = [];
  const allGaps = [];

  analyses.forEach(analysis => {
    const overall = analysis.scores?.overall || analysis.jobReadinessScore;
    if (Number.isFinite(overall)) scoreDistribution.push(overall);

    const claims = analysis.claimValidation || analysis.claim_validation || [];
    claims.forEach(claim => {
      const skill = String(claim.skill || '').toLowerCase().trim();
      if (!skill) return;
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      if (claim.status === 'verified' || claim.status === 'partially_supported') {
        skillVerified[skill] = (skillVerified[skill] || 0) + 1;
      }
    });

    const role = analysis.roleAnalysis?.targetRole || analysis.role_analysis?.targetRole;
    if (role) roleCounts[role] = (roleCounts[role] || 0) + 1;

    const gaps = analysis.personSpecificGaps || analysis.roleAnalysis?.gaps || [];
    gaps.forEach(g => {
      const gapTitle = typeof g === 'string' ? g : (g.gap || g.title);
      if (gapTitle) allGaps.push(gapTitle);
    });
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

  const instName = placementOfficer?.institutionName || placementOfficer?.institutionCode || 'Cohort';
  const topGap = commonGaps[0]?.gap;
  const personalizedTrainingRecommendation = topGap
    ? `Among the currently approved ${instName} students, ${topGap} is one of the most common evidence gaps, so targeted project bootcamps in this domain would be a high-value batch training priority.`
    : `Batch diagnostic shows balanced foundational skill demonstration across active ${instName} candidates.`;

  return {
    summary: {
      totalStudents: students.length,
      totalApproved: students.filter(s => s.approvalStatus === 'approved').length,
      totalAnalyzed,
      pendingApproval: students.filter(s => s.approvalStatus === 'pending').length,
      averageScore: scoreDistribution.length
        ? Math.round(scoreDistribution.reduce((total, score) => total + score, 0) / scoreDistribution.length)
        : 0,
      personalizedTrainingRecommendation
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

