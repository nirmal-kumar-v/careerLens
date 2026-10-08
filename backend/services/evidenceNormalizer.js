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
    evidence.codingEvidence.leetcode = {
      totalSolved: leetcode.totalSolved || 0,
      easySolved: leetcode.easySolved || 0,
      mediumSolved: leetcode.mediumSolved || 0,
      hardSolved: leetcode.hardSolved || 0,
      ranking: leetcode.ranking,
      languages: leetcode.languages || [],
      topTags: leetcode.topTags || []
    };
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
          evidence: `Used in LeetCode problem solving`,
          strengthSignal: 'moderate'
        });
      }
    });
  } else if (!leetcode) {
    evidence.missingSources.push('leetcode');
  }

  // ──── GFG ────
  if (gfg && gfg.extracted) {
    evidence.codingEvidence.gfg = {
      totalProblemsSolved: gfg.totalProblemsSolved || 0,
      codingScore: gfg.codingScore || 0,
      problemsByDifficulty: gfg.problemsByDifficulty || {}
    };
  } else if (!gfg) {
    evidence.missingSources.push('gfg');
  }

  // ──── LINKEDIN ────
  if (linkedin && linkedin.extracted) {
    (linkedin.skills || []).forEach(s => {
      const existing = evidence.observedTechnologies.find(t => t.tech.toLowerCase() === s.toLowerCase());
      if (existing) existing.sources.push('linkedin');
      else evidence.observedTechnologies.push({ tech: s, sources: ['linkedin'], evidence: 'Listed on LinkedIn', strengthSignal: 'weak' });
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
    skillsClaimedNotObservedOnGithub: [],
    skillsObservedNotClaimed: [],
    projectOverlap: [],
    consistencyScore: 0
  };

  const claimedLower = uniqueSkills([...evidence.claimedSkills, ...evidence.claimedTechnologies]).map(normalizeSkill);
  const observedLower = evidence.observedTechnologies.map(t => normalizeSkill(t.tech));
    const githubObservedLower = evidence.observedTechnologies
      .filter(technology => technology.sources.includes('github'))
      .map(technology => normalizeSkill(technology.tech));

  // Skills claimed and observed
  claimedLower.forEach(skill => {
      if (!githubObservedLower.includes(skill)) {
        consistency.skillsClaimedNotObservedOnGithub.push(skill);
      }
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

  // Simple consistency score
  const totalClaimed = claimedLower.length || 1;
    const verified = claimedLower.filter(skill => githubObservedLower.includes(skill)).length;
  consistency.consistencyScore = Math.round((verified / totalClaimed) * 100);

  return consistency;
}

function normalizeSkill(skill) {
  return String(skill || '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

function uniqueSkills(skills) {
  const unique = new Map();
  skills.filter(Boolean).forEach(skill => {
    const normalized = normalizeSkill(skill);
    if (normalized && !unique.has(normalized)) unique.set(normalized, skill);
  });
  return [...unique.values()];
}

module.exports = { normalizeEvidence };
