const { getMongoStatus } = require('../config/mongodb');
const { getPool, getPgStatus } = require('../config/postgresql');

function requirePgPool() {
  if (!getPgStatus()) throw new Error('PostgreSQL is not connected; primary data write failed');
  return getPool();
}

/**
 * PostgreSQL is the primary persistence target; existing MongoDB retrieval remains intact.
 */

async function saveToPg(table, data) {
  if (!getPgStatus()) throw new Error('PostgreSQL is not connected; data was not persisted');
  const pool = getPool();
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING RETURNING *`;
  try {
    const result = await pool.query(query, vals);
    return result.rows[0];
  } catch (err) {
    console.warn(`PG save to ${table} failed:`, err.message);
    throw err;
  }
}

async function updateInPg(table, conditions, data) {
  if (!getPgStatus()) throw new Error('PostgreSQL is not connected; data was not persisted');
  const pool = getPool();
  const setClauses = [];
  const vals = [];
  let paramIndex = 1;

  Object.entries(data).forEach(([key, val]) => {
    setClauses.push(`${key} = $${paramIndex}`);
    vals.push(typeof val === 'object' ? JSON.stringify(val) : val);
    paramIndex++;
  });

  const whereClauses = [];
  Object.entries(conditions).forEach(([key, val]) => {
    whereClauses.push(`${key} = $${paramIndex}`);
    vals.push(val);
    paramIndex++;
  });

  const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
  try {
    const result = await pool.query(query, vals);
    return result.rowCount;
  } catch (err) {
    console.warn(`PG update ${table} failed:`, err.message);
    throw err;
  }
}

async function findInPg(table, conditions) {
  if (!getPgStatus()) return null;
  const pool = getPool();
  if (!pool) return null;
  const whereClauses = [];
  const vals = [];
  let paramIndex = 1;

  Object.entries(conditions).forEach(([key, val]) => {
    whereClauses.push(`${key} = $${paramIndex}`);
    vals.push(val);
    paramIndex++;
  });

  const query = `SELECT * FROM ${table} WHERE ${whereClauses.join(' AND ')} LIMIT 1`;
  try {
    const result = await pool.query(query, vals);
    return result.rows[0] || null;
  } catch (err) {
    console.warn(`PG find in ${table} failed:`, err.message);
    return null;
  }
}

async function listInPg(table, conditions = {}) {
  if (!getPgStatus()) return null;
  const pool = getPool();
  if (!pool) return null;
  const whereClauses = [];
  const vals = [];
  Object.entries(conditions).forEach(([key, val], index) => {
    whereClauses.push(`${key} = $${index + 1}`);
    vals.push(val);
  });
  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const query = `SELECT * FROM ${table} ${where} ORDER BY created_at DESC`;
  try {
    const result = await pool.query(query, vals);
    return result.rows;
  } catch (err) {
    console.warn(`PG list from ${table} failed:`, err.message);
    return null;
  }
}

// Persist the primary user record before mirroring it to MongoDB.
async function syncUserToPg(user) {
  if (!getPgStatus()) return null;
  const data = {
    mongo_id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    password_hash: user.password,
    reg_no: user.regNo || null,
    institution_name: user.institutionName || null,
    institution_code: user.institutionCode || null
  };
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const updates = cols.filter(col => col !== 'mongo_id').map(col => `${col} = EXCLUDED.${col}`).join(', ');
  const query = `INSERT INTO users (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (mongo_id) DO UPDATE SET ${updates} RETURNING *`;
  try {
    const result = await requirePgPool().query(query, vals);
    return result.rows[0] || null;
  } catch (err) {
    console.warn(`PostgreSQL user sync warning for ${user.email}:`, err.message);
    return null;
  }
}

// Sync student profile to PostgreSQL
async function syncProfileToPg(profile) {
  if (!getPgStatus()) return null;
  const profileData = typeof profile.toObject === 'function' ? profile.toObject() : profile;
  const data = { user_id: profileData.userId.toString() };
  const columns = {
    resumePath: 'resume_path',
    githubUrl: 'github_url',
    portfolioUrl: 'portfolio_url',
    leetcodeUrl: 'leetcode_url',
    gfgUrl: 'gfg_url',
    linkedinUrl: 'linkedin_url',
    linkedinPdfPath: 'linkedin_pdf_path',
    figmaUrl: 'figma_url',
    targetRole: 'target_role',
    placementCellId: 'placement_cell_id',
    approvalStatus: 'approval_status'
  };

  Object.entries(columns).forEach(([source, destination]) => {
    if (!Object.hasOwn(profileData, source) || profileData[source] === undefined) return;
    const value = profileData[source];
    data[destination] = value === '' || value === null
      ? null
      : source === 'placementCellId'
        ? value.toString()
        : value;
  });

  const cols = Object.keys(data);
  const vals = Object.values(data);
  const updates = cols.filter(col => col !== 'user_id').map(col => `${col} = EXCLUDED.${col}`).join(', ');
  const updateClause = updates ? `${updates}, ` : '';
  const query = `INSERT INTO student_profiles (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (user_id) DO UPDATE SET ${updateClause}updated_at = NOW() RETURNING *`;
  try {
    const result = await requirePgPool().query(query, vals);
    return result.rows[0] || null;
  } catch (err) {
    console.warn(`PostgreSQL profile sync warning for ${data.user_id}:`, err.message);
    return null;
  }
}

// Sync analysis to PostgreSQL
async function syncAnalysisToPg(analysis) {
  if (!getPgStatus()) return null;
  const recsObj = {
    ...(analysis.recommendations || {}),
    recommendationObject: analysis.recommendationObject || null,
    personSpecificGaps: analysis.personSpecificGaps || [],
    learningRecommendations: analysis.learningRecommendations || [],
    roadmapMilestones: analysis.roadmapMilestones || [],
    finalLearningSummary: analysis.finalLearningSummary || {},
    alreadyStrongIn: analysis.alreadyStrongIn || [],
    overallProfile: analysis.overallProfile || '',
    scoreExplanation: analysis.scoreExplanation || '',
    nextBestAction: analysis.nextBestAction || '',
    sourceTexts: analysis.sourceTexts || {}
  };

  const data = {
    mongo_id: analysis._id.toString(),
    student_id: analysis.studentId.toString(),
    analysis_data: JSON.stringify({
      ...(analysis.extractedData || {}),
      sourceTexts: analysis.sourceTexts || {},
      recommendationObject: analysis.recommendationObject || null,
      personSpecificGaps: analysis.personSpecificGaps || [],
      learningRecommendations: analysis.learningRecommendations || [],
      roadmapMilestones: analysis.roadmapMilestones || [],
      finalLearningSummary: analysis.finalLearningSummary || {},
      alreadyStrongIn: analysis.alreadyStrongIn || [],
      overallProfile: analysis.overallProfile || '',
      scoreExplanation: analysis.scoreExplanation || '',
      nextBestAction: analysis.nextBestAction || ''
    }),
    structured_evidence: JSON.stringify(analysis.structuredEvidence || {}),
    claim_validation: JSON.stringify(analysis.claimValidation || []),
    scores: JSON.stringify(analysis.scores || {}),
    role_analysis: JSON.stringify(analysis.roleAnalysis || {}),
    recommendations: JSON.stringify(recsObj),
    roadmap: JSON.stringify(analysis.roadmap || {}),
    status: analysis.status
  };
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const updates = cols.filter(col => col !== 'mongo_id').map(col => `${col} = EXCLUDED.${col}`).join(', ');
  const query = `INSERT INTO analyses (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (mongo_id) DO UPDATE SET ${updates}, updated_at = NOW() RETURNING *`;
  try {
    const result = await requirePgPool().query(query, vals);
    return result.rows[0] || null;
  } catch (err) {
    console.warn(`PostgreSQL analysis sync warning for ${data.mongo_id}:`, err.message);
    return null;
  }
}

async function syncProofToPg(submission) {
  if (!getPgStatus()) return null;
  const data = {
    mongo_id: submission._id.toString(),
    analysis_id: submission.analysisId.toString(),
    student_id: submission.studentId.toString(),
    claim: submission.claim,
    proof_type: submission.proofType,
    proof_data: submission.proofData || '',
    file_path: submission.filePath || null,
    status: submission.status,
    review_result: JSON.stringify(submission.reviewResult || {})
  };
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const updates = cols.filter(col => col !== 'mongo_id').map(col => `${col} = EXCLUDED.${col}`).join(', ');
  const query = `INSERT INTO proof_submissions (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (mongo_id) DO UPDATE SET ${updates} RETURNING *`;
  try {
    const result = await requirePgPool().query(query, vals);
    return result.rows[0] || null;
  } catch (err) {
    console.warn(`PostgreSQL proof sync warning for ${data.mongo_id}:`, err.message);
    return null;
  }
}

module.exports = {
  saveToPg,
  updateInPg,
  findInPg,
  listInPg,
  syncUserToPg,
  syncProfileToPg,
  syncAnalysisToPg,
  syncProofToPg
};
