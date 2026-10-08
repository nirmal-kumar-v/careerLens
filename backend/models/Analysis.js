const mongoose = require('mongoose');

const claimEvidenceSchema = new mongoose.Schema({
  skill: String,
  claimedIn: [String],         // sources where claimed
  evidenceIn: [String],        // sources where evidence found
  status: {
    type: String,
    enum: ['verified', 'partially_supported', 'unsupported', 'requires_proof', 'not_verifiable'],
    default: 'unsupported'
  },
  evidenceDetails: [{ source: String, detail: String, strength: String }],
  proofRequested: { type: Boolean, default: false },
  proofSubmitted: { type: Boolean, default: false }
});

const analysisSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'extracting', 'analyzing', 'complete', 'failed'],
    default: 'pending'
  },
  // Extracted data from each source
  extractedData: {
    resume: { type: mongoose.Schema.Types.Mixed, default: null },
    github: { type: mongoose.Schema.Types.Mixed, default: null },
    portfolio: { type: mongoose.Schema.Types.Mixed, default: null },
    leetcode: { type: mongoose.Schema.Types.Mixed, default: null },
    gfg: { type: mongoose.Schema.Types.Mixed, default: null },
    linkedin: { type: mongoose.Schema.Types.Mixed, default: null },
    figma: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  // Structured evidence after normalization
  structuredEvidence: {
    claimedSkills: [String],
    claimedTechnologies: [String],
    claimedProjects: [{ name: String, description: String, technologies: [String], source: String }],
    observedProjects: [{ name: String, description: String, technologies: [String], source: String, url: String, isForked: Boolean, ownershipConfidence: String }],
    observedTechnologies: [{ tech: String, sources: [String], evidence: String }],
    codingEvidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    activityEvidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    ownershipEvidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    crossSourceConsistency: { type: mongoose.Schema.Types.Mixed, default: {} },
    missingSources: [String],
    potentialMismatches: [{ claim: String, issue: String, detail: String }]
  },
  // Claim validation results
  claimValidation: [claimEvidenceSchema],
  // Scores
  scores: {
    overall: { type: Number, default: 0 },
    technicalSkills: { score: Number, explanation: String, details: mongoose.Schema.Types.Mixed },
    projectQuality: { score: Number, explanation: String, details: mongoose.Schema.Types.Mixed },
    practicalImplementation: { score: Number, explanation: String, details: mongoose.Schema.Types.Mixed },
    codingActivity: { score: Number, explanation: String, details: mongoose.Schema.Types.Mixed },
    roleFit: { score: Number, explanation: String, details: mongoose.Schema.Types.Mixed },
    crossSourceConsistency: { score: Number, explanation: String, details: mongoose.Schema.Types.Mixed },
    ownershipAuthenticity: { score: Number, explanation: String, details: mongoose.Schema.Types.Mixed }
  },
  // Role analysis
  roleAnalysis: {
    targetRole: String,
    roleFitScore: Number,
    strengths: [String],
    gaps: [String],
    mismatches: [String],
    suggestedRoles: [{ role: String, fitScore: Number, reason: String }]
  },
  // Recommendations
  recommendations: {
    courses: [{ title: String, reason: String, gap: String, url: String }],
    projects: [{ title: String, description: String, technologies: [String], reason: String, skillsToDemo: [String] }],
    improvements: [String]
  },
  // Roadmap
  roadmap: {
    currentReadiness: Number,
    steps: [{
      action: String,
      reason: String,
      priority: String,
      estimatedImpact: Number
    }],
    estimatedReadinessAfter: Number,
    summary: String
  },
  // Source-Specific Plain Text Representations (Separated)
  sourceTexts: {
    resumeText: { type: String, default: '' },
    githubText: { type: String, default: '' },
    linkedinText: { type: String, default: '' },
    leetcodeText: { type: String, default: '' },
    portfolioText: { type: String, default: '' },
    otherSourcesText: { type: String, default: '' }
  },
  // Personalized Deep Analysis & YouTube Learning Resources
  overallProfile: { type: String, default: null },
  alreadyStrongIn: [String],
  scoreExplanation: { type: String, default: null },
  nextBestAction: { type: String, default: null },
  personSpecificGaps: [{ type: mongoose.Schema.Types.Mixed }],
  learningRecommendations: [{ type: mongoose.Schema.Types.Mixed }],
  roadmapMilestones: [{ type: mongoose.Schema.Types.Mixed }],
  finalLearningSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
  recommendationObject: { type: mongoose.Schema.Types.Mixed, default: null },
  skillAnalysis: [{ type: mongoose.Schema.Types.Mixed }],
  projectAnalysis: [{ type: mongoose.Schema.Types.Mixed }],
  codingAnalysis: { type: mongoose.Schema.Types.Mixed, default: {} },
  crossSourceConsistencyData: { type: mongoose.Schema.Types.Mixed, default: {} },
  bestFitRoles: [{ type: mongoose.Schema.Types.Mixed }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

analysisSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Analysis', analysisSchema);
