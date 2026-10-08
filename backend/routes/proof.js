const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ProofSubmission = require('../models/ProofSubmission');
const { uploadProof } = require('../middleware/upload');
const Analysis = require('../models/Analysis');
const { getMongoStatus } = require('../config/mongodb');
const { findInPg, listInPg, syncProofToPg } = require('../services/dbService');

const router = express.Router();

router.use(authenticate);
router.use(authorize('student'));

// Submit proof for a specific claim
router.post('/submit', (req, res) => {
  uploadProof(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const { claim, proofType, proofData } = req.body;
    if (!claim || !proofType) {
      return res.status(400).json({ error: 'claim and proofType are required' });
    }
    const proofFilePath = req.file ? req.file.path : null;

    try {
      let analysisId;
      if (getMongoStatus()) {
        const analysis = await Analysis.findOne({ studentId: req.user._id }).sort({ createdAt: -1 });
        if (!analysis) return res.status(400).json({ error: 'Run an analysis before submitting proof' });
        analysisId = analysis._id;
      } else {
        const analyses = await listInPg('analyses', { student_id: req.user._id.toString() });
        if (!analyses?.length) return res.status(400).json({ error: 'Run an analysis before submitting proof' });
        analysisId = analyses[0].mongo_id || String(analyses[0].id);
      }

      let submission;
      if (getMongoStatus()) {
        submission = new ProofSubmission({
          studentId: req.user._id,
          analysisId,
          claim,
          proofType,
          proofData: proofData || '',
          filePath: proofFilePath,
          status: 'pending'
        });
      } else {
        submission = {
          _id: require('crypto').randomUUID(),
          studentId: req.user._id,
          analysisId,
          claim,
          proofType,
          proofData: proofData || '',
          filePath: proofFilePath,
          status: 'pending',
          reviewResult: {}
        };
      }
      await syncProofToPg(submission);
      if (getMongoStatus()) await submission.save();
      return res.json({ message: 'Proof submitted, pending review', submissionId: submission._id });
    } catch (saveError) {
      console.error('Proof submission error:', saveError);
      return res.status(500).json({ error: 'Failed to save proof submission' });
    }
  });
});

// Retrieve proof submissions for the logged‑in student
router.get('/', async (req, res) => {
  try {
    if (!getMongoStatus()) {
      const rows = await listInPg('proof_submissions', { student_id: req.user._id.toString() });
      return res.json((rows || []).map(row => ({
        _id: row.mongo_id || String(row.id),
        analysisId: row.analysis_id,
        studentId: row.student_id,
        claim: row.claim,
        proofType: row.proof_type,
        proofData: row.proof_data,
        filePath: row.file_path,
        status: row.status,
        reviewResult: row.review_result,
        createdAt: row.created_at
      })));
    }
    const submissions = await ProofSubmission.find({ studentId: req.user._id }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

module.exports = router;
