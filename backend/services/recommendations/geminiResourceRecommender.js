const { generateJson } = require('../aiProvider');
const { searchEnglishYouTubeVideo } = require('./youtubeResourceService');

/**
 * Gemini Personalized Resource Recommender
 *
 * Recommends genuine, candidate-specific learning opportunities and English YouTube videos.
 *
 * Rules:
 * - If score < 90: Normally identify at least one meaningful learning opportunity and recommend the highest-value one.
 * - If score >= 90: Default to learning_needed: false unless a genuinely useful advanced improvement exists.
 * - Never invent fake YouTube URLs.
 */
async function generatePersonalizedRecommendation(candidateAnalysis = {}, score = 0, targetRole = 'Software Engineer', sourceTexts = {}) {
  const isHighScorer = Number(score) >= 90;

  const prompt = `You are the CareerLens personalized learning advisor.
Analyze this specific candidate and determine whether learning is actually necessary.
You have access to the candidate's complete source-separated evidence, including resume, GitHub, LinkedIn, LeetCode, portfolio, and Job Readiness Score.

Your job is NOT to produce generic career advice.
First determine the candidate's likely best-fit role and current level.
Then identify the smallest number of high-value weaknesses that materially affect that candidate's employability for that role.
Only recommend learning when the gap is genuinely valuable for THIS candidate.
Consider what the candidate already knows. Do not make the candidate restart from basics when existing evidence shows competence.

Job Readiness Score: ${score}/100
Target Role: ${targetRole || 'Software Engineer'}

Candidate Overview & Strengths:
${candidateAnalysis.overallProfile || 'Technical candidate'}
Strengths: ${(candidateAnalysis.strengths || []).join(', ') || 'Demonstrated programming fundamentals'}
Weaknesses / Gaps: ${(candidateAnalysis.gaps || []).join(', ') || 'Project depth'}

Source-separated candidate data:
${sourceTexts.resumeText || ''}
${sourceTexts.githubText || ''}
${sourceTexts.linkedinText || ''}
${sourceTexts.leetcodeText || ''}
${sourceTexts.portfolioText || ''}
${sourceTexts.otherSourcesText || ''}

RULES:
1. Never invent candidate information or fake evidence.
2. Prioritize role-relevant employability gaps. Use existing projects whenever possible.
3. For a YouTube recommendation, generate a precise English search query focused on the candidate's exact gap and current level (e.g., "React REST API integration dashboard tutorial intermediate").
4. CRITICAL: Do NOT invent YouTube URLs! Return ONLY a search_query string for our YouTube search engine.
5. SCORE RULE:
   - If score < 90: Set "learning_needed": true, identify the highest-value gap, and provide the personalized recommendation & roadmap.
   - If score >= 90:
     * If no major gap exists, set "learning_needed": false, "reason": "No major course-level gap identified at your current readiness level."
     * If an advanced topic would genuinely benefit this candidate (e.g. system design, advanced testing, cloud architecture, performance optimization), set "learning_needed": true and "recommendation_type": "optional_advancement".

Return ONLY a valid JSON object matching this schema:
{
  "learning_needed": ${isHighScorer ? 'true_or_false' : 'true'},
  "recommendation_type": "${isHighScorer ? 'optional_advancement' : 'required'}",
  "reason_for_decision": "<why a course is or is not needed at this readiness level>",
  "already_strong_in": ["<demonstrated strong technologies/skills>"],
  "gap": "<exact high-value gap title>",
  "why": "<detailed explanation of why this gap matters specifically for this candidate and target role>",
  "candidate_evidence": ["<specific evidence from resume/github/portfolio showing the gap>"],
  "learning_goal": "<what the candidate will achieve>",
  "search_query": "<precise English YouTube search query without URLs>",
  "estimated_learning_time": "<e.g. 2 hours, 1.5 hours>",
  "practical_application": "<how they will apply this to an existing or new project>",
  "other_resources": [
    {
      "title": "<documentation or tutorial title>",
      "type": "official_docs|article|practice|course",
      "url": "<authoritative official URL like https://react.dev/learn or https://developer.mozilla.org>",
      "reason": "<why this official resource is useful>",
      "estimated_time": "<e.g. 1 hour>"
    }
  ],
  "roadmap": {
    "title": "<roadmap title>",
    "objective": "<overall roadmap objective>",
    "estimated_total_time": "<e.g. 5-8 hours>",
    "steps": [
      {
        "step": 1,
        "title": "<step title>",
        "purpose": "<step purpose>",
        "tasks": [
          {
            "task": "<concrete actionable task>",
            "estimated_time": "<e.g. 1h 30m, 2 hours>",
            "completion_criteria": "<observable proof of work or deployed feature>"
          }
        ],
        "milestone": "<milestone deliverable>"
      }
    ],
    "expected_result": "<what the candidate will be able to demonstrate afterwards>",
    "next_action": "<single immediate highest-value next action>"
  }
}`;

  let recommendationData = null;

  try {
    const { data } = await generateJson(prompt, 'Gemini Resource Recommender');
    if (data && typeof data === 'object') {
      recommendationData = data;
    }
  } catch (err) {
    console.warn('[GeminiResourceRecommender] AI recommendation call warning:', err.message);
  }

  // Fallback if AI call failed
  if (!recommendationData) {
    recommendationData = buildDeterministicRecommendation(candidateAnalysis, score, targetRole);
  }

  // If learning is needed, search YouTube for real English video
  if (recommendationData.learning_needed !== false && recommendationData.search_query) {
    const ytResult = await searchEnglishYouTubeVideo(recommendationData.search_query, recommendationData.gap);
    recommendationData.youtube = ytResult;
  } else if (recommendationData.learning_needed === false) {
    recommendationData.youtube = null;
  }

  return recommendationData;
}

function buildDeterministicRecommendation(candidateAnalysis, score, targetRole) {
  const isHighScorer = Number(score) >= 90;

  if (isHighScorer) {
    return {
      learning_needed: false,
      recommendation_type: 'optional_advancement',
      reason_for_decision: 'No major course-level gap identified at your current readiness level.',
      already_strong_in: candidateAnalysis.strengths || ['Demonstrated core technical competencies'],
      gap: 'Advanced System Architecture & Cloud Optimization',
      why: 'Your readiness score is 90+. Focus on advanced system design and interview execution.',
      learning_goal: 'Refine production architecture and performance optimization.',
      search_query: 'System design full course intermediate English',
      estimated_learning_time: '2 hours',
      practical_application: 'Review high-level architectural patterns for your existing projects.',
      other_resources: [
        {
          title: 'System Design Primer',
          type: 'practice',
          url: 'https://github.com/donnemartin/system-design-primer',
          reason: 'Comprehensive guide to large-scale system design',
          estimated_time: '3 hours'
        }
      ],
      roadmap: {
        title: 'Advanced System Readiness',
        objective: 'Prepare for senior engineering discussions and system scalability',
        estimated_total_time: '4 hours',
        steps: [
          {
            step: 1,
            title: 'System Scalability Review',
            purpose: 'Analyze bottlenecks in current projects',
            tasks: [
              {
                task: 'Document system architecture and caching strategy for main project',
                estimated_time: '2 hours',
                completion_criteria: 'Clear architecture diagram and API spec in GitHub README'
              }
            ],
            milestone: 'Production-ready architectural documentation'
          }
        ],
        expected_result: 'Confident articulation of system design and trade-offs.',
        next_action: 'Prepare architectural walkthroughs of your top GitHub project.'
      }
    };
  }

  // Score < 90 fallback
  const firstGap = (candidateAnalysis.gaps && candidateAnalysis.gaps[0]) || 'Full-Stack Integration';
  const query = `${firstGap} project tutorial intermediate English`;

  return {
    learning_needed: true,
    recommendation_type: 'required',
    reason_for_decision: `Readiness score of ${score}/100 indicates targeted practical learning will materially improve employability.`,
    already_strong_in: candidateAnalysis.strengths || ['Programming fundamentals'],
    gap: firstGap,
    why: `Addressing ${firstGap} directly increases verified project proof for ${targetRole || 'Software Engineer'}.`,
    candidate_evidence: ['Missing verified repository evidence in target stack'],
    learning_goal: `Master ${firstGap} and implement in a deployed project`,
    search_query: query,
    estimated_learning_time: '2 hours',
    practical_application: `Build a concrete module demonstrating ${firstGap} in your existing repository.`,
    other_resources: [
      {
        title: 'MDN Web Development Documentation',
        type: 'official_docs',
        url: 'https://developer.mozilla.org',
        reason: 'Standard web API and architecture reference',
        estimated_time: '1 hour'
      }
    ],
    roadmap: {
      title: `${firstGap} Mastery Roadmap`,
      objective: `Bridge the ${firstGap} gap with verified code evidence`,
      estimated_total_time: '5 hours',
      steps: [
        {
          step: 1,
          title: `Study ${firstGap} Patterns`,
          purpose: 'Understand core integration techniques',
          tasks: [
            {
              task: `Watch targeted tutorial and complete starter code for ${firstGap}`,
              estimated_time: '2 hours',
              completion_criteria: 'Working local prototype with passing tests'
            }
          ],
          milestone: 'Local prototype complete'
        },
        {
          step: 2,
          title: 'Integrate and Deploy',
          purpose: 'Produce public repository proof',
          tasks: [
            {
              task: 'Commit implementation to GitHub and deploy live demo',
              estimated_time: '3 hours',
              completion_criteria: 'Live URL and clean README documentation'
            }
          ],
          milestone: 'Deployed feature with verified proof'
        }
      ],
      expected_result: `Verified GitHub repository proof demonstrating ${firstGap}.`,
      next_action: `Watch the recommended tutorial and start your ${firstGap} implementation.`
    }
  };
}

module.exports = {
  generatePersonalizedRecommendation
};
