const mongoose = require('mongoose');

const proofSubmissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true },
  claim: { type: String, required: true },
  proofType: {
    type: String,
    enum: ['project_link', 'repository', 'screenshot', 'documentation', 'demo', 'certificate', 'other'],
    required: true
  },
  proofData: { type: String },       // URL or text description
  filePath: { type: String },        // uploaded file path
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'accepted', 'rejected'],
    default: 'pending'
  },
  reviewResult: {
    validated: Boolean,
    newStatus: String,
    explanation: String,
    scoreImpact: mongoose.Schema.Types.Mixed
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProofSubmission', proofSubmissionSchema);
