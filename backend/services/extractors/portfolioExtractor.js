const axios = require('axios');
const { generateJson } = require('../aiProvider');

// Curated list of technical skills for deterministic portfolio parsing
const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Dart', 'SQL', 'HTML', 'HTML5', 'CSS', 'CSS3', 'Sass', 'SCSS',
  'React', 'React.js', 'React Native', 'Next.js', 'Vue', 'Vue.js', 'Nuxt.js', 'Angular', 'AngularJS', 'Svelte', 'Node.js', 'Express', 'Express.js', 'Nest.js', 'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Ruby on Rails', 'ASP.NET', 'Laravel',
  'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Cassandra', 'Elasticsearch', 'DynamoDB', 'Firebase', 'Supabase', 'Prisma', 'Mongoose',
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Jenkins', 'Terraform', 'Linux', 'Nginx', 'GraphQL', 'REST API', 'Microservices', 'WebSockets',
  'Tailwind CSS', 'Tailwind', 'Bootstrap', 'Material UI', 'Chakra UI', 'Figma', 'UI/UX', 'Redux', 'Zustand', 'Three.js', 'WebAssembly',
  'Machine Learning', 'Deep Learning', 'Data Science', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy', 'OpenCV', 'Jest', 'Cypress'
];

/**
 * Deep Portfolio Website Extractor.
 * Scrapes portfolio websites using Jina AI Reader + Firecrawl,
 * performs deterministic extraction + AI structuring,
 * and formats a compact plain-text representation for future AI prompts.
 */
async function extractPortfolioData(portfolioUrl) {
  if (!portfolioUrl) return null;

  const cleanUrl = cleanWebsiteUrl(portfolioUrl);
  let rawMarkdown = '';
  let method = 'none';
  const warnings = [];

  // 1. Primary Scraper: Jina AI Reader (rich markdown with links and section structure)
  if (process.env.JINA_API_KEY) {
    try {
      const res = await axios.get(`https://r.jina.ai/${cleanUrl}`, {
        headers: {
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
          'Accept': 'text/plain',
          'X-With-Generated-Alt': 'true',
          'X-With-Links-Summary': 'true',
          'X-Target-Selector': 'main, #root, #app, #__next, .portfolio, body'
        },
        timeout: 25000
      });
      if (res.data && String(res.data).trim().length > 60) {
        rawMarkdown = String(res.data).trim();
        method = 'jina_reader';
      }
    } catch (err) {
      console.warn('[Portfolio] Jina Reader warning:', err.message);
    }
  }

  // 2. Secondary Scraper: Firecrawl API (full page scrape with markdown & metadata)
  if (process.env.FIRECRAWL_API_KEY && rawMarkdown.length < 300) {
    try {
      const res = await axios.post('https://api.firecrawl.dev/v1/scrape', {
        url: cleanUrl,
        formats: ['markdown', 'html']
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      if (res.data?.data?.markdown && res.data.data.markdown.trim().length > 60) {
        const firecrawlMd = res.data.data.markdown.trim();
        rawMarkdown = rawMarkdown ? `${rawMarkdown}\n\n--- FIRECRAWL CONTENT ---\n${firecrawlMd}` : firecrawlMd;
        if (method === 'none') method = 'firecrawl';
      }
    } catch (err) {
      console.warn('[Portfolio] Firecrawl warning:', err.message);
    }
  }

  // 3. Tertiary Direct Fallback (Axios HTTP metadata fetch if scraping services unavailable)
  if (!rawMarkdown) {
    try {
      const res = await axios.get(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 12000
      });
      if (res.data && typeof res.data === 'string') {
        const metaText = extractHtmlTextAndMeta(res.data);
        if (metaText.length > 50) {
          rawMarkdown = metaText;
          method = 'direct_html';
        }
      }
    } catch (err) {
      console.warn('[Portfolio] Direct fetch warning:', err.message);
    }
  }

  if (!rawMarkdown || rawMarkdown.trim().length < 30) {
    return {
      source: 'portfolio',
      url: cleanUrl,
      extracted: false,
      reason: 'Could not extract content from portfolio website. The site may be offline or inaccessible.',
      extractedAt: new Date().toISOString()
    };
  }

  // 4. Deterministic Pre-Extraction (never crashes, guarantees baseline data)
  const deterministic = parsePortfolioDeterministically(rawMarkdown, cleanUrl);

  // 5. AI Structuring (enhances data with deep semantics when AI APIs are available)
  let aiStructured = null;
  try {
    const prompt = buildPortfolioAiPrompt(rawMarkdown, cleanUrl);
    const { data: aiData, provider } = await generateJson(prompt, 'Portfolio structuring');
    if (aiData && typeof aiData === 'object') {
      aiStructured = aiData;
      method = `${method}+${provider.toLowerCase()}`;
    }
  } catch (aiErr) {
    console.warn('[Portfolio] AI structuring unavailable; using deterministic extraction:', aiErr.message);
    warnings.push('AI structuring temporarily unavailable; using deterministic extraction.');
    method = `${method}+deterministic`;
  }

  // 6. Merge, deduplicate, and normalize
  const finalData = mergePortfolioData(deterministic, aiStructured, rawMarkdown, cleanUrl, method, warnings);

  // 7. Generate clean plain text format for future AI prompt ingestion
  finalData.plainTextSummary = buildPortfolioPlainText(finalData);

  return finalData;
}

/**
 * Deterministically parse markdown text from portfolio.
 */
function parsePortfolioDeterministically(markdown, url) {
  const result = {
    profile: {
      name: null,
      title: null,
      bio: null,
      location: null,
      email: null,
      socialLinks: []
    },
    projects: [],
    skills: {
      languages: [],
      frameworks: [],
      databases: [],
      tools: [],
      all: []
    },
    experience: [],
    education: [],
    certifications: [],
    achievements: []
  };

  // Extract Emails
  const emailMatch = markdown.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
  if (emailMatch && !emailMatch[1].includes('example') && !emailMatch[1].includes('schema.org')) {
    result.profile.email = emailMatch[1];
  }

  // Extract Social & Project Links (GitHub, LinkedIn, Twitter/X)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let linkMatch;
  const seenUrls = new Set();

  while ((linkMatch = linkRegex.exec(markdown)) !== null) {
    const linkText = linkMatch[1].trim();
    const linkUrl = linkMatch[2].trim();

    if (seenUrls.has(linkUrl)) continue;
    seenUrls.add(linkUrl);

    if (/github\.com\/[a-zA-Z0-9_-]+/i.test(linkUrl) && !linkUrl.includes('/topics/')) {
      if (/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+/i.test(linkUrl)) {
        // Project Repo Link
        const repoName = linkUrl.split('/').pop().replace(/\.git$/, '');
        if (!result.projects.some(p => p.githubUrl === linkUrl)) {
          result.projects.push({
            name: linkText.length > 2 && linkText.length < 50 ? linkText : repoName,
            description: '',
            technologies: [],
            liveUrl: '',
            githubUrl: linkUrl,
            highlights: []
          });
        }
      } else {
        result.profile.socialLinks.push({ platform: 'github', url: linkUrl });
      }
    } else if (/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i.test(linkUrl)) {
      result.profile.socialLinks.push({ platform: 'linkedin', url: linkUrl });
    } else if (/twitter\.com|x\.com\/[a-zA-Z0-9_]+/i.test(linkUrl)) {
      result.profile.socialLinks.push({ platform: 'twitter', url: linkUrl });
    }
  }

  // Extract Name & Headline from Header (# Name | Title)
  const headerMatch = markdown.match(/^#+\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s*[-–|:]\s*([^\n]+))?/m);
  if (headerMatch) {
    result.profile.name = headerMatch[1].trim();
    if (headerMatch[2]) result.profile.title = headerMatch[2].trim();
  }

  // Extract Bio / About paragraph
  const aboutMatch = markdown.match(/(?:About\s*Me|Bio|Introduction|Who\s*I\s*Am)[\s\S]*?\n\n([^\n#]+)/i);
  if (aboutMatch && aboutMatch[1]) {
    result.profile.bio = aboutMatch[1].trim();
  }

  // Extract Skills
  const textLower = ` ${markdown.toLowerCase()} `;
  const detectedSkills = new Set();
  for (const skill of KNOWN_SKILLS) {
    const pattern = new RegExp(`[\\s,.(#*_-]${skill.replace(/[+#]/g, '\\$&').toLowerCase()}[\\s,.)#*_-]`, 'i');
    if (pattern.test(textLower)) {
      detectedSkills.add(skill);
    }
  }

  result.skills.all = Array.from(detectedSkills);

  // Categorize Skills
  const langList = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'SQL', 'HTML', 'CSS'];
  const fwList = ['React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Nest.js', 'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Tailwind CSS', 'Redux'];
  const dbList = ['MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Cassandra', 'Elasticsearch', 'Firebase', 'Supabase'];
  const toolList = ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'GitHub', 'Figma', 'Linux', 'GraphQL'];

  result.skills.languages = result.skills.all.filter(s => langList.some(l => l.toLowerCase() === s.toLowerCase()));
  result.skills.frameworks = result.skills.all.filter(s => fwList.some(f => f.toLowerCase() === s.toLowerCase()));
  result.skills.databases = result.skills.all.filter(s => dbList.some(d => d.toLowerCase() === s.toLowerCase()));
  result.skills.tools = result.skills.all.filter(s => toolList.some(t => t.toLowerCase() === s.toLowerCase()));

  return result;
}

/**
 * AI Prompt for detailed portfolio structuring.
 */
function buildPortfolioAiPrompt(rawMarkdown, url) {
  return `You are CareerLens Portfolio Extractor. Analyze this portfolio website markdown and extract structured information.

STRICT INSTRUCTIONS:
1. Extract only information explicitly present in the portfolio content.
2. Never invent projects, companies, technologies, or degrees not mentioned.
3. For projects, extract project title, description, technologies used, live URL, and github URL.
4. Categorize skills into languages, frameworks, databases, and tools.
5. If a section has no data, return empty array [].
6. Return valid JSON only.

Return ONLY this JSON schema:
{
  "profile": {
    "name": "Full Name or null",
    "title": "Professional Title / Headline or null",
    "bio": "About / Bio description or null",
    "location": "Location or null",
    "email": "Email address or null",
    "socialLinks": [
      {"platform": "github|linkedin|twitter|portfolio|other", "url": "https://..."}
    ]
  },
  "projects": [
    {
      "name": "Project Name",
      "description": "Project overview and features",
      "technologies": ["React", "Node.js"],
      "liveUrl": "https://... or null",
      "githubUrl": "https://... or null",
      "highlights": ["Notable feature or achievement"]
    }
  ],
  "skills": {
    "languages": ["JavaScript", "Python"],
    "frameworks": ["React", "Express"],
    "databases": ["MongoDB", "PostgreSQL"],
    "tools": ["Git", "Docker", "Figma"],
    "all": ["JavaScript", "Python", "React", "Express", "MongoDB", "PostgreSQL", "Git", "Docker", "Figma"]
  },
  "experience": [
    {
      "role": "Job / Internship Title",
      "company": "Company Name",
      "duration": "Dates / Duration",
      "description": "Key contributions",
      "technologies": ["Technologies used"]
    }
  ],
  "education": [
    {
      "institution": "University / College",
      "degree": "Degree / Major",
      "year": "Graduation Year / Dates"
    }
  ],
  "certifications": [
    {
      "title": "Certification / Award Name",
      "issuer": "Issuing Organization",
      "year": "Year"
    }
  ],
  "achievements": ["Hackathon award or achievement"]
}

PORTFOLIO CONTENT:
${rawMarkdown.substring(0, 5000)}`;
}

/**
 * Merge deterministic and AI data into standard schema.
 */
function mergePortfolioData(deterministic, ai, rawMarkdown, url, method, warnings) {
  const profile = {
    name: ai?.profile?.name || deterministic.profile.name || 'Portfolio Developer',
    title: ai?.profile?.title || deterministic.profile.title || null,
    bio: ai?.profile?.bio || deterministic.profile.bio || null,
    location: ai?.profile?.location || deterministic.profile.location || null,
    email: ai?.profile?.email || deterministic.profile.email || null,
    socialLinks: mergeSocialLinks(deterministic.profile.socialLinks, ai?.profile?.socialLinks)
  };

  // Projects: merge and deduplicate by name
  const projectsMap = new Map();
  const rawProjects = [
    ...(Array.isArray(ai?.projects) ? ai.projects : []),
    ...deterministic.projects
  ];

  rawProjects.forEach(p => {
    if (!p || !p.name) return;
    const key = p.name.toLowerCase().trim();
    if (!projectsMap.has(key)) {
      projectsMap.set(key, {
        name: p.name,
        description: p.description || '',
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        liveUrl: p.liveUrl || p.url || '',
        githubUrl: p.githubUrl || '',
        highlights: Array.isArray(p.highlights) ? p.highlights : []
      });
    } else {
      const existing = projectsMap.get(key);
      if (!existing.description && p.description) existing.description = p.description;
      if (!existing.liveUrl && p.liveUrl) existing.liveUrl = p.liveUrl;
      if (!existing.githubUrl && p.githubUrl) existing.githubUrl = p.githubUrl;
      if (p.technologies?.length) {
        existing.technologies = [...new Set([...existing.technologies, ...p.technologies])];
      }
    }
  });

  const projects = Array.from(projectsMap.values());

  // Skills
  const allSkillsSet = new Set([
    ...(Array.isArray(ai?.skills?.all) ? ai.skills.all : []),
    ...(Array.isArray(ai?.skills) ? ai.skills : []),
    ...deterministic.skills.all
  ].filter(Boolean));

  const skills = {
    languages: ai?.skills?.languages?.length ? ai.skills.languages : deterministic.skills.languages,
    frameworks: ai?.skills?.frameworks?.length ? ai.skills.frameworks : deterministic.skills.frameworks,
    databases: ai?.skills?.databases?.length ? ai.skills.databases : deterministic.skills.databases,
    tools: ai?.skills?.tools?.length ? ai.skills.tools : deterministic.skills.tools,
    all: Array.from(allSkillsSet)
  };

  const experience = Array.isArray(ai?.experience) && ai.experience.length > 0
    ? ai.experience
    : deterministic.experience;

  const education = Array.isArray(ai?.education) && ai.education.length > 0
    ? ai.education
    : deterministic.education;

  const certifications = Array.isArray(ai?.certifications) && ai.certifications.length > 0
    ? ai.certifications
    : deterministic.certifications;

  const achievements = Array.isArray(ai?.achievements) ? ai.achievements : deterministic.achievements;

  return {
    source: 'portfolio',
    url,
    extracted: true,
    method,
    profile,
    projects,
    skills,
    experience,
    education,
    certifications,
    achievements,
    sourceQuality: {
      retrievalSuccess: true,
      contentLength: rawMarkdown.length,
      projectCount: projects.length,
      skillsCount: skills.all.length,
      method
    },
    rawMarkdown: rawMarkdown.substring(0, 8000),
    warnings,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Builds compact, highly structured plain text for future AI evaluation ingestion.
 */
function buildPortfolioPlainText(data) {
  const lines = [];

  lines.push(`PORTFOLIO OWNER: ${data.profile?.name || 'Developer'}`);
  if (data.profile?.title) lines.push(`TITLE / ROLE: ${data.profile.title}`);
  if (data.profile?.location) lines.push(`LOCATION: ${data.profile.location}`);
  if (data.profile?.bio) lines.push(`BIO: ${data.profile.bio}`);
  lines.push('');

  // Projects
  if (data.projects?.length) {
    lines.push(`PORTFOLIO PROJECTS (${data.projects.length}):`);
    data.projects.forEach(p => {
      const techStr = p.technologies?.length ? ` (${p.technologies.join(', ')})` : '';
      const descStr = p.description ? ` — ${p.description}` : '';
      const urls = [
        p.liveUrl ? `Live: ${p.liveUrl}` : '',
        p.githubUrl ? `GitHub: ${p.githubUrl}` : ''
      ].filter(Boolean).join(' | ');
      lines.push(`- ${p.name}${techStr}${descStr}${urls ? ` [${urls}]` : ''}`);
    });
    lines.push('');
  }

  // Skills
  if (data.skills?.all?.length) {
    lines.push('PORTFOLIO SKILLS:');
    if (data.skills.languages?.length) lines.push(`Languages: ${data.skills.languages.join(', ')}`);
    if (data.skills.frameworks?.length) lines.push(`Frameworks: ${data.skills.frameworks.join(', ')}`);
    if (data.skills.databases?.length) lines.push(`Databases: ${data.skills.databases.join(', ')}`);
    if (data.skills.tools?.length) lines.push(`Tools & Cloud: ${data.skills.tools.join(', ')}`);
    if (!data.skills.languages?.length && !data.skills.frameworks?.length) {
      lines.push(`All: ${data.skills.all.join(', ')}`);
    }
    lines.push('');
  }

  // Experience
  if (data.experience?.length) {
    lines.push('PORTFOLIO EXPERIENCE:');
    data.experience.forEach(exp => {
      lines.push(`- ${exp.role} at ${exp.company}${exp.duration ? ` (${exp.duration})` : ''}${exp.description ? ` — ${exp.description}` : ''}`);
    });
    lines.push('');
  }

  // Education
  if (data.education?.length) {
    lines.push('PORTFOLIO EDUCATION:');
    data.education.forEach(edu => {
      lines.push(`- ${edu.degree} at ${edu.institution}${edu.year ? ` (${edu.year})` : ''}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function mergeSocialLinks(links1 = [], links2 = []) {
  const map = new Map();
  [...links1, ...(Array.isArray(links2) ? links2 : [])].forEach(l => {
    if (l && l.url) map.set(l.url, l);
  });
  return Array.from(map.values());
}

function extractHtmlTextAndMeta(html) {
  const parts = [];
  const title = html.match(/<title>([^<]+)<\/title>/i);
  if (title) parts.push(`Title: ${title[1].trim()}`);

  const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (ogDesc) parts.push(`Description: ${ogDesc[1].trim()}`);

  const cleanText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  parts.push(cleanText);
  return parts.join('\n\n');
}

function cleanWebsiteUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

module.exports = {
  extractPortfolioData,
  buildPortfolioPlainText,
  parsePortfolioDeterministically
};
