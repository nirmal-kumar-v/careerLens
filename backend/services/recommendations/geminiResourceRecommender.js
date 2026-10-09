const { generateJson } = require('../aiProvider');
const { searchEnglishYouTubeVideo } = require('./youtubeResourceService');
const { searchRealBook } = require('./bookResourceService');
const { generateInternshipRecommendation, generateHackathonRecommendation } = require('./domainResourceService');

/**
 * Gemini Personalized Resource Recommender
 *
 * Recommends genuine, candidate-specific learning opportunities:
 * 1. Courses (YouTube search with real videos)
 * 2. General recommendations (strengths, gaps, actionable next steps)
 * 3. Internships (domain recommendations with verified Unstop search URLs)
 * 4. Books (real book search with Open Library / Google Books metadata and thumbnails)
 * 5. Hackathons (category recommendations with verified Unstop search URLs)
 */
async function generatePersonalizedRecommendation(candidateAnalysis = {}, score = 0, targetRole = 'Software Engineer', sourceTexts = {}) {
  const isHighScorer = Number(score) >= 90;

  const prompt = `You are the CareerLens personalized learning advisor.
Analyze this specific candidate and determine actionable, personalized recommendations across 5 categories:
1. Course / Video tutorial
2. General career & gap recommendations
3. Internship domains (e.g. Full Stack Development, AI/ML, Frontend, Backend, Cybersecurity, Cloud/DevOps, Data Analytics)
4. Technical Books (e.g. System Design, Clean Code, Designing Data-Intensive Applications, Eloquent JavaScript)
5. Hackathon categories (e.g. AI/ML, Full Stack Web, FinTech, Open Innovation, Cloud)

You have access to the candidate's complete source-separated evidence:
- Job Readiness Score: ${score}/100
- Target Role: ${targetRole || 'Software Engineer'}
- Candidate Overview & Strengths: ${candidateAnalysis.overallProfile || 'Technical candidate'}
- Strengths: ${(candidateAnalysis.strengths || []).join(', ') || 'Demonstrated programming fundamentals'}
- Weaknesses / Gaps: ${(candidateAnalysis.gaps || []).join(', ') || 'Project depth'}

Source-separated candidate data:
${sourceTexts.resumeText || ''}
${sourceTexts.githubText || ''}
${sourceTexts.linkedinText || ''}
${sourceTexts.leetcodeText || ''}
${sourceTexts.portfolioText || ''}
${sourceTexts.otherSourcesText || ''}

RULES:
1. Never invent candidate information, fake evidence, or fake URLs.
2. For YouTube, return a precise English search query (e.g. "React REST API integration dashboard tutorial intermediate").
3. For Books, return a real known book search query (e.g. "Designing Data-Intensive Applications" or "System Design Interview Alex Xu" or "Clean Code") tailored to the candidate's specific gap or target role.
4. For Internships, identify 1-2 high-value internship domains most beneficial for THIS candidate.
5. For Hackathons, identify 1-2 hackathon categories where THIS candidate can build and demonstrate evidence.
6. ROADMAP REQUIREMENTS:
   - Generate candidate-specific roadmap steps building directly on what THIS candidate already knows and has built in their GitHub repositories/portfolio.
   - Do NOT give generic instructions like "Build a project" or "Working implementation deployed with documentation".
   - Each step and task must include "why_for_this_candidate", specific "task" instructions, "completion_criteria", and concrete "proof_of_work_outcome" (e.g. "Your existing full-stack project should demonstrate a React frontend consuming your existing Express API, with JWT authentication, loading/error handling, and a deployed live demo URL.").

Return ONLY a valid JSON object matching this schema:
{
  "learning_needed": ${isHighScorer ? 'true_or_false' : 'true'},
  "recommendation_type": "${isHighScorer ? 'optional_advancement' : 'required'}",
  "reason_for_decision": "<why this learning direction is chosen>",
  "already_strong_in": ["<demonstrated strong technologies/skills>"],
  "gap": "<exact high-value gap title>",
  "why": "<detailed explanation of why this gap matters specifically for this candidate and target role>",
  "candidate_evidence": ["<specific evidence from resume/github/portfolio showing the gap>"],
  "learning_goal": "<what the candidate will achieve>",
  "search_query": "<precise English YouTube search query without URLs>",
  "estimated_learning_time": "<e.g. 2 hours, 1.5 hours>",
  "practical_application": "<how they will apply this to an existing or new project>",
  "internships": [
    {
      "domain": "<recommended internship domain e.g. Full Stack Development, AI/ML, Backend Engineering>",
      "why_recommended": "<personalized reason explaining why this internship domain is relevant for this candidate>",
      "best_suited_for": "<target role or stack e.g. Full Stack Engineer / Web Developer>"
    }
  ],
  "books": [
    {
      "search_query": "<real book title e.g. Designing Data-Intensive Applications, Clean Code, System Design Interview>",
      "why_it_helps": "<why reading this specific book directly helps this candidate address their technical gaps>",
      "target_topic": "<e.g. System Scalability, Software Architecture, DSA>"
    }
  ],
  "hackathons": [
    {
      "category": "<hackathon category e.g. Full Stack Web Innovation, AI & Machine Learning, Open Source>",
      "why_fits_you": "<personalized explanation of why this hackathon category fits this candidate>",
      "what_you_could_demonstrate": "<concrete proof or project capability they can showcase>"
    }
  ],
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
        "why_for_this_candidate": "<why this step is assigned to this candidate based on their existing work>",
        "purpose": "<step purpose>",
        "tasks": [
          {
            "task": "<concrete actionable task building on candidate existing skills/projects>",
            "why_for_this_candidate": "<why this task fits this candidate>",
            "estimated_time": "<e.g. 1h 30m, 2 hours>",
            "completion_criteria": "<observable proof of work or deployed feature>",
            "proof_of_work_outcome": "<concrete deliverable candidate should produce>"
          }
        ],
        "milestone": "<milestone deliverable>",
        "proof_of_work_outcome": "<concrete candidate-specific proof deliverable>"
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

  // 1. YouTube Course Enrichment
  if (recommendationData.learning_needed !== false && recommendationData.search_query) {
    const ytResult = await searchEnglishYouTubeVideo(recommendationData.search_query, recommendationData.gap);
    recommendationData.youtube = ytResult;
  } else if (recommendationData.learning_needed === false) {
    recommendationData.youtube = null;
  }

  // 2. Books Enrichment with Real Metadata
  const rawBooks = Array.isArray(recommendationData.books) && recommendationData.books.length > 0
    ? recommendationData.books
    : (recommendationData.gap ? [{
        search_query: selectDeterministicBookQuery(recommendationData.gap, targetRole),
        why_it_helps: `Deepens architectural mastery and practical patterns in ${recommendationData.gap}.`,
        target_topic: recommendationData.gap
      }] : []);

  const enrichedBooks = [];
  for (const b of rawBooks.slice(0, 3)) {
    const bookQuery = b.search_query || b.title || b.target_topic;
    if (bookQuery) {
      const realBook = await searchRealBook(bookQuery);
      if (realBook) {
        enrichedBooks.push({
          ...realBook,
          why_it_helps: b.why_it_helps || `Strengthens core technical reasoning and engineering standards for ${targetRole}.`,
          target_topic: b.target_topic || recommendationData.gap || 'Software Engineering'
        });
      }
    }
  }
  recommendationData.books = enrichedBooks;

  // 3. Internships Enrichment with Real Search URLs
  const rawInternships = Array.isArray(recommendationData.internships) && recommendationData.internships.length > 0
    ? recommendationData.internships
    : [{
        domain: targetRole || 'Full Stack Web Development',
        why_recommended: `Applying for ${targetRole || 'Full Stack'} internships provides tangible production repository proof and team collaboration evidence.`,
        best_suited_for: targetRole || 'Software Development Engineer'
      }];

  recommendationData.internships = rawInternships.map(item => 
    generateInternshipRecommendation(item.domain, item.why_recommended, item.best_suited_for)
  );

  // 4. Hackathons Enrichment with Real Search URLs
  const rawHackathons = Array.isArray(recommendationData.hackathons) && recommendationData.hackathons.length > 0
    ? recommendationData.hackathons
    : [{
        category: targetRole?.toLowerCase().includes('ai') ? 'AI & Machine Learning' : 'Full Stack Web Innovation',
        why_fits_you: `Competing in ${targetRole?.toLowerCase().includes('ai') ? 'AI' : 'Full Stack'} hackathons lets you showcase end-to-end prototype velocity and live product deployment.`,
        what_you_could_demonstrate: 'Build and deploy a full working project from scratch within a timed sprint.'
      }];

  recommendationData.hackathons = rawHackathons.map(item =>
    generateHackathonRecommendation(item.category, item.why_fits_you, item.what_you_could_demonstrate)
  );

  // 5. Structure separate collections for unified consumption
  recommendationData.courses = recommendationData.youtube ? [{
    skill_gap: recommendationData.gap,
    learning_goal: recommendationData.learning_goal,
    why_this_resource: recommendationData.why,
    estimated_time: recommendationData.estimated_learning_time || '2 hours',
    youtube_resource: recommendationData.youtube,
    authoritative_doc: recommendationData.other_resources?.[0] || null
  }] : [];

  recommendationData.general_recommendations = {
    overviewProfile: candidateAnalysis.overallProfile || '',
    alreadyStrongIn: recommendationData.already_strong_in || candidateAnalysis.strengths || [],
    nextBestAction: recommendationData.roadmap?.next_action || '',
    gap: recommendationData.gap,
    why: recommendationData.why,
    gaps: candidateAnalysis.gaps || [],
    improvements: recommendationData.other_resources || []
  };

  return recommendationData;
}

function selectDeterministicBookQuery(gap = '', targetRole = '') {
  const g = `${gap} ${targetRole}`.toLowerCase();
  if (g.includes('system') || g.includes('scalab') || g.includes('architect')) {
    return 'Designing Data-Intensive Applications';
  }
  if (g.includes('dsa') || g.includes('algorithm') || g.includes('leetcode')) {
    return 'Introduction to Algorithms CLRS';
  }
  if (g.includes('react') || g.includes('front') || g.includes('javascript')) {
    return 'Eloquent JavaScript';
  }
  if (g.includes('clean') || g.includes('code') || g.includes('refactor')) {
    return 'Clean Code Robert Martin';
  }
  if (g.includes('cloud') || g.includes('devops') || g.includes('docker')) {
    return 'The DevOps Handbook';
  }
  return 'Designing Data-Intensive Applications';
}

function buildDeterministicRecommendation(candidateAnalysis = {}, score = 0, targetRole = 'Software Engineer') {
  const isHighScorer = Number(score) >= 90;
  const firstGap = (candidateAnalysis.gaps && candidateAnalysis.gaps[0]) || 'Full-Stack Integration';
  const query = `${firstGap} project tutorial intermediate English`;
  const existingProject = candidateAnalysis.projectAnalysis?.[0]?.name || (candidateAnalysis.projects?.[0]?.name);
  const strongSkills = candidateAnalysis.alreadyStrongIn || candidateAnalysis.strengths || ['Core Programming'];
  const strongSummary = strongSkills.slice(0, 3).join(', ');

  return {
    learning_needed: !isHighScorer,
    recommendation_type: isHighScorer ? 'optional_advancement' : 'required',
    reason_for_decision: isHighScorer 
      ? 'No major course-level gap identified at your current readiness level.'
      : `Readiness score of ${score}/100 indicates targeted practical learning in ${firstGap} will materially improve employability.`,
    already_strong_in: strongSkills,
    gap: isHighScorer ? 'Advanced System Architecture & Cloud Optimization' : firstGap,
    why: isHighScorer 
      ? 'Your readiness score is 90+. Focus on advanced system design and interview execution.'
      : `Addressing ${firstGap} builds on your demonstrated skills in ${strongSummary} to complete target role requirements.`,
    candidate_evidence: ['Identified area requiring hands-on project implementation and public code evidence'],
    learning_goal: isHighScorer 
      ? 'Refine production architecture and performance optimization.'
      : `Master ${firstGap} and implement in your project`,
    search_query: isHighScorer ? 'System design full course intermediate English' : query,
    estimated_learning_time: '2 hours',
    practical_application: existingProject
      ? `Integrate ${firstGap} into your existing '${existingProject}' codebase and document the updated architecture.`
      : `Build an end-to-end implementation demonstrating ${firstGap} with clear README documentation.`,
    internships: [
      {
        domain: targetRole || 'Full Stack Web Development',
        why_recommended: `Applying for ${targetRole || 'Full Stack Development'} internships provides real-world codebase evidence building upon your ${strongSummary} background.`,
        best_suited_for: targetRole || 'Software Engineer'
      }
    ],
    books: [
      {
        search_query: selectDeterministicBookQuery(firstGap, targetRole),
        why_it_helps: `Deepens theoretical and practical engineering foundations for ${targetRole || 'Software Engineering'}.`,
        target_topic: firstGap
      }
    ],
    hackathons: [
      {
        category: targetRole?.toLowerCase().includes('ai') ? 'AI & Machine Learning' : 'Full Stack Web Innovation',
        why_fits_you: `Hackathons in ${targetRole || 'Software Engineering'} enable you to build observable deployed prototypes.`,
        what_you_could_demonstrate: 'Rapid full-stack prototype development and deployment'
      }
    ],
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
          title: existingProject ? `Implement ${firstGap} in ${existingProject}` : `Implement ${firstGap} Module`,
          why_for_this_candidate: `You already demonstrate proficiency in ${strongSummary}. Adding ${firstGap} directly expands your project capabilities.`,
          purpose: 'Understand core integration techniques and implement locally',
          tasks: [
            {
              task: existingProject 
                ? `Build a dedicated ${firstGap} module inside '${existingProject}' with loading and error handling`
                : `Complete targeted implementation for ${firstGap} with structured error handling`,
              why_for_this_candidate: `Expands your existing practical project work without restarting from basics`,
              estimated_time: '2 hours',
              completion_criteria: 'Working local prototype with passing tests',
              proof_of_work_outcome: `Working ${firstGap} module integrated with your codebase and passing automated test cases.`
            }
          ],
          milestone: 'Local prototype complete',
          proof_of_work_outcome: existingProject
            ? `Your existing '${existingProject}' codebase demonstrates ${firstGap} integration with structured error handling.`
            : `Working code repository demonstrating ${firstGap} integration.`
        },
        {
          step: 2,
          title: 'Deploy and Document Proof',
          why_for_this_candidate: 'A live deployed demo and clear README provides verifiable evidence for technical recruiters.',
          purpose: 'Produce public repository proof',
          tasks: [
            {
              task: 'Commit implementation to GitHub, deploy live demo, and document architecture in README',
              why_for_this_candidate: 'Converts local code into publicly verifiable proof of competence',
              estimated_time: '3 hours',
              completion_criteria: 'Live URL and clean README documentation',
              proof_of_work_outcome: 'Live deployed application URL with comprehensive GitHub README documentation.'
            }
          ],
          milestone: 'Deployed feature with verified proof',
          proof_of_work_outcome: 'Live deployed application URL with comprehensive GitHub README documenting design choices.'
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

