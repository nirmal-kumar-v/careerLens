const { verifyGithubIntegrity } = require('./githubIntegrityVerifier');
const { reconcileIdentities } = require('./identityReconciler');
const { verifyDocumentIntegrity } = require('./documentIntegrityVerifier');

/**
 * Master Evidence Integrity & Verification Layer
 * 
 * Runs deterministic & AI-assisted integrity checks across GitHub repositories,
 * candidate identity reconciliation, document contrast/formatting, and cross-source consistency.
 */

async function verifyAllEvidenceIntegrity(extractedData = {}, resumeFilePath = null) {
  const [githubIntegrity, identityIntegrity, documentIntegrity] = await Promise.all([
    verifyGithubIntegrity(extractedData.github, extractedData.github?.username),
    reconcileIdentities(extractedData),
    verifyDocumentIntegrity(extractedData.resume, resumeFilePath)
  ]);

  // Update github repositories with enriched integrity metadata
  if (extractedData.github && githubIntegrity.repositories?.length) {
    extractedData.github.repositories = githubIntegrity.repositories;
    extractedData.github.integritySummary = githubIntegrity.integritySummary;
  }

  // Cross-source project consistency
  const crossSourceConsistency = evaluateCrossSourceConsistency(extractedData);

  const integrityReport = {
    identity: identityIntegrity,
    github: githubIntegrity.integritySummary,
    document: documentIntegrity,
    crossSource: crossSourceConsistency,
    verification_status: 'pending',
    verifiedAt: new Date().toISOString()
  };

  return {
    integrityReport,
    enrichedGithubData: extractedData.github,
    identityIntegrity,
    documentIntegrity,
    crossSourceConsistency
  };
}

function evaluateCrossSourceConsistency(extractedData = {}) {
  const resumeProjects = (extractedData.resume?.projects || []).map(p => p.name?.toLowerCase().trim()).filter(Boolean);
  const githubProjects = (extractedData.github?.repositories || []).map(r => r.name?.toLowerCase().trim()).filter(Boolean);
  const portfolioProjects = (extractedData.portfolio?.projects || []).map(p => p.name?.toLowerCase().trim()).filter(Boolean);

  const matchedProjects = [];
  portfolioProjects.forEach(p => {
    if (githubProjects.some(g => g.includes(p) || p.includes(g))) {
      matchedProjects.push(`Portfolio project '${p}' matches GitHub repository.`);
    }
  });

  resumeProjects.forEach(p => {
    if (githubProjects.some(g => g.includes(p) || p.includes(g))) {
      matchedProjects.push(`Resume project '${p}' matches GitHub repository.`);
    }
  });

  let status = 'consistent';
  let explanation = 'Project claims show healthy cross-source consistency between resume and code repositories.';

  if (matchedProjects.length === 0 && resumeProjects.length > 0 && githubProjects.length > 0) {
    status = 'minor_mismatch';
    explanation = 'Resume project names differ from GitHub repository names. This is common when repository slugs use abbreviations.';
  }

  return {
    status,
    matched_projects_count: matchedProjects.length,
    consistency_notes: matchedProjects,
    explanation,
    verification_status: 'pending'
  };
}

module.exports = {
  verifyAllEvidenceIntegrity,
  verifyGithubIntegrity,
  reconcileIdentities,
  verifyDocumentIntegrity
};
