const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  resumePath: { type: String },
  resumeText: { type: String },
  githubUrl: { type: String },
  portfolioUrl: { type: String },
  leetcodeUrl: { type: String },
  gfgUrl: { type: String },
  linkedinUrl: { type: String },
  linkedinPdfPath: { type: String },
  figmaUrl: { type: String },
  targetRole: { type: String, trim: true },
  placementCellId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  profileComplete: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

studentProfileSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  this.profileComplete = !!(this.resumePath && this.githubUrl);
  next();
});

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
