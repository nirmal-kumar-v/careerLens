/**
 * Source-Specific Plain Text Normalizer
 *
 * Converts each raw extractor output into a clean, human-readable,
 * strictly separated plain-text block with standardized headings
 * for future AI ingestion.
 */

function normalizeAllSourceTexts(extractedData = {}) {
  const resumeText = buildResumeSourceText(extractedData.resume);
  const githubText = buildGithubSourceText(extractedData.github);
  const linkedinText = buildLinkedinSourceText(extractedData.linkedin);
  const leetcodeText = buildLeetcodeSourceText(extractedData.leetcode);
  const portfolioText = buildPortfolioSourceText(extractedData.portfolio);
  const otherSourcesText = buildOtherSourcesText(extractedData);

  return {
    resumeText,
    githubText,
    linkedinText,
    leetcodeText,
    portfolioText,
    otherSourcesText
  };
}

function buildResumeSourceText(resume) {
  if (!resume || resume.error || resume.extracted === false) {
    return `===== RESUME =====\nNot available / Not provided.`;
  }

  const lines = ['===== RESUME =====', ''];

  // PERSONAL INFORMATION
  lines.push('PERSONAL INFORMATION');
  lines.push(`Name: ${resume.name || 'Not available'}`);
  lines.push(`Email: ${resume.email || 'Not available'}`);
  lines.push(`Phone: ${resume.phone || 'Not available'}`);
  lines.push(`Location: ${resume.location || 'Not available'}`);
  if (resume.links?.length) {
    lines.push(`Links: ${resume.links.join(', ')}`);
  }
  lines.push('');

  // SUMMARY
  if (resume.summary) {
    lines.push('SUMMARY');
    lines.push(resume.summary);
    lines.push('');
  }

  // SKILLS
  const allSkills = [
    ...(resume.skills || []),
    ...(resume.languages || []),
    ...(resume.technologies || [])
  ];
  const uniqueSkills = [...new Set(allSkills.filter(Boolean))];
  lines.push('SKILLS');
  lines.push(uniqueSkills.length ? uniqueSkills.join(', ') : 'Not available');
  lines.push('');

  // EDUCATION
  lines.push('EDUCATION');
  if (Array.isArray(resume.education) && resume.education.length) {
    resume.education.forEach(edu => {
      const parts = [
        edu.degree || edu.title,
        edu.institution || edu.school || edu.college,
        edu.year || edu.dates,
        edu.gpa ? `GPA/Score: ${edu.gpa}` : ''
      ].filter(Boolean);
      lines.push(`- ${parts.join(' | ')}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // EXPERIENCE
  lines.push('EXPERIENCE');
  if (Array.isArray(resume.experience) && resume.experience.length) {
    resume.experience.forEach(exp => {
      const header = [
        exp.role || exp.title,
        exp.company || exp.employer,
        exp.duration || exp.dates
      ].filter(Boolean).join(' at ');
      lines.push(`- ${header || 'Experience item'}`);
      if (exp.description) lines.push(`  Description: ${exp.description}`);
      if (exp.technologies?.length) lines.push(`  Technologies: ${exp.technologies.join(', ')}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // PROJECTS
  lines.push('PROJECTS');
  if (Array.isArray(resume.projects) && resume.projects.length) {
    resume.projects.forEach(p => {
      const techStr = p.technologies?.length ? ` (${p.technologies.join(', ')})` : '';
      lines.push(`- ${p.name || 'Project'}${techStr}`);
      if (p.description) lines.push(`  ${p.description}`);
      if (p.url || p.link) lines.push(`  Link: ${p.url || p.link}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // CERTIFICATIONS
  lines.push('CERTIFICATIONS');
  if (Array.isArray(resume.certifications) && resume.certifications.length) {
    resume.certifications.forEach(c => {
      const cStr = typeof c === 'string' ? c : [c.title || c.name, c.issuer, c.year].filter(Boolean).join(' - ');
      lines.push(`- ${cStr}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // ACHIEVEMENTS
  lines.push('ACHIEVEMENTS');
  if (Array.isArray(resume.achievements) && resume.achievements.length) {
    resume.achievements.forEach(a => lines.push(`- ${typeof a === 'string' ? a : a.title || JSON.stringify(a)}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // OTHER INFORMATION
  lines.push('OTHER INFORMATION');
  if (resume.rawText && resume.rawText.length > 50) {
    lines.push(resume.rawText.substring(0, 1000));
  } else {
    lines.push('None.');
  }

  return lines.join('\n');
}

function buildGithubSourceText(github) {
  if (!github || github.error || github.extracted === false) {
    return `===== GITHUB =====\nNot available / Not provided.`;
  }

  const lines = ['===== GITHUB =====', ''];

  // PROFILE
  lines.push('PROFILE');
  lines.push(`Username: ${github.username || 'Not available'}`);
  lines.push(`Name: ${github.name || 'Not available'}`);
  lines.push(`Bio: ${github.bio || 'Not available'}`);
  lines.push(`Location: ${github.location || 'Not available'}`);
  lines.push(`Account Created: ${github.createdAt || 'Not available'}`);
  lines.push(`Public Repositories: ${github.publicRepos ?? 'Not available'}`);
  lines.push(`Followers: ${github.followers ?? 'Not available'}`);
  lines.push('');

  // REPOSITORIES
  const repos = github.repositories || [];
  const originalRepos = repos.filter(r => !r.isFork);
  const forkedRepos = repos.filter(r => r.isFork);
  lines.push(`REPOSITORIES (${originalRepos.length} original, ${forkedRepos.length} forked)`);
  if (repos.length) {
    repos.slice(0, 25).forEach(r => {
      const langs = Object.keys(r.languages || {}).join(', ');
      const forkBadge = r.isFork ? ' [Fork]' : ' [Original]';
      lines.push(`- ${r.name}${forkBadge}${langs ? ` (${langs})` : ''}: ${r.description || 'No description'} [Stars: ${r.stargazersCount || 0}, Updated: ${r.pushedAt || 'unknown'}]`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // PROJECTS
  lines.push('PROJECTS');
  if (originalRepos.length) {
    originalRepos.slice(0, 15).forEach(r => {
      lines.push(`- ${r.name}: ${r.description || 'No description'} (Primary language: ${r.language || 'None'}, URL: ${r.url})`);
    });
  } else {
    lines.push('No original projects found.');
  }
  lines.push('');

  // LANGUAGES / TECHNOLOGIES
  lines.push('LANGUAGES / TECHNOLOGIES');
  if (github.topLanguages?.length) {
    github.topLanguages.forEach(l => {
      lines.push(`- ${l.language}: ${formatBytes(l.bytes)} (${l.percentage || ''}%)`);
    });
  } else if (github.languageTotals && Object.keys(github.languageTotals).length) {
    Object.entries(github.languageTotals).forEach(([lang, bytes]) => {
      lines.push(`- ${lang}: ${formatBytes(bytes)}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // CONTRIBUTIONS / ACTIVITY
  lines.push('CONTRIBUTIONS / ACTIVITY');
  lines.push(`Total original repos: ${github.originalRepoCount ?? originalRepos.length}`);
  lines.push(`Recent events recorded: ${(github.recentActivity || []).length}`);
  if (github.recentActivity?.length) {
    github.recentActivity.slice(0, 8).forEach(act => {
      lines.push(`- ${act.type} on ${act.repo} (${act.createdAt || ''})`);
    });
  }
  lines.push('');

  // STARS / FORKS / RELEVANT METRICS
  lines.push('STARS / FORKS / RELEVANT METRICS');
  const totalStars = repos.reduce((acc, r) => acc + (r.stargazersCount || 0), 0);
  const totalForks = repos.reduce((acc, r) => acc + (r.forksCount || 0), 0);
  lines.push(`Total stars across repositories: ${totalStars}`);
  lines.push(`Total forks across repositories: ${totalForks}`);
  lines.push(`Forked repositories owned: ${forkedRepos.length}`);
  lines.push('');

  // OTHER OBSERVABLE INFORMATION
  lines.push('OTHER OBSERVABLE INFORMATION');
  if (github.topics?.length) {
    lines.push(`Topics: ${github.topics.join(', ')}`);
  } else {
    lines.push('None.');
  }

  return lines.join('\n');
}

function buildLinkedinSourceText(linkedin) {
  if (!linkedin || linkedin.error || linkedin.extracted === false) {
    return `===== LINKEDIN =====\nNot available / Not provided.`;
  }

  const lines = ['===== LINKEDIN =====', ''];
  const prof = linkedin.profile || {};

  // PROFILE
  lines.push('PROFILE');
  lines.push(`Name: ${prof.name || linkedin.name || 'Not available'}`);
  lines.push(`Headline: ${prof.headline || linkedin.headline || 'Not available'}`);
  lines.push(`Location: ${prof.location || linkedin.location || 'Not available'}`);
  lines.push(`Connections: ${prof.connections || linkedin.connections || 'Not available'}`);
  lines.push('');

  // ABOUT
  lines.push('ABOUT');
  lines.push(prof.about || prof.summary || linkedin.summary || 'Not available');
  lines.push('');

  // EXPERIENCE
  lines.push('EXPERIENCE');
  const exps = linkedin.experience || [];
  if (exps.length) {
    exps.forEach(e => {
      lines.push(`- ${e.title || e.role || 'Role'} at ${e.company || 'Company'} (${e.duration || e.dates || 'Dates'})`);
      if (e.description) lines.push(`  Description: ${e.description}`);
      if (e.location) lines.push(`  Location: ${e.location}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // EDUCATION
  lines.push('EDUCATION');
  const edus = linkedin.education || [];
  if (edus.length) {
    edus.forEach(e => {
      lines.push(`- ${e.degree || 'Degree'} at ${e.school || e.institution || 'Institution'} (${e.dates || e.year || ''})`);
      if (e.fieldOfStudy) lines.push(`  Field of study: ${e.fieldOfStudy}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // SKILLS
  lines.push('SKILLS');
  const skills = Array.isArray(linkedin.skills) ? linkedin.skills : (linkedin.skills?.all || []);
  lines.push(skills.length ? skills.join(', ') : 'Not available');
  lines.push('');

  // PROJECTS
  lines.push('PROJECTS');
  const projs = linkedin.projects || [];
  if (projs.length) {
    projs.forEach(p => {
      lines.push(`- ${p.title || p.name || 'Project'}: ${p.description || ''} ${p.url ? `[Link: ${p.url}]` : ''}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // CERTIFICATIONS
  lines.push('CERTIFICATIONS');
  const certs = linkedin.certifications || [];
  if (certs.length) {
    certs.forEach(c => lines.push(`- ${c.name || c.title || c} (${c.authority || c.issuer || ''})`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // FEATURED
  lines.push('FEATURED');
  const featured = linkedin.featured || [];
  if (featured.length) {
    featured.forEach(f => lines.push(`- ${f.title || f.name || f}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // PUBLICATIONS
  lines.push('PUBLICATIONS');
  const pubs = linkedin.publications || [];
  if (pubs.length) {
    pubs.forEach(p => lines.push(`- ${p.title || p.name || p}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // AWARDS
  lines.push('AWARDS');
  const honors = linkedin.honorsAndAwards || linkedin.awards || [];
  if (honors.length) {
    honors.forEach(h => lines.push(`- ${h.title || h.name || h}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // VOLUNTEERING
  lines.push('VOLUNTEERING');
  const vol = linkedin.volunteering || [];
  if (vol.length) {
    vol.forEach(v => lines.push(`- ${v.role || v.title} at ${v.organization || v.company}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // LANGUAGES
  lines.push('LANGUAGES');
  const langs = linkedin.languages || [];
  lines.push(langs.length ? (Array.isArray(langs) ? langs.join(', ') : JSON.stringify(langs)) : 'Not available');
  lines.push('');

  // ACTIVITY
  lines.push('ACTIVITY');
  lines.push(linkedin.activitySummary || 'Not available');
  lines.push('');

  // EXTERNAL LINKS
  lines.push('EXTERNAL LINKS');
  const extLinks = linkedin.externalLinks || [];
  lines.push(extLinks.length ? extLinks.join(', ') : 'Not available');
  lines.push('');

  // OTHER OBSERVABLE INFORMATION
  lines.push('OTHER OBSERVABLE INFORMATION');
  lines.push(linkedin.plainTextSummary || 'None.');

  return lines.join('\n');
}

function buildLeetcodeSourceText(leetcode) {
  if (!leetcode || leetcode.error || leetcode.extracted === false) {
    return `===== LEETCODE =====\nNot available / Not provided.`;
  }

  const lines = ['===== LEETCODE =====', ''];

  // PROFILE
  lines.push('PROFILE');
  lines.push(`Username: ${leetcode.username || 'Not available'}`);
  lines.push(`Ranking: ${leetcode.ranking || 'Not available'}`);
  lines.push(`Reputation: ${leetcode.reputation || 'Not available'}`);
  lines.push('');

  // PROBLEMS SOLVED
  lines.push('PROBLEMS SOLVED');
  lines.push(`Total solved: ${leetcode.totalSolved ?? 0}`);
  lines.push(`Easy: ${leetcode.easySolved ?? 0}`);
  lines.push(`Medium: ${leetcode.mediumSolved ?? 0}`);
  lines.push(`Hard: ${leetcode.hardSolved ?? 0}`);
  lines.push(`Acceptance Rate: ${leetcode.acceptanceRate ? `${leetcode.acceptanceRate}%` : 'Not available'}`);
  lines.push('');

  // RECENT / OBSERVABLE PROBLEM DATA
  lines.push('RECENT / OBSERVABLE PROBLEM DATA');
  const recent = leetcode.recentSubmissions || [];
  if (recent.length) {
    recent.slice(0, 10).forEach(sub => {
      lines.push(`- ${sub.title || sub.titleSlug} (${sub.status || 'Accepted'}, Lang: ${sub.lang || 'Unknown'}, Time: ${sub.timestamp ? new Date(sub.timestamp * 1000).toLocaleDateString() : ''})`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // TOPICS / TAGS
  lines.push('TOPICS / TAGS');
  const tags = leetcode.topTags || leetcode.topicTags || [];
  if (tags.length) {
    tags.forEach(t => {
      const name = t.tagName || t.name || t.topic || t;
      const count = t.problemsSolved || t.count || '';
      lines.push(`- ${name}${count ? `: ${count} solved` : ''}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // LANGUAGES USED
  lines.push('LANGUAGES USED');
  const langs = leetcode.languages || leetcode.languageStats || [];
  if (langs.length) {
    langs.forEach(l => {
      const name = l.languageName || l.language || l.name || l;
      const count = l.problemsSolved || l.count || '';
      lines.push(`- ${name}${count ? `: ${count} solved` : ''}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // CONTEST / RATING INFORMATION
  lines.push('CONTEST / RATING INFORMATION');
  if (leetcode.contestRating || leetcode.contestRanking) {
    lines.push(`Contest Rating: ${leetcode.contestRating || 'Not available'}`);
    lines.push(`Global Ranking: ${leetcode.contestRanking || 'Not available'}`);
    lines.push(`Contests Attended: ${leetcode.contestAttended || 'Not available'}`);
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // BADGES
  lines.push('BADGES');
  const badges = leetcode.badges || [];
  if (badges.length) {
    badges.forEach(b => lines.push(`- ${b.displayName || b.name || b}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // OTHER OBSERVABLE INFORMATION
  lines.push('OTHER OBSERVABLE INFORMATION');
  lines.push(`Streak / Consistency: ${leetcode.streakDays ? `${leetcode.streakDays} days` : 'Not available'}`);

  return lines.join('\n');
}

function buildPortfolioSourceText(portfolio) {
  if (!portfolio || portfolio.error || portfolio.extracted === false) {
    return `===== PORTFOLIO =====\nNot available / Not provided.`;
  }

  const lines = ['===== PORTFOLIO =====', ''];
  const prof = portfolio.profile || {};

  // PROFILE INFORMATION
  lines.push('PROFILE INFORMATION');
  lines.push(`Name: ${prof.name || 'Not available'}`);
  lines.push(`Title: ${prof.title || 'Not available'}`);
  lines.push(`Location: ${prof.location || 'Not available'}`);
  lines.push(`Email: ${prof.email || 'Not available'}`);
  lines.push('');

  // ABOUT
  lines.push('ABOUT');
  lines.push(prof.bio || 'Not available');
  lines.push('');

  // SKILLS
  lines.push('SKILLS');
  const skills = portfolio.skills || {};
  if (skills.all?.length) {
    lines.push(`All: ${skills.all.join(', ')}`);
    if (skills.languages?.length) lines.push(`Languages: ${skills.languages.join(', ')}`);
    if (skills.frameworks?.length) lines.push(`Frameworks: ${skills.frameworks.join(', ')}`);
    if (skills.databases?.length) lines.push(`Databases: ${skills.databases.join(', ')}`);
    if (skills.tools?.length) lines.push(`Tools & Cloud: ${skills.tools.join(', ')}`);
  } else if (Array.isArray(skills) && skills.length) {
    lines.push(skills.join(', '));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // PROJECTS
  const projs = portfolio.projects || [];
  lines.push(`PROJECTS (${projs.length})`);
  if (projs.length) {
    projs.forEach(p => {
      const techStr = p.technologies?.length ? ` (${p.technologies.join(', ')})` : '';
      lines.push(`- ${p.name || 'Project'}${techStr}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // PROJECT DESCRIPTIONS
  lines.push('PROJECT DESCRIPTIONS');
  if (projs.length) {
    projs.forEach(p => {
      lines.push(`- ${p.name}: ${p.description || 'No description'} [Live: ${p.liveUrl || 'None'} | GitHub: ${p.githubUrl || 'None'}]`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // TECHNOLOGIES
  lines.push('TECHNOLOGIES');
  const projTechs = [...new Set(projs.flatMap(p => p.technologies || []))];
  lines.push(projTechs.length ? projTechs.join(', ') : (skills.all?.join(', ') || 'Not available'));
  lines.push('');

  // EXPERIENCE
  lines.push('EXPERIENCE');
  const exps = portfolio.experience || [];
  if (exps.length) {
    exps.forEach(e => {
      lines.push(`- ${e.role || 'Role'} at ${e.company || 'Company'}${e.duration ? ` (${e.duration})` : ''}${e.description ? ` — ${e.description}` : ''}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // EDUCATION
  lines.push('EDUCATION');
  const edus = portfolio.education || [];
  if (edus.length) {
    edus.forEach(e => {
      lines.push(`- ${e.degree || 'Degree'} at ${e.institution || 'Institution'}${e.year ? ` (${e.year})` : ''}`);
    });
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // CERTIFICATIONS
  lines.push('CERTIFICATIONS');
  const certs = portfolio.certifications || [];
  if (certs.length) {
    certs.forEach(c => lines.push(`- ${typeof c === 'string' ? c : `${c.title || c.name} (${c.issuer || ''})`}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // ACHIEVEMENTS
  lines.push('ACHIEVEMENTS');
  const achs = portfolio.achievements || [];
  if (achs.length) {
    achs.forEach(a => lines.push(`- ${typeof a === 'string' ? a : JSON.stringify(a)}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // EXTERNAL LINKS
  lines.push('EXTERNAL LINKS');
  const links = prof.socialLinks || [];
  if (links.length) {
    links.forEach(l => lines.push(`- ${l.platform || 'Link'}: ${l.url}`));
  } else {
    lines.push('Not available');
  }
  lines.push('');

  // OTHER EXTRACTED CONTENT
  lines.push('OTHER EXTRACTED CONTENT');
  lines.push(portfolio.plainTextSummary || 'None.');

  return lines.join('\n');
}

function buildOtherSourcesText(extractedData = {}) {
  const sections = [];

  if (extractedData.gfg && extractedData.gfg.extracted) {
    const gfg = extractedData.gfg;
    sections.push(`===== GEEKSFORGEEKS =====
Problems Solved: ${gfg.totalProblemsSolved || 0}
Coding Score: ${gfg.codingScore || 0}
Monthly Score: ${gfg.monthlyScore || 0}`);
  }

  if (extractedData.figma && extractedData.figma.extracted) {
    const figma = extractedData.figma;
    sections.push(`===== FIGMA =====
Design Projects: ${(figma.projects || []).length}
Tools / Skills: ${(figma.tools || []).join(', ')}`);
  }

  return sections.length ? sections.join('\n\n') : '===== OTHER SOURCES =====\nNone.';
}

function toCombinedPromptText(sourceTexts = {}, targetRole = '') {
  const parts = [];

  parts.push(`CANDIDATE TARGET ROLE: ${targetRole || 'Not specified'}`);
  parts.push('');

  if (sourceTexts.resumeText) parts.push(sourceTexts.resumeText);
  if (sourceTexts.githubText) parts.push(sourceTexts.githubText);
  if (sourceTexts.linkedinText) parts.push(sourceTexts.linkedinText);
  if (sourceTexts.leetcodeText) parts.push(sourceTexts.leetcodeText);
  if (sourceTexts.portfolioText) parts.push(sourceTexts.portfolioText);
  if (sourceTexts.otherSourcesText && !sourceTexts.otherSourcesText.includes('None.')) {
    parts.push(sourceTexts.otherSourcesText);
  }

  return parts.join('\n\n');
}

function formatBytes(bytes) {
  if (!bytes) return '0B';
  if (bytes > 1000000) return `${(bytes / 1000000).toFixed(1)}MB`;
  if (bytes > 1000) return `${(bytes / 1000).toFixed(1)}KB`;
  return `${bytes}B`;
}

module.exports = {
  normalizeAllSourceTexts,
  buildResumeSourceText,
  buildGithubSourceText,
  buildLinkedinSourceText,
  buildLeetcodeSourceText,
  buildPortfolioSourceText,
  buildOtherSourcesText,
  toCombinedPromptText
};
