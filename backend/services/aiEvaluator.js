const { generateJson } = require('./aiProvider');
const { normalizeAllSourceTexts, toCombinedPromptText } = require('./sourceTextNormalizer');
const { enrichLearningRecommendations } = require('./resourceSearchService');
const { generatePersonalizedRecommendation } = require('./recommendations/geminiResourceRecommender');
const { validateAndFormatRecommendation } = require('./recommendations/recommendationValidator');

/**
 * AI Evaluator — converts separated source evidence into clean plain-text,
 * sends it to the AI provider chain, enriches learning recommendations with real YouTube data,
 * and returns a complete, deeply personalized evaluation.
 *
 * Plain-text input ensures the AI reasons about real candidate evidence
 * rather than parsing nested JSON objects.
 */
async function evaluateStudent(structuredEvidence, targetRole, extractedData, customSourceTexts = null) {
  const sourceTexts = customSourceTexts || normalizeAllSourceTexts(extractedData);
  const plainText = toCombinedPromptText(sourceTexts, targetRole);

  let result = null;

  try {
    const prompt = buildEvaluationPrompt(plainText, targetRole);
    const { data } = await generateJson(prompt, 'Student evaluation');
    
    // Search real YouTube videos & docs for AI-generated search queries
    if (data?.learning_recommendations?.length) {
      data.learning_recommendations = await enrichLearningRecommendations(data.learning_recommendations);
    } else if (data?.learningRecommendations?.length) {
      data.learningRecommendations = await enrichLearningRecommendations(data.learningRecommendations);
    } else if (data?.recommendations?.length) {
      data.enriched_recommendations = await enrichLearningRecommendations(data.recommendations);
    }

    result = applyEvidenceAlignment(data, structuredEvidence, extractedData);
  } catch (err) {
    console.warn('AI evaluation providers failed; using deterministic evaluation:', err.message);
  }

  // Deterministic fallback when all AI providers fail
  if (!result) {
    result = applyEvidenceAlignment(
      generateDeterministicEvaluation(structuredEvidence, targetRole, extractedData),
      structuredEvidence,
      extractedData
    );

    if (result.learningRecommendations?.length) {
      result.learningRecommendations = await enrichLearningRecommendations(result.learningRecommendations);
    }
  }

  // Generate dedicated Gemini personalized recommendation & YouTube discovery based on score threshold (< 90 vs >= 90)
  try {
    const overallScore = result.scores?.overall || 0;
    const recObj = await generatePersonalizedRecommendation(result, overallScore, targetRole, sourceTexts);
    result.recommendationObject = validateAndFormatRecommendation(recObj, targetRole);
    result.learningNeeded = result.recommendationObject.learning_needed;
    if (result.recommendationObject.already_strong_in?.length) {
      result.alreadyStrongIn = result.recommendationObject.already_strong_in;
    }
    if (result.recommendationObject.youtube) {
      result.youtube = result.recommendationObject.youtube;
    }
  } catch (recErr) {
    console.warn('[AI Evaluator] Gemini recommendation call error:', recErr.message);
  }

  result.sourceTexts = sourceTexts;
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  PLAIN-TEXT INPUT BUILDER
//  Converts raw extracted data + normalized evidence into a
//  compact, human-readable text block for the AI.
// ═══════════════════════════════════════════════════════════════

function buildPlainTextInput(evidence, targetRole, extractedData) {
  const lines = [];
  const resume = extractedData.resume || {};
  const github = extractedData.github || {};
  const leetcode = extractedData.leetcode || {};
  const portfolio = extractedData.portfolio || {};

  // ── TARGET ROLE ──
  lines.push(`TARGET ROLE: ${targetRole || 'Not specified'}`);
  lines.push('');

  // ── RESUME SKILLS ──
  const allSkills = uniqueList([
    ...(resume.skills || []),
    ...(resume.languages || []),
    ...(resume.technologies || [])
  ]);
  if (allSkills.length) {
    lines.push('RESUME SKILLS:');
    lines.push(allSkills.join(', '));
    lines.push('');
  }

  // ── RESUME PROJECTS ──
  const resumeProjects = resume.projects || [];
  if (resumeProjects.length) {
    lines.push('RESUME PROJECTS:');
    for (const p of resumeProjects) {
      const techs = (p.technologies || []).join(', ');
      lines.push(`- ${p.name}${techs ? ' (' + techs + ')' : ''}${p.description ? ' — ' + p.description : ''}`);
    }
    lines.push('');
  }

  // ── GITHUB REPOSITORIES ──
  const repos = github.repositories || [];
  const originalRepos = repos.filter(r => !r.isFork);
  const forkedRepos = repos.filter(r => r.isFork);
  if (repos.length) {
    lines.push(`GITHUB REPOSITORIES (${originalRepos.length} original, ${forkedRepos.length} forks):`);
    for (const repo of originalRepos.slice(0, 20)) {
      const langs = Object.keys(repo.languages || {}).join(', ');
      lines.push(`- ${repo.name}${langs ? ' [' + langs + ']' : ''}${repo.description ? ' — ' + repo.description : ''}`);
    }
    if (forkedRepos.length) {
      lines.push(`(${forkedRepos.length} forked repos omitted from evidence)`);
    }
    lines.push('');

    // Top languages by byte count
    const topLangs = github.topLanguages || [];
    if (topLangs.length) {
      lines.push('GITHUB TOP LANGUAGES:');
      for (const l of topLangs.slice(0, 8)) {
        lines.push(`- ${l.language}: ${formatBytes(l.bytes)}`);
      }
      lines.push('');
    }
  }

  // ── CLAIM VALIDATION ──
  const claimValidation = buildClaimValidation(evidence);
  if (claimValidation.length) {
    const verified = claimValidation.filter(c => c.status === 'verified');
    const partial = claimValidation.filter(c => c.status === 'partially_supported');
    const unsupported = claimValidation.filter(c => c.status === 'requires_proof');
    const unverifiable = claimValidation.filter(c => c.status === 'not_verifiable');

    lines.push('CLAIM VALIDATION:');
    for (const c of claimValidation) {
      const label = c.status === 'verified' ? 'VERIFIED'
        : c.status === 'partially_supported' ? 'WEAK'
        : c.status === 'requires_proof' ? 'UNSUPPORTED'
        : 'NOT_VERIFIABLE';
      lines.push(`${c.skill} — ${label}`);
    }
    lines.push('');
    lines.push(`Summary: ${verified.length} verified, ${partial.length} weak, ${unsupported.length} unsupported, ${unverifiable.length} not verifiable`);
    lines.push('');

    // Evidence mapping
    const evidenced = claimValidation.filter(c => c.evidenceIn.length > 0);
    if (evidenced.length) {
      lines.push('EVIDENCE MAPPING:');
      for (const c of evidenced) {
        const repoNames = (c.evidenceDetails || [])
          .filter(d => d.source?.includes('github'))
          .map(d => d.detail)
          .join('; ');
        lines.push(`${c.skill} -> ${c.evidenceIn.join(', ')}${repoNames ? ' (' + repoNames.substring(0, 120) + ')' : ''}`);
      }
      lines.push('');
    }

    // Missing / weak areas
    const gaps = [...unsupported, ...partial];
    if (gaps.length) {
      lines.push('MISSING / WEAK AREAS:');
      for (const g of gaps) {
        const reason = g.status === 'requires_proof'
          ? `No GitHub evidence found for ${g.skill}`
          : `${g.skill} evidence is weak or limited`;
        lines.push(`- ${reason}`);
      }
      lines.push('');
    }
  }

  // ── PORTFOLIO WEBSITE ──
  if (portfolio?.plainTextSummary) {
    lines.push('── PORTFOLIO WEBSITE ──');
    lines.push(portfolio.plainTextSummary);
    lines.push('');
  } else if (portfolio?.projects?.length) {
    lines.push(`PORTFOLIO PROJECTS (${portfolio.projects.length}):`);
    for (const p of portfolio.projects) {
      const techs = (p.technologies || []).join(', ');
      lines.push(`- ${p.name}${techs ? ' (' + techs + ')' : ''}${p.description ? ' — ' + p.description : ''}`);
    }
    lines.push('');
  }

  // ── LINKEDIN SUMMARY ──
  if (extractedData.linkedin?.plainTextSummary) {
    lines.push('── LINKEDIN PROFILE ──');
    lines.push(extractedData.linkedin.plainTextSummary);
    lines.push('');
  }

  // ── CODING ACTIVITY ──
  if (leetcode.totalSolved) {
    lines.push('LEETCODE:');
    lines.push(`Total solved: ${leetcode.totalSolved} (Easy: ${leetcode.easySolved || 0}, Medium: ${leetcode.mediumSolved || 0}, Hard: ${leetcode.hardSolved || 0})`);
    if (leetcode.ranking) lines.push(`Ranking: ${leetcode.ranking}`);
    lines.push('');
  }

  // ── GITHUB ACTIVITY ──
  const recentActivity = github.recentActivity || [];
  const activeRepos = repos.filter(r => {
    const pushed = new Date(r.pushedAt);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return pushed > sixMonthsAgo;
  });
  lines.push('ACTIVITY:');
  lines.push(`GitHub account created: ${github.createdAt || 'unknown'}`);
  lines.push(`Public repos: ${github.publicRepos || repos.length}`);
  lines.push(`Repos active in last 6 months: ${activeRepos.length}`);
  lines.push(`Recent events: ${recentActivity.length}`);
  lines.push('');

  // ── AVAILABLE DATA SOURCES ──
  const available = ['Resume', 'GitHub'];
  const missing = [];
  if (leetcode?.extracted) available.push('LeetCode'); else missing.push('LeetCode');
  if (portfolio?.extracted) available.push('Portfolio'); else missing.push('Portfolio');
  if (extractedData.linkedin?.extracted) available.push('LinkedIn'); else missing.push('LinkedIn');
  if (extractedData.figma?.extracted) available.push('Figma'); else missing.push('Figma');
  if (extractedData.gfg?.extracted) available.push('GeeksforGeeks'); else missing.push('GeeksforGeeks');

  lines.push('DATA SOURCES:');
  lines.push(`Available: ${available.join(', ')}`);
  lines.push(`Not provided: ${missing.join(', ')}`);
  lines.push('(Do not penalize heavily for missing optional sources)');

  return lines.join('\n');
}

function formatBytes(bytes) {
  if (bytes > 1000000) return `${(bytes / 1000000).toFixed(1)}MB`;
  if (bytes > 1000) return `${(bytes / 1000).toFixed(1)}KB`;
  return `${bytes}B`;
}

function uniqueList(arr) {
  return [...new Set(arr.filter(Boolean).map(s => String(s).trim()).filter(s => s.length > 0))];
}

// ═══════════════════════════════════════════════════════════════
//  AI PROMPT
// ═══════════════════════════════════════════════════════════════

function buildEvaluationPrompt(plainTextInput, targetRole) {
  return `You are CareerLens, an evidence-based employability and career-readiness analyzer.

Analyze the candidate using ONLY the information provided below.
The candidate's data comes from multiple independent sources (Resume, GitHub, LinkedIn, LeetCode, Portfolio).
Treat each source separately first, then reason across sources.

STRICT INSTRUCTIONS:
1. Do not invent: skills, projects, experience, achievements, coding activity, certifications, employers, dates, links, scores, or evidence.
2. Distinguish between:
   - CLAIMS (what the candidate states in resume/profile)
   - OBSERVABLE EVIDENCE (repositories, code bytes, live demo, problem counts)
   - MISSING INFORMATION (unprovided sources or lacking proof)
   - CONFLICTING INFORMATION (inconsistencies between sources)
3. IDENTIFY ONLY VALUABLE PERSON-SPECIFIC GAPS:
   - Relevant to candidate's target role (${targetRole || 'Software Engineer'})
   - Important for employability & realistically actionable
   - Supported by candidate's actual data
   - Prefer 3-5 top high-value gaps rather than a long generic list.
4. PERSONALIZED LEARNING RECOMMENDATIONS:
   - Determine what the candidate should learn starting from their existing level (e.g., if they know Node.js/Express, build on it rather than restarting from zero).
   - CRITICAL: Do NOT invent YouTube URLs! Provide a precise search_query for our backend YouTube search engine (e.g. "React REST API integration project tutorial").
5. MEASURABLE ROADMAP:
   - Group into sequential phases/milestones with realistic time estimates ("1h 30m", "3 hours", "1 day", "3 days").
   - Every task must have an observable completion criteria (e.g. "Connect existing Express API with loading/error states").
   - Move from: EXISTING SKILL → MISSING SKILL → PRACTICE → REAL PROJECT IMPROVEMENT → JOB READINESS.
6. In skill analysis, use future-ready statuses: "pending" | "supported" | "weak" | "conflicting" | "unsupported" | "not_observable".

CANDIDATE SOURCES:
${plainTextInput}

Return ONLY a valid JSON object matching this schema:
{
  "overallProfile": "<natural summary of who this candidate is professionally>",
  "already_strong_in": ["<demonstrated strong area based on real evidence>"],
  "jobReadinessScore": <number 0-100>,
  "scoreExplanation": "<natural explanation connecting the score to current evidence and identified gaps>",
  "scoreBreakdown": {
    "technicalSkills": <number 0-100>,
    "projectStrength": <number 0-100>,
    "activity": <number 0-100>,
    "roleFit": <number 0-100>
  },
  "strengths": ["<specific strength supported by evidence>"],
  "gaps": ["<specific weakness or missing area for this candidate>"],
  "person_specific_gaps": [
    {
      "gap": "<high-value gap title>",
      "why_it_matters_for_this_candidate": "<why this matters for their target role>",
      "evidence_from_candidate": ["<exact evidence or missing signal from profile>"],
      "target_role": "${targetRole || 'Software Engineer'}",
      "priority": "high|medium|low",
      "recommended_action": "<concrete action to address gap>",
      "expected_outcome": "<expected observable improvement>",
      "supporting_sources": ["github", "portfolio", "resume"],
      "validation_status": "pending"
    }
  ],
  "learning_recommendations": [
    {
      "skill_gap": "<gap title>",
      "current_level": "beginner|intermediate|advanced",
      "learning_goal": "<what they will master>",
      "why_this_resource": "<why this learning step is optimal>",
      "search_query": "<precise search query for YouTube search engine without URL>",
      "resource_type": "youtube_video|youtube_playlist|official_docs|practice",
      "estimated_time": "<realistic time e.g. 1h 30m or 3 hours>",
      "prerequisites": ["<prerequisite skills>"],
      "completion_result": "<what they will be able to build>"
    }
  ],
  "roadmap_milestones": [
    {
      "phase": 1,
      "title": "<milestone title>",
      "goal": "<milestone goal>",
      "reason": "<why this milestone is next>",
      "tasks": [
        {
          "task": "<task action>",
          "description": "<task details building on candidate existing work>",
          "estimated_time": "<e.g. 1h 30m, 3h, 1 day>",
          "type": "learn|practice|build|improve|apply",
          "completion_criteria": "<observable proof of work or deployed feature>"
        }
      ],
      "milestone": "<milestone deliverable>",
      "estimated_total_time": "<e.g. 5 hours>",
      "completion_criteria": ["<measurable completion conditions>"]
    }
  ],
  "final_learning_summary": {
    "why_these_gaps_matter": "<personalized explanation of 3-5 top gaps>",
    "what_to_learn": "<exact concepts to learn and why>",
    "expected_improvement": "<what the candidate can demonstrate after completion>",
    "next_best_action": "<single immediate highest-value next action>"
  },
  "skillAnalysis": [
    {
      "claim": "<skill name>",
      "source": "resume|linkedin|portfolio",
      "evidenceText": "<observable evidence or none>",
      "evidenceType": "self_claimed|observable_repo|coding_platform",
      "validationStatus": "pending|supported|weak|conflicting|unsupported|not_observable",
      "strengthOfEvidence": "strong|moderate|weak|none",
      "missingProof": "<what is missing if anything>"
    }
  ],
  "projectAnalysis": [
    {
      "name": "<project name>",
      "technologies": ["<tech>"],
      "complexity": "beginner|intermediate|advanced",
      "realWorldUsefulness": "<analysis of utility/practicality>",
      "implementationDepth": "<depth of code/features>",
      "roleRelevance": "<relevance to target role>",
      "evidenceAvailable": "<links/commits/details observed>"
    }
  ],
  "codingAnalysis": {
    "summary": "<evaluation of problem solving and DSA readiness>",
    "problemCount": "<total and difficulty breakdown if available>",
    "topicsCovered": ["<topics>"],
    "languagesUsed": ["<languages>"],
    "consistency": "<evaluation of streak and consistency>",
    "relationshipToClaimedSkills": "<how coding platform activity relates to resume claims>"
  },
  "crossSourceConsistency": {
    "consistentClaims": ["<claims verified across multiple sources>"],
    "repeatedEvidence": ["<projects or skills seen in portfolio, github, and resume>"],
    "conflictingInformation": ["<contradictions if any>"],
    "unsupportedClaims": ["<claims with little or no observable support>"]
  },
  "bestFitRoles": [
    {
      "role": "<role name>",
      "fitScore": <number 0-100>,
      "whyFits": "<why this fits the candidate's current evidence>"
    }
  ],
  "recommendations": [
    {
      "type": "project|course|improvement",
      "title": "<specific recommendation tailored to candidate>",
      "reason": "<why this helps based on actual gaps>"
    }
  ],
  "roadmap": [
    {
      "priority": <number 1-5>,
      "action": "<concrete next action>",
      "milestone": "<measurable outcome>"
    }
  ],
  "nextBestAction": "<single most valuable next thing this candidate should do next>",
  "roleAnalysis": {
    "targetRole": "${targetRole || 'Not specified'}",
    "roleFitScore": <number 0-100>,
    "strengths": ["<role strengths>"],
    "gaps": ["<role gaps>"],
    "suggestedRoles": [
      {"role": "<role name>", "fitScore": <number>, "reason": "<why>"}
    ]
  }
}

Be thorough, fair, candidate-specific, and evidence-based. Return ONLY the JSON object.`;
}

// ═══════════════════════════════════════════════════════════════
//  CLAIM VALIDATION (reused by both AI and deterministic paths)
// ═══════════════════════════════════════════════════════════════

function buildClaimValidation(evidence) {
  const claimed = [...new Map([
    ...(evidence.claimedSkills || []),
    ...(evidence.claimedTechnologies || [])
  ].filter(Boolean).map(skill => [normalizeSkill(skill), skill])).values()];
  const observed = evidence.observedTechnologies || [];
  const githubUnavailable = (evidence.missingSources || []).includes('github');

  return claimed.map(skill => {
    const matches = observed.filter(item => normalizeSkill(item.tech) === normalizeSkill(skill));
    const githubMatches = matches.filter(item => (item.sources || []).includes('github'));
    const githubProjects = (evidence.observedProjects || []).filter(project => project.source === 'github');
    const matchingRepos = githubProjects.filter(project =>
      (project.technologies || []).some(technology => normalizeSkill(technology) === normalizeSkill(skill))
    );
    const sources = [...new Set(matches.flatMap(item => item.sources || []))];
    const evidenceDetails = matches.map(item => ({
      source: (item.sources || []).join(', '),
      detail: [
        item.evidence || `Observed ${item.tech} in linked evidence.`,
        matchingRepos.length ? `Found in repositories: ${matchingRepos.map(repo => repo.name).join(', ')}.` : ''
      ].filter(Boolean).join(' '),
      strength: item.strengthSignal || 'weak'
    }));
    const hasStrongEvidence = githubMatches.some(item => item.strengthSignal === 'strong');
    const status = githubUnavailable && matches.length === 0
      ? 'not_verifiable'
      : githubMatches.length === 0
        ? 'requires_proof'
        : hasStrongEvidence || sources.length > 1
          ? 'verified'
          : 'partially_supported';

    if (status === 'requires_proof') {
      const detected = [...new Set(githubProjects.flatMap(project => project.technologies || []))];
      evidenceDetails.push({
        source: 'github',
        detail: githubUnavailable
          ? 'GitHub evidence was unavailable, so this claim cannot be verified from repositories.'
          : `Not detected in ${githubProjects.length} analyzed GitHub repositories. Detected languages: ${detected.join(', ') || 'none reported'}.`,
        strength: 'weak'
      });
    }

    return {
      skill,
      claimedIn: ['resume'],
      evidenceIn: sources,
      status,
      evidenceDetails,
      proofRequested: status === 'requires_proof'
    };
  });
}

function normalizeSkill(skill) {
  return String(skill || '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

// ═══════════════════════════════════════════════════════════════
//  POST-PROCESSING: align AI output with real evidence
// ═══════════════════════════════════════════════════════════════

function applyEvidenceAlignment(evaluation, evidence, extractedData) {
  const missingGithub = (evidence.missingSources || []).includes('github') || !extractedData.github || extractedData.github.error;
  const claims = buildClaimValidation(evidence).map(claim => missingGithub && claim.status === 'requires_proof'
    ? { ...claim, status: 'not_verifiable', proofRequested: false }
    : claim);

  // Attach claim validation
  evaluation.claimValidation = claims;
  const proofClaims = claims.filter(c => c.proofRequested || c.status === 'requires_proof');

  // Map the new AI response format into the schema the frontend expects
  const ai = evaluation;

  // Build scores in the format the frontend/DB schema expects
  const techScore = ai.scoreBreakdown?.technicalSkills ?? ai.scores?.technicalSkills?.score ?? 70;
  const projScore = ai.scoreBreakdown?.projectStrength ?? ai.scores?.projectQuality?.score ?? 60;
  const activityScore = ai.scoreBreakdown?.activity ?? ai.scores?.codingActivity?.score ?? 50;
  const roleScore = ai.scoreBreakdown?.roleFit ?? ai.scores?.roleFit?.score ?? 65;
  const overallScore = ai.jobReadinessScore ?? ai.scores?.overall ?? Math.round(techScore * 0.3 + projScore * 0.25 + activityScore * 0.2 + roleScore * 0.25);

  const verifiedCount = claims.filter(c => c.status === 'verified').length;
  const partialCount = claims.filter(c => c.status === 'partially_supported').length;
  const unsupportedCount = claims.filter(c => c.status === 'requires_proof').length;

  evaluation.scores = {
    overall: overallScore,
    technicalSkills: {
      score: techScore,
      explanation: `Evaluated ${claims.length} resume skills against extracted evidence. ${verifiedCount} verified, ${partialCount} weak, ${unsupportedCount} unsupported.`,
      details: {
        awarded: `${verifiedCount} skills verified with code evidence.`,
        reduced: `${unsupportedCount} skills claimed but not found in repositories.`,
        improve: 'Add public repositories demonstrating unsupported skills.'
      }
    },
    projectQuality: {
      score: projScore,
      explanation: `Analyzed ${extractedData.github?.originalRepoCount || 0} original GitHub repositories.`,
      details: {
        awarded: `${extractedData.github?.originalRepoCount || 0} original projects found.`,
        reduced: extractedData.github?.forkedRepoCount ? `${extractedData.github.forkedRepoCount} repos are forks.` : 'Limited project documentation.',
        improve: 'Add READMEs, tests, and deploy projects to demonstrate production readiness.'
      }
    },
    practicalImplementation: {
      score: Math.round((techScore + projScore) / 2),
      explanation: 'Balance of claimed skills versus actual project implementations.',
      details: {
        awarded: 'Practical project work verified through GitHub.',
        reduced: 'Some claimed skills lack project-level evidence.',
        improve: 'Build end-to-end applications showcasing claimed technologies.'
      }
    },
    codingActivity: {
      score: activityScore,
      explanation: extractedData.leetcode?.totalSolved
        ? `LeetCode: ${extractedData.leetcode.totalSolved} solved. GitHub activity evaluated.`
        : 'GitHub activity evaluated.',
      details: {
        awarded: 'Coding profile connected and activity detected.',
        reduced: 'Activity intensity could be more consistent.',
        improve: 'Maintain weekly commit streaks and regular problem solving.'
      }
    },
    roleFit: {
      score: roleScore,
      explanation: `Evaluated alignment for: ${ai.roleAnalysis?.targetRole || extractedData.targetRole || 'Software Engineer'}.`,
      details: {
        awarded: 'Core competencies match target role requirements.',
        reduced: 'Some advanced role requirements not yet demonstrated.',
        improve: 'Focus projects on the key stack for your target role.'
      }
    },
    crossSourceConsistency: {
      score: evidence.crossSourceConsistency?.consistencyScore || 0,
      explanation: 'Compared resume claims with technologies observed in GitHub and other connected profiles.',
      details: {
        awarded: `${verifiedCount + partialCount} claims have supporting evidence.`,
        reduced: `${unsupportedCount} claims need stronger evidence.`,
        improve: 'Submit project links or proof for unsupported claims.'
      }
    },
    ownershipAuthenticity: {
      score: (extractedData.github?.forkedRepoCount || 0) > (extractedData.github?.originalRepoCount || 0) ? 60 : 90,
      explanation: `${extractedData.github?.originalRepoCount || 0} original repos vs ${extractedData.github?.forkedRepoCount || 0} forks.`,
      details: {
        awarded: 'Original commit history verified.',
        reduced: extractedData.github?.forkedRepoCount ? 'Forked repos excluded from scoring.' : 'None.',
        improve: 'Focus on building original repositories.'
      }
    }
  };

  // Role analysis
  const aiRole = ai.roleAnalysis || {};
  evaluation.roleAnalysis = {
    targetRole: aiRole.targetRole || evidence.targetRole || 'Full-Stack Developer',
    roleFitScore: aiRole.roleFitScore || roleScore,
    strengths: aiRole.strengths || ai.strengths || [],
    gaps: aiRole.gaps || ai.gaps || [],
    mismatches: claims
      .filter(c => c.status === 'requires_proof')
      .map(c => `Resume claim "${c.skill}" has no matching evidence in connected profiles.`),
    suggestedRoles: aiRole.suggestedRoles || [
      { role: aiRole.targetRole || 'Software Engineer', fitScore: roleScore, reason: 'Based on verified skills and projects.' }
    ]
  };

  // Recommendations: map AI format to DB schema format
  const aiRecs = ai.recommendations || [];
  const courses = Array.isArray(aiRecs)
    ? aiRecs.filter(r => r.type === 'course').map(r => ({ title: r.title, reason: r.reason, gap: r.reason }))
    : (aiRecs.courses || []);
  const projects = Array.isArray(aiRecs)
    ? aiRecs.filter(r => r.type === 'project').map(r => ({
        title: r.title, description: r.reason,
        technologies: [], reason: r.reason, skillsToDemo: []
      }))
    : (aiRecs.projects || []);
  const improvements = Array.isArray(aiRecs)
    ? aiRecs.filter(r => r.type === 'improvement').map(r => r.title)
    : (aiRecs.improvements || []);

  evaluation.recommendations = { courses, projects, improvements };

  // Roadmap: map AI format to DB schema format
  const aiRoadmap = ai.roadmap || [];
  const steps = Array.isArray(aiRoadmap)
    ? aiRoadmap.map(step => ({
        action: step.action,
        reason: step.milestone || '',
        priority: step.priority <= 2 ? 'high' : step.priority <= 4 ? 'medium' : 'low',
        estimatedImpact: Math.max(3, Math.min(15, 12 - (step.priority || 1) * 2))
      }))
    : (aiRoadmap.steps || []);

  evaluation.roadmap = {
    currentReadiness: overallScore,
    steps,
    estimatedReadinessAfter: Math.min(98, overallScore + Math.min(steps.length * 5, 20)),
    summary: Array.isArray(aiRoadmap)
      ? `Current readiness: ${overallScore}. Complete the ${steps.length} roadmap actions to improve your score.`
      : (aiRoadmap.summary || `Current readiness: ${overallScore}.`)
  };

  // Attach all personalized analysis sections
  evaluation.overallProfile = ai.overallProfile || 'Dedicated technical candidate with established foundational skills and demonstrated project implementations.';
  evaluation.alreadyStrongIn = Array.isArray(ai.already_strong_in) && ai.already_strong_in.length > 0
    ? ai.already_strong_in
    : (Array.isArray(ai.alreadyStrongIn) ? ai.alreadyStrongIn : (ai.strengths || []));
  evaluation.scoreExplanation = ai.scoreExplanation || `Readiness score of ${overallScore}/100 awarded based on verified repository evidence, problem solving consistency, and role alignment.`;
  evaluation.nextBestAction = ai.nextBestAction || (steps[0]?.action ? `Immediate priority: ${steps[0].action}` : 'Publish an end-to-end full-stack repository on GitHub.');

  evaluation.personSpecificGaps = Array.isArray(ai.person_specific_gaps) && ai.person_specific_gaps.length > 0
    ? ai.person_specific_gaps
    : (Array.isArray(ai.personSpecificGaps) ? ai.personSpecificGaps : proofClaims.map(c => ({
        gap: `${c.skill} implementation evidence`,
        why_it_matters_for_this_candidate: `Resume claims ${c.skill} but no public repository evidence was found to demonstrate production competence.`,
        evidence_from_candidate: [`Claimed in ${c.evidenceIn?.join(', ') || 'resume'}, but 0 matching GitHub repos`],
        target_role: evaluation.roleAnalysis.targetRole || 'Software Engineer',
        priority: 'high',
        recommended_action: `Build and deploy an application utilizing ${c.skill}`,
        expected_outcome: `Verified public repository proof for ${c.skill}`,
        supporting_sources: ['resume', 'github'],
        validation_status: 'pending'
      })));

  evaluation.learningRecommendations = Array.isArray(ai.learning_recommendations) && ai.learning_recommendations.length > 0
    ? ai.learning_recommendations
    : (Array.isArray(ai.learningRecommendations) ? ai.learningRecommendations : (Array.isArray(ai.enriched_recommendations) ? ai.enriched_recommendations : []));

  evaluation.roadmapMilestones = Array.isArray(ai.roadmap_milestones) && ai.roadmap_milestones.length > 0
    ? ai.roadmap_milestones
    : (Array.isArray(ai.roadmapMilestones) ? ai.roadmapMilestones : steps.map((s, idx) => ({
        phase: idx + 1,
        title: s.action,
        goal: s.reason || 'Address skill gap',
        reason: s.reason || 'Direct employability improvement',
        tasks: [
          {
            task: s.action,
            description: s.reason,
            estimated_time: '2-3 hours',
            type: 'build',
            completion_criteria: 'Deploy or push code to GitHub repository'
          }
        ],
        milestone: s.action,
        estimated_total_time: '3 hours',
        completion_criteria: ['Working implementation deployed with clear README']
      })));

  evaluation.finalLearningSummary = ai.final_learning_summary || ai.finalLearningSummary || {
    why_these_gaps_matter: evaluation.scoreExplanation,
    what_to_learn: (evaluation.personSpecificGaps || []).map(g => g.gap).join('; '),
    expected_improvement: `Address top gaps to improve overall readiness for ${evaluation.roleAnalysis.targetRole || 'Software Engineer'}.`,
    next_best_action: evaluation.nextBestAction
  };

  evaluation.skillAnalysis = Array.isArray(ai.skillAnalysis) && ai.skillAnalysis.length > 0
    ? ai.skillAnalysis
    : claims.map(c => ({
        claim: c.skill,
        source: (c.evidenceIn || [])[0] || 'resume',
        evidenceText: (c.evidenceDetails || []).map(d => d.detail).join('; ') || 'None',
        evidenceType: c.status === 'verified' ? 'observable_repo' : 'self_claimed',
        validationStatus: c.status === 'verified' ? 'supported' : (c.status === 'partially_supported' ? 'weak' : 'pending'),
        strengthOfEvidence: c.status === 'verified' ? 'strong' : (c.status === 'partially_supported' ? 'moderate' : 'none'),
        missingProof: c.status !== 'verified' ? `Provide a public repository with ${c.skill} code.` : ''
      }));
  evaluation.projectAnalysis = Array.isArray(ai.projectAnalysis) && ai.projectAnalysis.length > 0
    ? ai.projectAnalysis
    : (evidence.observedProjects || []).slice(0, 10).map(p => ({
        name: p.name,
        technologies: p.technologies || [],
        complexity: (p.technologies || []).length > 3 ? 'intermediate' : 'beginner',
        realWorldUsefulness: p.description || 'Public implementation',
        implementationDepth: p.isForked ? 'Forked reference' : 'Original repository',
        roleRelevance: 'Aligned with software engineering practices',
        evidenceAvailable: p.url ? `URL: ${p.url}` : 'Repository code'
      }));
  evaluation.codingAnalysis = ai.codingAnalysis || {
    summary: extractedData.leetcode?.totalSolved
      ? `Demonstrated problem solving on LeetCode with ${extractedData.leetcode.totalSolved} solved problems.`
      : 'Coding platform activity not connected or limited.',
    problemCount: extractedData.leetcode?.totalSolved ? `${extractedData.leetcode.totalSolved} total (Easy: ${extractedData.leetcode.easySolved || 0}, Medium: ${extractedData.leetcode.mediumSolved || 0}, Hard: ${extractedData.leetcode.hardSolved || 0})` : '0',
    topicsCovered: (extractedData.leetcode?.topTags || []).map(t => t.tagName || t),
    languagesUsed: (extractedData.leetcode?.languages || []).map(l => l.languageName || l),
    consistency: extractedData.leetcode?.ranking ? `Global rank ${extractedData.leetcode.ranking}` : 'Moderate activity',
    relationshipToClaimedSkills: 'Coding platform practice supports claimed algorithm fundamentals.'
  };
  evaluation.crossSourceConsistencyData = ai.crossSourceConsistency || {
    consistentClaims: claims.filter(c => c.status === 'verified').map(c => c.skill),
    repeatedEvidence: (evidence.crossSourceConsistency?.projectOverlap || []).map(p => `Project ${p} identified across resume and GitHub`),
    conflictingInformation: [],
    unsupportedClaims: claims.filter(c => c.status === 'requires_proof').map(c => c.skill)
  };
  evaluation.bestFitRoles = Array.isArray(ai.bestFitRoles) && ai.bestFitRoles.length > 0
    ? ai.bestFitRoles
    : (evaluation.roleAnalysis.suggestedRoles || []);

  // Proof requests
  evaluation.proofRequests = claims
    .filter(claim => claim.proofRequested)
    .map(claim => ({
      skill: claim.skill,
      reason: proofRequestReason(claim),
      suggestedProof: `Share a relevant GitHub project or work sample demonstrating ${claim.skill}.`
    }));

  return evaluation;
}

// ═══════════════════════════════════════════════════════════════
//  DETERMINISTIC FALLBACK (no AI needed)
// ═══════════════════════════════════════════════════════════════

function generateDeterministicEvaluation(evidence, targetRole, extractedData) {
  const claims = buildClaimValidation(evidence);
  const github = extractedData.github || {};
  const leetcode = extractedData.leetcode || {};

  const verifiedCount = claims.filter(c => c.status === 'verified').length;
  const partialCount = claims.filter(c => c.status === 'partially_supported').length;
  const unsupportedCount = claims.filter(c => c.status === 'requires_proof').length;
  const totalClaims = claims.length || 1;

  const techScore = Math.min(95, Math.round(((verifiedCount * 1.0 + partialCount * 0.5) / totalClaims) * 100));
  const projScore = github.originalRepoCount ? Math.min(90, 40 + github.originalRepoCount * 10) : 40;
  const activityScore = leetcode?.totalSolved ? Math.min(95, 30 + Math.floor(leetcode.totalSolved / 5)) : (github.originalRepoCount ? 65 : 35);
  const roleScore = targetRole ? 75 : 70;
  const overallScore = Math.round(techScore * 0.3 + projScore * 0.25 + activityScore * 0.2 + roleScore * 0.25);

  const proofClaims = claims.filter(c => c.proofRequested);

  return {
    overallProfile: `Software engineering candidate targeting ${targetRole || 'Software Engineering'} roles with ${verifiedCount} verified skill claims and ${github.originalRepoCount || 0} original public repositories.`,
    already_strong_in: claims.filter(c => c.status === 'verified').map(c => c.skill),
    jobReadinessScore: overallScore,
    scoreExplanation: `Calculated readiness score of ${overallScore}/100 across verified repository evidence (${projScore}%), technical skills (${techScore}%), activity (${activityScore}%), and role alignment (${roleScore}%).`,
    scoreBreakdown: {
      technicalSkills: techScore,
      projectStrength: projScore,
      activity: activityScore,
      roleFit: roleScore
    },
    strengths: claims.filter(c => c.status === 'verified').map(c => `${c.skill} verified with code evidence`).slice(0, 5),
    gaps: proofClaims.map(c => `No evidence for ${c.skill}`).slice(0, 5),
    claimSummary: { verified: verifiedCount, weak: partialCount, unsupported: unsupportedCount },
    person_specific_gaps: proofClaims.slice(0, 4).map(c => ({
      gap: `Missing ${c.skill} project evidence`,
      why_it_matters_for_this_candidate: `Resume lists ${c.skill}, but no matching code was detected in public repositories for ${targetRole || 'Software Engineering'}.`,
      evidence_from_candidate: [`Skill listed on resume, not found in GitHub`],
      target_role: targetRole || 'Software Engineer',
      priority: 'high',
      recommended_action: `Build a production project demonstrating ${c.skill}`,
      expected_outcome: `Demonstrated competence in ${c.skill}`,
      supporting_sources: ['resume', 'github'],
      validation_status: 'pending'
    })),
    learning_recommendations: proofClaims.slice(0, 3).map(c => ({
      skill_gap: c.skill,
      current_level: 'intermediate',
      learning_goal: `Master ${c.skill} and build an integrated project`,
      why_this_resource: `Provides hands-on implementation patterns for ${c.skill}`,
      search_query: `${c.skill} full project crash course tutorial`,
      resource_type: 'youtube_video',
      estimated_time: '2 hours',
      prerequisites: ['Basic programming fundamentals'],
      completion_result: `Working project built with ${c.skill}`
    })),
    roadmap_milestones: proofClaims.slice(0, 4).map((c, i) => ({
      phase: i + 1,
      title: `Build & Deploy ${c.skill} Feature`,
      goal: `Address missing ${c.skill} proof`,
      reason: `High priority gap for ${targetRole || 'Software Engineer'}`,
      tasks: [
        {
          task: `Complete a practical ${c.skill} tutorial and build an API/component`,
          description: `Learn core ${c.skill} design patterns`,
          estimated_time: '2 hours',
          type: 'learn',
          completion_criteria: `Working prototype using ${c.skill}`
        },
        {
          task: `Integrate ${c.skill} into existing GitHub repository`,
          description: `Add features and deploy`,
          estimated_time: '3 hours',
          type: 'build',
          completion_criteria: 'Public commit on GitHub with passing tests'
        }
      ],
      milestone: `Published ${c.skill} implementation`,
      estimated_total_time: '5 hours',
      completion_criteria: [`Deployed feature demonstrating ${c.skill}`, 'Updated documentation on GitHub']
    })),
    final_learning_summary: {
      why_these_gaps_matter: `Addressing these ${proofClaims.length} missing skill areas will strengthen your role fit for ${targetRole || 'Software Engineer'}.`,
      what_to_learn: proofClaims.map(c => c.skill).join(', '),
      expected_improvement: `Directly improves technical skills and verified project evidence.`,
      next_best_action: proofClaims[0] ? `Publish a production project showcasing ${proofClaims[0].skill}.` : 'Enhance test coverage and README documentation on current top repository.'
    },
    skillAnalysis: claims.map(c => ({
      claim: c.skill,
      source: (c.evidenceIn || [])[0] || 'resume',
      evidenceText: (c.evidenceDetails || []).map(d => d.detail).join('; ') || 'None',
      evidenceType: c.status === 'verified' ? 'observable_repo' : 'self_claimed',
      validationStatus: c.status === 'verified' ? 'supported' : (c.status === 'partially_supported' ? 'weak' : 'pending'),
      strengthOfEvidence: c.status === 'verified' ? 'strong' : (c.status === 'partially_supported' ? 'moderate' : 'none'),
      missingProof: c.status !== 'verified' ? `Provide a public repository with ${c.skill} code.` : ''
    })),
    projectAnalysis: (evidence.observedProjects || []).slice(0, 10).map(p => ({
      name: p.name,
      technologies: p.technologies || [],
      complexity: (p.technologies || []).length > 3 ? 'intermediate' : 'beginner',
      realWorldUsefulness: p.description || 'Public implementation',
      implementationDepth: p.isForked ? 'Forked reference' : 'Original repository',
      roleRelevance: 'Direct candidate project implementation',
      evidenceAvailable: p.url ? `URL: ${p.url}` : 'Code repository'
    })),
    codingAnalysis: {
      summary: leetcode.totalSolved ? `LeetCode problem solving with ${leetcode.totalSolved} solved problems.` : 'Coding activity not linked.',
      problemCount: leetcode.totalSolved ? `${leetcode.totalSolved}` : '0',
      topicsCovered: (leetcode.topTags || []).map(t => t.tagName || t),
      languagesUsed: (leetcode.languages || []).map(l => l.languageName || l),
      consistency: leetcode.ranking ? `Rank ${leetcode.ranking}` : 'Not available',
      relationshipToClaimedSkills: 'Problem solving practice reinforces algorithm fundamentals.'
    },
    crossSourceConsistency: {
      consistentClaims: claims.filter(c => c.status === 'verified').map(c => c.skill),
      repeatedEvidence: (evidence.crossSourceConsistency?.projectOverlap || []).map(p => `Project ${p} in resume & GitHub`),
      conflictingInformation: [],
      unsupportedClaims: claims.filter(c => c.status === 'requires_proof').map(c => c.skill)
    },
    bestFitRoles: [
      { role: targetRole || 'Full-Stack Engineer', fitScore: roleScore, whyFits: 'Strongest verified skill overlap with public repositories.' }
    ],
    recommendations: proofClaims.map(c => ({
      type: 'project',
      title: `Build a ${c.skill} project`,
      reason: `Resume lists ${c.skill} but no GitHub evidence was found.`
    })),
    roadmap: proofClaims.map((c, i) => ({
      priority: i + 1,
      action: `Publish a ${c.skill} project on GitHub`,
      milestone: `Deploy and add meaningful commits demonstrating ${c.skill}.`
    })),
    nextBestAction: proofClaims[0] ? `Publish a production project showcasing ${proofClaims[0].skill}.` : 'Enhance test coverage and README documentation on current top repository.',
    roleAnalysis: {
      targetRole: targetRole || 'Software Engineer',
      roleFitScore: roleScore,
      strengths: claims.filter(c => c.status === 'verified').map(c => c.skill).slice(0, 4),
      gaps: proofClaims.map(c => `${c.skill} project evidence`),
      suggestedRoles: [
        { role: targetRole || 'Full-Stack Engineer', fitScore: roleScore, reason: 'Based on verified skills.' }
      ]
    }
  };
}

function proofRequestReason(claim) {
  const otherSources = (claim.evidenceIn || []).filter(source => source !== 'github');
  return otherSources.length
    ? `The resume lists ${claim.skill}; it appears in ${otherSources.join(', ')}, but no matching GitHub repository was found.`
    : `The resume lists ${claim.skill}, but no matching GitHub repository was found.`;
}

module.exports = { evaluateStudent, generateDeterministicEvaluation, buildClaimValidation };
