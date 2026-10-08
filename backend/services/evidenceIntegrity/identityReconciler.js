const { generateJson } = require('../aiProvider');

/**
 * Multi-Source Identity Matching and Reconciliation
 * 
 * Performs deterministic matching first (name normalization, initials, bio links, portfolio cross-links),
 * followed by semantic AI reconciliation.
 */

async function reconcileIdentities(extractedData = {}) {
  const resume = extractedData.resume || {};
  const github = extractedData.github || {};
  const linkedin = extractedData.linkedin || {};
  const leetcode = extractedData.leetcode || {};
  const portfolio = extractedData.portfolio || {};

  const profiles = {
    resumeName: resume.name || resume.personal?.name || '',
    resumeEmail: resume.email || resume.personal?.email || '',
    resumeLinks: resume.links || resume.personal?.links || {},
    githubUsername: github.username || '',
    githubName: github.name || '',
    githubBio: github.bio || '',
    linkedinName: linkedin.name || linkedin.fullName || '',
    leetcodeUsername: leetcode.username || '',
    portfolioAuthor: portfolio.author || portfolio.title || '',
    portfolioLinks: portfolio.socialLinks || portfolio.links || []
  };

  const deterministicResults = runDeterministicIdentityMatching(profiles);

  // If deterministic matching already achieved high confidence with multiple direct signals, return early
  if (deterministicResults.confidence >= 0.85 && deterministicResults.supporting_signals.length >= 2) {
    return {
      identity_status: 'high_confidence',
      confidence: deterministicResults.confidence,
      supporting_signals: deterministicResults.supporting_signals,
      conflicting_signals: deterministicResults.conflicting_signals,
      personalized_explanation: deterministicResults.explanation || 'Profile identities across resume, GitHub, and connected accounts demonstrate strong cross-platform linkage.',
      recommendation: ''
    };
  }

  // Otherwise, use AI for semantic identity reconciliation
  let aiResult = null;
  try {
    const prompt = `You are CareerLens Evidence Identity Verifier.
Evaluate whether the candidate profiles across multiple sources plausibly belong to the same individual.

CRITICAL RULES:
1. Do NOT say two profiles are definitely different merely because usernames or display handles differ (e.g. "nirmal-kumar" vs "NKumar" or a creative handle is common).
2. Look at combined signals: partial name matches, initials, cross-platform links, matched projects, organizations, technologies.
3. If linkage cannot be established with confidence, classify as "identity_status": "low_confidence" or "unresolved" with "Identity linkage unclear", NEVER declare an account fake.

CANDIDATE PROFILES:
- Resume Name: ${profiles.resumeName || 'Not available'}
- Resume Email: ${profiles.resumeEmail || 'Not available'}
- GitHub Username: ${profiles.githubUsername || 'Not available'}
- GitHub Display Name: ${profiles.githubName || 'Not available'}
- GitHub Bio: ${profiles.githubBio || 'Not available'}
- LinkedIn Name: ${profiles.linkedinName || 'Not available'}
- LeetCode Username: ${profiles.leetcodeUsername || 'Not available'}
- Portfolio Name: ${profiles.portfolioAuthor || 'Not available'}

DETERMINISTIC SIGNALS OBSERVED:
- Confidence: ${deterministicResults.confidence}
- Supporting signals: ${deterministicResults.supporting_signals.join('; ') || 'None'}
- Potential differences: ${deterministicResults.conflicting_signals.join('; ') || 'None'}

Return ONLY a valid JSON object matching this schema:
{
  "identity_status": "high_confidence|medium_confidence|low_confidence|unresolved",
  "confidence": <number between 0 and 1>,
  "supporting_signals": ["<signal>"],
  "conflicting_signals": ["<signal>"],
  "personalized_explanation": "<candidate-specific, encouraging explanation of identity linkage>",
  "recommendation": "<constructive advice if linkage is unclear, e.g. linking profile in bio or portfolio>"
}`;

    const { data } = await generateJson(prompt, 'Identity reconciliation');
    aiResult = data;
  } catch (err) {
    console.warn('[IdentityReconciler] AI call failed, using deterministic results:', err.message);
  }

  if (aiResult && aiResult.identity_status) {
    return {
      identity_status: aiResult.identity_status,
      confidence: Number(aiResult.confidence || deterministicResults.confidence),
      supporting_signals: aiResult.supporting_signals?.length ? aiResult.supporting_signals : deterministicResults.supporting_signals,
      conflicting_signals: aiResult.conflicting_signals || deterministicResults.conflicting_signals,
      personalized_explanation: aiResult.personalized_explanation || deterministicResults.explanation,
      recommendation: aiResult.recommendation || ''
    };
  }

  return {
    identity_status: deterministicResults.confidence >= 0.6 ? 'medium_confidence' : 'low_confidence',
    confidence: deterministicResults.confidence,
    supporting_signals: deterministicResults.supporting_signals,
    conflicting_signals: deterministicResults.conflicting_signals,
    personalized_explanation: deterministicResults.explanation,
    recommendation: deterministicResults.confidence < 0.6 ? 'Consider adding a link to your GitHub profile from your resume or portfolio to eliminate identity ambiguity.' : ''
  };
}

function runDeterministicIdentityMatching(p) {
  const supporting = [];
  const conflicting = [];
  let score = 0.5; // Neutral baseline

  const resumeNorm = normalizeString(p.resumeName);
  const ghUserNorm = normalizeString(p.githubUsername);
  const ghNameNorm = normalizeString(p.githubName);
  const liNameNorm = normalizeString(p.linkedinName);
  const lcUserNorm = normalizeString(p.leetcodeUsername);

  // 1. Direct or normalized name match
  if (resumeNorm && ghNameNorm) {
    if (resumeNorm === ghNameNorm) {
      supporting.push(`GitHub display name exactly matches resume name ('${p.githubName}')`);
      score += 0.35;
    } else if (resumeNorm.includes(ghNameNorm) || ghNameNorm.includes(resumeNorm)) {
      supporting.push(`GitHub display name closely aligns with resume name ('${p.githubName}')`);
      score += 0.25;
    }
  }

  // 2. Username similarity to resume name
  if (resumeNorm && ghUserNorm) {
    if (ghUserNorm.includes(resumeNorm) || resumeNorm.includes(ghUserNorm)) {
      supporting.push(`GitHub username '${p.githubUsername}' contains candidate name tokens`);
      score += 0.2;
    } else {
      const initials = getInitials(p.resumeName);
      if (initials && ghUserNorm.toLowerCase().startsWith(initials.toLowerCase())) {
        supporting.push(`GitHub username '${p.githubUsername}' starts with resume initials (${initials})`);
        score += 0.15;
      }
    }
  }

  // 3. LinkedIn matching
  if (resumeNorm && liNameNorm) {
    if (resumeNorm === liNameNorm || resumeNorm.includes(liNameNorm)) {
      supporting.push(`LinkedIn profile name matches resume name ('${p.linkedinName}')`);
      score += 0.25;
    }
  }

  // 4. LeetCode matching
  if (ghUserNorm && lcUserNorm && ghUserNorm === lcUserNorm) {
    supporting.push(`LeetCode username matches GitHub handle ('${p.leetcodeUsername}')`);
    score += 0.2;
  }

  // 5. Bio and cross-link matches
  const bio = (p.githubBio || '').toLowerCase();
  if (p.resumeEmail && bio.includes(p.resumeEmail.toLowerCase())) {
    supporting.push(`GitHub bio includes candidate's verified email address`);
    score += 0.3;
  }

  const boundedScore = Math.min(0.98, Math.max(0.2, score));
  let explanation = '';

  if (boundedScore >= 0.8) {
    explanation = `Candidate identity across resume (${p.resumeName || 'Resume'}), GitHub (${p.githubUsername}), and connected profiles shows strong consistent linkage.`;
  } else if (boundedScore >= 0.5) {
    explanation = `GitHub account '${p.githubUsername}' is associated with candidate profile data with consistent naming patterns.`;
  } else {
    explanation = `The GitHub username '${p.githubUsername}' differs from the name '${p.resumeName || 'on resume'}' without direct cross-link metadata. Identity linkage is treated as pending confirmation rather than disputed.`;
    conflicting.push(`Username '${p.githubUsername}' differs from resume name '${p.resumeName}'`);
  }

  return {
    confidence: Number(boundedScore.toFixed(2)),
    supporting_signals: supporting,
    conflicting_signals: conflicting,
    explanation
  };
}

function normalizeString(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getInitials(name) {
  if (!name) return '';
  return name.split(/\s+/).map(p => p[0]).join('');
}

module.exports = {
  reconcileIdentities
};
