/**
 * Normalize and structure extracted data from all sources into
 * a unified evidence representation before AI evaluation.
 */
function normalizeEvidence(extractedData) {
  const evidence = {
    claimedSkills: [],
    claimedTechnologies: [],
    claimedProjects: [],
    observedProjects: [],
    observedTechnologies: [],
    codingEvidence: {},
    activityEvidence: {},
    ownershipEvidence: {},
    crossSourceConsistency: {},
    missingSources: [],
    potentialMismatches: []
  };

  const { resume, github, portfolio, leetcode, gfg, linkedin, figma } = extractedData;

  // ──── CLAIMS FROM RESUME ────
  if (resume) {
    evidence.claimedSkills = uniqueSkills([
      ...(resume.skills || []),
      ...(resume.languages || [])
    ]);
    evidence.claimedTechnologies = uniqueSkills(resume.technologies || []);
    evidence.claimedProjects = (resume.projects || []).map(p => ({
      name: p.name,
      description: p.description,
      technologies: p.technologies || [],
      source: 'resume'
    }));
  }

  // ──── OBSERVED FROM GITHUB ────
  if (github && !github.error && github.extracted !== false) {
    // Original repos as observed projects
    const repos = github.repositories || [];
    for (const repo of repos) {
      evidence.observedProjects.push({
        name: repo.name,
        description: repo.description,
        technologies: Object.keys(repo.languages || {}),
        source: 'github',
        url: repo.url,
        isForked: repo.isFork,
        ownershipConfidence: repo.isFork ? 'low' : (repo.isOwner ? 'high' : 'medium'),
        stars: repo.stargazersCount,
        lastUpdated: repo.pushedAt
      });
    }

    // Languages observed
    const langTotals = github.languageTotals || {};
    for (const [lang, bytes] of Object.entries(langTotals)) {
      evidence.observedTechnologies.push({
        tech: lang,
        sources: ['github'],
        evidence: `${bytes} bytes across repositories`,
        strengthSignal: bytes > 50000 ? 'strong' : bytes > 10000 ? 'moderate' : 'weak'
      });
    }

    for (const repo of repos) {
      const repoLanguages = Object.keys(repo.languages || {});
      const languages = repoLanguages.length ? repoLanguages : (repo.language ? [repo.language] : []);
      for (const language of languages) {
        const existing = evidence.observedTechnologies.find(technology => normalizeSkill(technology.tech) === normalizeSkill(language));
        if (existing) {
          if (!existing.evidence.includes(repo.name)) existing.evidence += `; also found in ${repo.name}`;
        } else {
          evidence.observedTechnologies.push({
            tech: language,
            sources: ['github'],
            evidence: `Primary language in repository ${repo.name}`,
            strengthSignal: 'weak'
          });
        }
      }
    }

    // Ownership evidence
    evidence.ownershipEvidence.github = {
      totalRepos: github.publicRepos,
      originalRepos: github.originalRepoCount,
      forkedRepos: github.forkedRepoCount,
      accountAge: github.createdAt,
      recentActivity: (github.recentActivity || []).length
    };

    // Activity evidence
    evidence.activityEvidence.github = {
      recentEvents: (github.recentActivity || []).length,
      lastPush: repos.length > 0 ? repos[0].pushedAt : null,
      activeRepos: repos.filter(r => {
        const pushed = new Date(r.pushedAt);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return pushed > sixMonthsAgo;
      }).length
    };
  } else {
    evidence.missingSources.push('github');
  }

  // ──── PORTFOLIO ────
  if (portfolio && portfolio.extracted) {
    const portfolioProjects = portfolio.projects || portfolio.structured?.projects || [];
    portfolioProjects.forEach(p => {
      evidence.observedProjects.push({
        name: p.name,
        description: p.description || '',
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        source: 'portfolio',
        url: p.liveUrl || p.githubUrl || p.url || portfolio.url,
        isForked: false,
        ownershipConfidence: p.githubUrl ? 'high' : 'medium'
      });
    });

    const portfolioSkills = portfolio.skills?.all || (Array.isArray(portfolio.skills) ? portfolio.skills : []) || portfolio.structured?.skills || [];
    portfolioSkills.forEach(s => {
      const existing = evidence.observedTechnologies.find(t => t.tech.toLowerCase() === s.toLowerCase());
      if (existing) {
        if (!existing.sources.includes('portfolio')) existing.sources.push('portfolio');
      } else {
        evidence.observedTechnologies.push({
          tech: s,
          sources: ['portfolio'],
          evidence: 'Showcased on portfolio website',
          strengthSignal: 'moderate'
        });
      }
    });
  } else if (!portfolio) {
    evidence.missingSources.push('portfolio');
  }

  // ──── LEETCODE ────
  if (leetcode && leetcode.extracted) {
    const totalSolved = leetcode.totalSolved || 0;
    evidence.codingEvidence.leetcode = {
      totalSolved,
      easySolved: leetcode.easySolved || 0,
      mediumSolved: leetcode.mediumSolved || 0,
      hardSolved: leetcode.hardSolved || 0,
      ranking: leetcode.ranking,
      languages: leetcode.languages || [],
      topTags: leetcode.topTags || []
    };

    if (totalSolved > 0) {
      const dsaStrength = totalSolved >= 150 ? 'strong' : (totalSolved >= 40 ? 'moderate' : 'weak');
      const dsaTerms = [
        'DSA', 'Data Structures', 'Algorithms', 'Data Structures & Algorithms',
        'Data Structures and Algorithms', 'Problem Solving', 'Competitive Programming',
        'LeetCode'
      ];
      dsaTerms.forEach(term => {
        evidence.observedTechnologies.push({
          tech: term,
          sources: ['leetcode'],
          evidence: `${totalSolved} problems solved on LeetCode (Easy: ${leetcode.easySolved || 0}, Medium: ${leetcode.mediumSolved || 0}, Hard: ${leetcode.hardSolved || 0})${leetcode.ranking ? `, Global Rank: ${leetcode.ranking}` : ''}`,
          strengthSignal: dsaStrength
        });
      });

      // Top topic tags on LeetCode
      (leetcode.topTags || []).forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : (tag?.tagName || tag?.name || '');
        if (tagName) {
          evidence.observedTechnologies.push({
            tech: tagName,
            sources: ['leetcode'],
            evidence: `Practiced topic on LeetCode: ${tagName} (${totalSolved} total problems solved)`,
            strengthSignal: dsaStrength
          });
        }
      });
    }

    // Add languages as observed
    (leetcode.languages || []).forEach(l => {
      const langName = typeof l === 'string' ? l : (l?.language || l?.languageName || l?.name || '');
      if (!langName) return;
      const existing = evidence.observedTechnologies.find(t => t.tech.toLowerCase() === langName.toLowerCase());
      if (existing) {
        if (!existing.sources.includes('leetcode')) existing.sources.push('leetcode');
      } else {
        evidence.observedTechnologies.push({
          tech: langName,
          sources: ['leetcode'],
          evidence: `Used in LeetCode problem solving (${totalSolved} problems)`,
          strengthSignal: totalSolved > 50 ? 'strong' : 'moderate'
        });
      }
    });
  } else if (!leetcode) {
    evidence.missingSources.push('leetcode');
  }

  // ──── GFG ────
  if (gfg && gfg.extracted) {
    const totalSolved = gfg.totalProblemsSolved || 0;
    evidence.codingEvidence.gfg = {
      totalProblemsSolved: totalSolved,
      codingScore: gfg.codingScore || 0,
      problemsByDifficulty: gfg.problemsByDifficulty || {}
    };
    if (totalSolved > 0) {
      const gfgStrength = totalSolved >= 150 ? 'strong' : (totalSolved >= 40 ? 'moderate' : 'weak');
      const dsaTerms = [
        'DSA', 'Data Structures', 'Algorithms', 'Data Structures & Algorithms',
        'Data Structures and Algorithms', 'Problem Solving', 'Competitive Programming',
        'GeeksforGeeks', 'GFG'
      ];
      dsaTerms.forEach(term => {
        const existing = evidence.observedTechnologies.find(t => normalizeSkill(t.tech) === normalizeSkill(term));
        if (existing) {
          if (!existing.sources.includes('gfg')) existing.sources.push('gfg');
          existing.evidence += `; ${totalSolved} problems solved on GeeksforGeeks`;
        } else {
          evidence.observedTechnologies.push({
            tech: term,
            sources: ['gfg'],
            evidence: `${totalSolved} problems solved on GeeksforGeeks (Coding score: ${gfg.codingScore || 0})`,
            strengthSignal: gfgStrength
          });
        }
      });
    }
  } else if (!gfg) {
    evidence.missingSources.push('gfg');
  }

  // ──── LINKEDIN ────
  if (linkedin && linkedin.extracted) {
    (linkedin.skills || []).forEach(s => {
      const existing = evidence.observedTechnologies.find(t => t.tech.toLowerCase() === s.toLowerCase());
      if (existing) {
        if (!existing.sources.includes('linkedin')) existing.sources.push('linkedin');
      } else {
        evidence.observedTechnologies.push({ tech: s, sources: ['linkedin'], evidence: 'Listed on LinkedIn profile', strengthSignal: 'weak' });
      }
    });
    (linkedin.projects || []).forEach(p => {
      evidence.observedProjects.push({
        name: p.name, description: p.description,
        technologies: [], source: 'linkedin',
        isForked: false, ownershipConfidence: 'low'
      });
    });
    evidence.activityEvidence.linkedin = {
      hasExperience: (linkedin.experience || []).length > 0,
      experienceCount: (linkedin.experience || []).length,
      certifications: linkedin.certifications || []
    };
  } else if (!linkedin) {
    evidence.missingSources.push('linkedin');
  }

  // ──── FIGMA ────
  if (figma && figma.extracted) {
    (figma.projects || []).forEach(p => {
      evidence.observedProjects.push({
        name: p.name, description: p.description || '',
        technologies: figma.tools || [], source: 'figma',
        isForked: false, ownershipConfidence: 'medium'
      });
    });
    const figmaSkills = [...(figma.skills || []), ...(figma.tools || []), 'Figma', 'UI/UX', 'UI/UX Design'];
    figmaSkills.forEach(s => {
      const existing = evidence.observedTechnologies.find(t => normalizeSkill(t.tech) === normalizeSkill(s));
      if (existing) {
        if (!existing.sources.includes('figma')) existing.sources.push('figma');
      } else {
        evidence.observedTechnologies.push({
          tech: s,
          sources: ['figma'],
          evidence: `Observed in Figma design workspace (${(figma.projects || []).length} projects)`,
          strengthSignal: 'moderate'
        });
      }
    });
    evidence.activityEvidence.figma = {
      designProjects: (figma.projects || []).length,
      skills: figma.skills || [],
      tools: figma.tools || []
    };
  } else if (!figma) {
    evidence.missingSources.push('figma');
  }

  // ──── CROSS-SOURCE CONSISTENCY ────
  evidence.crossSourceConsistency = buildCrossSourceConsistency(evidence);

  return evidence;
}

function buildCrossSourceConsistency(evidence) {
  const consistency = {
    skillsClaimedAndObserved: [],
    skillsClaimedNotObserved: [],
    skillsObservedNotClaimed: [],
    projectOverlap: [],
    consistencyScore: 0
  };

  const claimedLower = uniqueSkills([...evidence.claimedSkills, ...evidence.claimedTechnologies]).map(normalizeSkill);
  const observedLower = evidence.observedTechnologies.map(t => normalizeSkill(t.tech));

  // Skills claimed and observed across any first-class source
  claimedLower.forEach(skill => {
    if (observedLower.includes(skill)) {
      const obs = evidence.observedTechnologies.find(t => normalizeSkill(t.tech) === skill);
      consistency.skillsClaimedAndObserved.push({
        skill,
        sources: obs ? obs.sources : [],
        strength: obs ? obs.strengthSignal : 'unknown'
      });
    } else {
      consistency.skillsClaimedNotObserved.push(skill);
    }
  });

  // Observed but not claimed
  observedLower.forEach(tech => {
    if (!claimedLower.includes(tech)) {
      consistency.skillsObservedNotClaimed.push(tech);
    }
  });

  // Project overlap
  const claimedProjects = evidence.claimedProjects.map(p => p.name.toLowerCase());
  const observedProjects = evidence.observedProjects.map(p => p.name.toLowerCase());
  claimedProjects.forEach(pName => {
    if (observedProjects.some(op => op.includes(pName) || pName.includes(op))) {
      consistency.projectOverlap.push(pName);
    }
  });

  // Consistency score across all connected sources
  const totalClaimed = claimedLower.length || 1;
  const verifiedCount = consistency.skillsClaimedAndObserved.length;
  consistency.consistencyScore = Math.round((verifiedCount / totalClaimed) * 100);

  return consistency;
}

const CANONICAL_ALIASES = {
  'reactjs': 'react',
  'react': 'react',
  'reactnative': 'reactnative',
  'nextjs': 'nextjs',
  'next': 'nextjs',
  'vuejs': 'vue',
  'vue': 'vue',
  'nodejs': 'node',
  'node': 'node',
  'expressjs': 'express',
  'express': 'express',
  'nestjs': 'nest',
  'nest': 'nest',
  'postgresql': 'postgres',
  'postgres': 'postgres',
  'mongodb': 'mongo',
  'mongo': 'mongo',
  'dsa': 'dsa',
  'datastructures': 'dsa',
  'algorithms': 'dsa',
  'datastructuresalgorithms': 'dsa',
  'datastructuresandalgorithms': 'dsa',
  'problemsolving': 'dsa',
  'competitiveprogramming': 'dsa',
  'tailwindcss': 'tailwind',
  'tailwind': 'tailwind',
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'cpp': 'cpp',
  'c++': 'cpp',
  'cplusplus': 'cpp',
  'c#': 'csharp',
  'csharp': 'csharp',
  'golang': 'go',
  'go': 'go'
};

function normalizeSkill(skill) {
  const clean = String(skill || '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
  return CANONICAL_ALIASES[clean] || clean;
}

function uniqueSkills(skills) {
  const unique = new Map();
  skills.filter(Boolean).forEach(skill => {
    const normalized = normalizeSkill(skill);
    if (normalized && !unique.has(normalized)) unique.set(normalized, skill);
  });
  return [...unique.values()];
}

module.exports = { normalizeEvidence, normalizeSkill };
