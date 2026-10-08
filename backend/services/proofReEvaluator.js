const { generateJson } = require('./aiProvider');
const { normalizeAllSourceTexts, toCombinedPromptText } = require('./sourceTextNormalizer');
const { enrichLearningRecommendations } = require('./resourceSearchService');

/**
 * Re-evaluates an existing CareerLens report after candidate provides new claim-level proof.
 */
async function reEvaluateWithProof(previousAnalysis, newProof, targetRole = 'Software Engineer', allExtractedData = {}) {
  const previousScore = previousAnalysis?.scores?.overall || previousAnalysis?.jobReadinessScore || 70;
  const previousClaims = previousAnalysis?.claimValidation || [];
  const targetClaimName = newProof.claim;
  
  const existingClaimObj = previousClaims.find(c => 
    normalizeSkill(c.skill) === normalizeSkill(targetClaimName) ||
    c.skill?.toLowerCase() === targetClaimName?.toLowerCase()
  ) || { skill: targetClaimName, status: 'requires_proof', explanation: '' };

  const sourceTexts = normalizeAllSourceTexts(allExtractedData);
  const plainText = toCombinedPromptText(sourceTexts, targetRole);

  const prompt = `You are re-evaluating an existing CareerLens report after the candidate supplied additional proof for a specific claim.

Compare the previous report with the new evidence.

Determine whether the new evidence materially strengthens, partially supports, contradicts, or does not support the claim.

Do not invent evidence.

Do not remove valid previous evidence.

Use the new evidence only where it is relevant.

Recalculate the candidate's personalized Job Readiness Score based on the combined evidence.

Update strengths, gaps, role fit, recommendations and roadmap only when the new evidence actually changes them.

Explain naturally what changed and why.

The result must be specific to this candidate.

==================================================
PREVIOUS REPORT SUMMARY:
- Target Role: ${targetRole}
- Previous Job Readiness Score: ${previousScore}
- Target Claim Being Evaluated: ${existingClaimObj.skill}
- Previous Claim Status: ${existingClaimObj.status}
- Previous Claim Explanation: ${existingClaimObj.explanation || 'None'}
- Previous Strengths: ${(previousAnalysis?.strengths || []).join('; ') || 'None listed'}
- Previous Gaps: ${(previousAnalysis?.gaps || []).join('; ') || 'None listed'}

==================================================
COMBINED CANDIDATE EVIDENCE & USER-PROVIDED PROOF:
${plainText}

==================================================
EVALUATION RULES:
1. Target Claim Status can move:
   - "requires_proof" ("⚠ Needs Code Proof") -> "partially_supported" ("⚡ Partial Evidence")
   - "partially_supported" ("⚡ Partial Evidence") -> "supported" ("✓ Supported")
   - Or remain unchanged if the proof is not relevant or unreadable.
   - Do NOT automatically mark it "verified" if future ownership/authenticity checks are pending.
2. Score Update:
   - Return previous_score (${previousScore}), new_score, score_change, score_change_reason.
   - If the new proof genuinely reduces a gap, new_score should be higher than previous_score.
   - If the new proof does not materially improve readiness, score may remain unchanged (score_change: 0).
   - Do NOT blindly add fixed points; base it on real evidence value.
3. Return ONLY a valid JSON object matching this schema:
{
  "previous_score": ${previousScore},
  "new_score": <number 0-100>,
  "score_change": <number>,
  "score_change_reason": "<natural, personalized explanation of what changed and why>",
  "target_claim_update": {
    "skill": "${existingClaimObj.skill}",
    "previous_status": "${existingClaimObj.status}",
    "new_status": "requires_proof|partially_supported|supported",
    "updated_explanation": "<candidate-specific explanation acknowledging the new proof>",
    "proof_contribution": "<how the proof helped or what is still missing>"
  },
  "overallProfile": "<natural summary of candidate>",
  "scoreExplanation": "<updated overall score explanation>",
  "strengths": ["<strengths>"],
  "gaps": ["<gaps>"],
  "person_specific_gaps": [
    {
      "gap": "<gap title>",
      "why_it_matters_for_this_candidate": "<why this matters>",
      "evidence_from_candidate": ["<evidence>"],
      "target_role": "${targetRole}",
      "priority": "high|medium|low",
      "recommended_action": "<action>",
      "expected_outcome": "<outcome>",
      "supporting_sources": ["proof_added", "github", "portfolio"],
      "validation_status": "pending"
    }
  ],
  "learning_recommendations": [
    {
      "skill_gap": "<gap title>",
      "current_level": "beginner|intermediate|advanced",
      "learning_goal": "<goal>",
      "why_this_resource": "<reason>",
      "search_query": "<precise YouTube search query without URL>",
      "resource_type": "youtube_video|youtube_playlist|official_docs|practice",
      "estimated_time": "<e.g. 1h 30m>",
      "prerequisites": ["<prerequisite>"],
      "completion_result": "<result>"
    }
  ],
  "roadmap_milestones": [
    {
      "phase": 1,
      "title": "<milestone title>",
      "goal": "<goal>",
      "reason": "<reason>",
      "tasks": [
        {
          "task": "<task>",
          "description": "<desc>",
          "estimated_time": "<time>",
          "type": "learn|practice|build|improve|apply",
          "completion_criteria": "<criteria>"
        }
      ],
      "milestone": "<deliverable>",
      "estimated_total_time": "<time>",
      "completion_criteria": ["<criteria>"]
    }
  ]
}`;

  let aiData = null;
  try {
    const { data } = await generateJson(prompt, 'Proof re-evaluation');
    aiData = data;
  } catch (err) {
    console.warn('[ProofReEvaluator] AI provider warning, using deterministic fallback:', err.message);
  }

  // Fallback if AI call failed
  if (!aiData || typeof aiData !== 'object') {
    aiData = generateDeterministicProofEvaluation(previousAnalysis, newProof, targetRole, existingClaimObj);
  }

  // Enrich YouTube recommendations if present
  if (aiData.learning_recommendations?.length) {
    aiData.learning_recommendations = await enrichLearningRecommendations(aiData.learning_recommendations);
  } else if (aiData.learningRecommendations?.length) {
    aiData.learningRecommendations = await enrichLearningRecommendations(aiData.learningRecommendations);
  }

  // Calculate clean score delta
  const finalPrevScore = Number(aiData.previous_score ?? previousScore);
  let finalNewScore = Number(aiData.new_score ?? finalPrevScore);
  if (isNaN(finalNewScore) || finalNewScore < 0 || finalNewScore > 100) finalNewScore = finalPrevScore;
  const scoreChange = finalNewScore - finalPrevScore;

  // Build merged claim validation list
  const updatedClaimUpdate = aiData.target_claim_update || {};
  const newStatus = updatedClaimUpdate.new_status || (scoreChange > 0 ? (existingClaimObj.status === 'requires_proof' ? 'partially_supported' : 'supported') : existingClaimObj.status);
  
  const updatedClaims = previousClaims.map(c => {
    if (normalizeSkill(c.skill) === normalizeSkill(targetClaimName) || c.skill?.toLowerCase() === targetClaimName?.toLowerCase()) {
      const existingDetails = Array.isArray(c.evidenceDetails) ? [...c.evidenceDetails] : [];
      existingDetails.push({
        source: 'user_provided_proof',
        detail: `Added proof: ${newProof.type === 'file' ? newProof.fileName : newProof.source_url} (${newProof.extracted_text?.slice(0, 120) || 'Evidence supplied'})`,
        strength: 'moderate'
      });
      const existingEvidenceIn = Array.isArray(c.evidenceIn) ? [...c.evidenceIn] : ['resume'];
      if (!existingEvidenceIn.includes('user_proof')) existingEvidenceIn.push('user_proof');

      return {
        ...c,
        status: newStatus,
        explanation: updatedClaimUpdate.updated_explanation || `Updated from added proof: ${newProof.type === 'file' ? newProof.fileName : newProof.source_url}. ${updatedClaimUpdate.proof_contribution || 'Additional evidence provided.'}`,
        evidenceDetails: existingDetails,
        evidenceIn: existingEvidenceIn,
        proofSubmitted: true,
        updatedFromProof: true,
        lastProofItem: {
          type: newProof.type,
          reference: newProof.type === 'file' ? newProof.fileName : newProof.source_url,
          submittedAt: newProof.submittedAt || new Date().toISOString()
        }
      };
    }
    return c;
  });

  // Preserve previous scores and update overall + technical
  const prevScores = previousAnalysis?.scores || {};
  const updatedScores = {
    ...prevScores,
    overall: finalNewScore,
    technicalSkills: {
      score: Math.min(100, (prevScores.technicalSkills?.score || finalPrevScore) + (scoreChange > 0 ? Math.round(scoreChange * 0.8) : 0)),
      explanation: prevScores.technicalSkills?.explanation || 'Technical skills assessment updated with proof.',
      details: prevScores.technicalSkills?.details || {}
    }
  };

  return {
    previous_score: finalPrevScore,
    new_score: finalNewScore,
    score_change: scoreChange,
    score_change_reason: aiData.score_change_reason || `The added proof for '${targetClaimName}' (${newProof.type === 'file' ? newProof.fileName : newProof.source_url}) provides supporting evidence, reducing the claim gap.`,
    updated_claim: {
      skill: targetClaimName,
      previous_status: existingClaimObj.status,
      new_status: newStatus,
      explanation: updatedClaimUpdate.updated_explanation || `Updated based on supplied proof for ${targetClaimName}.`,
      added_proof: newProof.type === 'file' ? newProof.fileName : newProof.source_url
    },
    scores: updatedScores,
    claimValidation: updatedClaims,
    overallProfile: aiData.overallProfile || previousAnalysis?.overallProfile,
    scoreExplanation: aiData.scoreExplanation || previousAnalysis?.scoreExplanation,
    strengths: aiData.strengths || previousAnalysis?.strengths,
    gaps: aiData.gaps || previousAnalysis?.gaps,
    personSpecificGaps: aiData.person_specific_gaps || previousAnalysis?.personSpecificGaps || [],
    learningRecommendations: aiData.learning_recommendations || aiData.learningRecommendations || previousAnalysis?.learningRecommendations || [],
    roadmapMilestones: aiData.roadmap_milestones || aiData.roadmapMilestones || previousAnalysis?.roadmapMilestones || [],
    finalLearningSummary: aiData.final_learning_summary || previousAnalysis?.finalLearningSummary || {},
    updatedFromProof: true,
    latestProof: newProof,
    sourceTexts
  };
}

function generateDeterministicProofEvaluation(previousAnalysis, newProof, targetRole, existingClaimObj) {
  const prevScore = previousAnalysis?.scores?.overall || 72;
  const proofText = (newProof.extracted_text || '').toLowerCase();
  const claimLower = (newProof.claim || '').toLowerCase();

  const isRelevant = proofText.includes(claimLower) ||
    proofText.length > 50 ||
    ['github', 'leetcode', 'certificate', 'project', 'solved', 'rank', 'repository'].some(k => proofText.includes(k));

  let scoreBoost = 0;
  let newStatus = existingClaimObj.status;
  let reason = '';

  if (isRelevant) {
    if (existingClaimObj.status === 'requires_proof') {
      newStatus = 'partially_supported';
      scoreBoost = 4;
      reason = `The added proof provides direct support for the candidate's '${newProof.claim}' claim, reducing a previously identified evidence gap.`;
    } else if (existingClaimObj.status === 'partially_supported') {
      newStatus = 'supported';
      scoreBoost = 3;
      reason = `The added proof reinforces candidate's '${newProof.claim}' claim with observable implementation artifacts, upgrading claim support.`;
    } else {
      scoreBoost = 1;
      reason = `The supplementary proof adds further context for '${newProof.claim}'.`;
    }
  } else {
    reason = `The added proof was reviewed but did not provide sufficient verifiable signals for '${newProof.claim}'. Score remains unchanged.`;
  }

  const newScore = Math.min(100, prevScore + scoreBoost);

  return {
    previous_score: prevScore,
    new_score: newScore,
    score_change: scoreBoost,
    score_change_reason: reason,
    target_claim_update: {
      skill: newProof.claim,
      previous_status: existingClaimObj.status,
      new_status: newStatus,
      updated_explanation: `Candidate supplied evidence (${newProof.type === 'file' ? newProof.fileName : newProof.source_url}) supporting '${newProof.claim}'. Verification status: user_provided_evidence (pending).`,
      proof_contribution: isRelevant ? 'Strengthens claim confidence' : 'Insufficient context'
    },
    overallProfile: previousAnalysis?.overallProfile,
    scoreExplanation: `Updated Readiness Score: ${newScore}/100. ${reason}`,
    strengths: previousAnalysis?.strengths,
    gaps: (previousAnalysis?.gaps || []).filter(g => !g.toLowerCase().includes(claimLower))
  };
}

function normalizeSkill(skill) {
  return String(skill || '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

module.exports = {
  reEvaluateWithProof
};
