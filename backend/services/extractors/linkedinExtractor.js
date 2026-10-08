const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdf = require('pdf-parse');
const { generateJson } = require('../aiProvider');

// Curated list of known technical skills & frameworks for deterministic matching
const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Dart', 'R', 'Scala', 'MATLAB', 'SQL', 'HTML', 'HTML5', 'CSS', 'CSS3', 'Sass', 'SCSS',
  'React', 'React.js', 'React Native', 'Next.js', 'Vue', 'Vue.js', 'Nuxt.js', 'Angular', 'AngularJS', 'Svelte', 'Node.js', 'Express', 'Express.js', 'Nest.js', 'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Ruby on Rails', 'ASP.NET', '.NET', 'Laravel',
  'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Cassandra', 'Elasticsearch', 'DynamoDB', 'Oracle Database', 'Firebase', 'Supabase', 'Prisma', 'Mongoose',
  'AWS', 'Amazon Web Services', 'Azure', 'Microsoft Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Jenkins', 'Terraform', 'Linux', 'Nginx', 'Apache', 'GraphQL', 'REST API', 'Microservices',
  'Machine Learning', 'Deep Learning', 'Artificial Intelligence', 'Data Science', 'Data Analysis', 'NLP', 'Computer Vision', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy', 'OpenCV', 'Tableau', 'Power BI',
  'Figma', 'UI/UX Design', 'Agile', 'Scrum', 'Jira', 'Unit Testing', 'Jest', 'Mocha', 'Cypress', 'Selenium', 'Tailwind CSS', 'Bootstrap', 'Redux', 'System Design'
];

/**
 * Extract comprehensive data from LinkedIn profile URL or uploaded LinkedIn PDF.
 * Pipeline:
 *  1. Retrieve raw content (Jina Reader, Firecrawl, Tavily, direct HTML, or PDF parse)
 *  2. Run deterministic parser on raw text / JSON-LD / metadata
 *  3. Send raw text to external AI API for refined structuring
 *  4. If AI fails/429/timeout, gracefully return deterministic structured data
 *  5. Build normalized schema with evidence tracing
 */
async function extractLinkedinData(linkedinUrlOrOptions, maybePdfBuffer = null) {
  let linkedinUrl = '';
  let pdfPath = null;
  let pdfBuffer = maybePdfBuffer;

  if (typeof linkedinUrlOrOptions === 'string') {
    linkedinUrl = linkedinUrlOrOptions.trim();
  } else if (linkedinUrlOrOptions && typeof linkedinUrlOrOptions === 'object') {
    linkedinUrl = linkedinUrlOrOptions.url || linkedinUrlOrOptions.linkedinUrl || '';
    pdfPath = linkedinUrlOrOptions.pdfPath || null;
    pdfBuffer = linkedinUrlOrOptions.pdfBuffer || maybePdfBuffer;
  }

  if (!linkedinUrl && !pdfPath && !pdfBuffer) return null;

  const cleanUrl = linkedinUrl ? cleanLinkedinUrl(linkedinUrl) : null;
  const username = cleanUrl ? parseLinkedinUsername(cleanUrl) : null;

  let rawContent = '';
  let retrievalMethod = 'none';
  const warnings = [];

  // 1. If PDF was provided (e.g., student uploaded LinkedIn profile PDF)
  if (pdfPath || pdfBuffer) {
    try {
      const buffer = pdfBuffer || fs.readFileSync(path.resolve(pdfPath));
      const parsedPdf = await pdf(buffer);
      rawContent = parsedPdf.text || '';
      retrievalMethod = 'pdf_upload';
    } catch (pdfErr) {
      console.warn('[LinkedIn] PDF parsing failed:', pdfErr.message);
      warnings.push(`PDF parsing error: ${pdfErr.message}`);
    }
  }

  // 2. Multi-source web retrieval if PDF not provided or gave insufficient text
  if (cleanUrl && rawContent.trim().length < 50) {
    const webResult = await fetchWebLinkedinContent(cleanUrl, username);
    rawContent = webResult.content || '';
    retrievalMethod = webResult.method;
    if (webResult.warnings.length) warnings.push(...webResult.warnings);
  }

  const contentLength = rawContent.trim().length;
  const retrievalSuccess = contentLength >= 30;

  // If completely inaccessible
  if (!retrievalSuccess) {
    return {
      source: 'linkedin',
      url: cleanUrl,
      username,
      extracted: false,
      reason: 'Could not retrieve public LinkedIn profile content. LinkedIn profiles may be private or restricted.',
      profile: { name: null, headline: null, location: null, about: null, profileUrl: cleanUrl },
      name: null,
      headline: null,
      location: null,
      about: null,
      currentCompany: null,
      currentRole: null,
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      projects: [],
      volunteering: [],
      awards: [],
      publications: [],
      languages: [],
      evidence: [],
      sourceQuality: {
        retrievalSuccess: false,
        contentLength: 0,
        sectionsDetected: [],
        evidenceCount: 0,
        method: retrievalMethod
      },
      warnings: ['Profile inaccessible via public channels. You can upload your LinkedIn Profile PDF for full analysis.'],
      extractedAt: new Date().toISOString()
    };
  }

  // 3. Deterministic Pre-Extraction (always succeeds, zero AI dependency)
  const deterministicData = parseLinkedinContentDeterministically(rawContent, cleanUrl, username);

  // 4. AI Structuring (enhances data if AI is available)
  let aiStructured = null;
  try {
    const prompt = buildLinkedinStructuringPrompt(rawContent, cleanUrl);
    const { data: aiData, provider } = await generateJson(prompt, 'LinkedIn structuring');
    if (aiData && typeof aiData === 'object') {
      aiStructured = aiData;
      retrievalMethod = `${retrievalMethod}+${provider.toLowerCase()}`;
    }
  } catch (aiErr) {
    console.warn('[LinkedIn] AI structuring unavailable; falling back to deterministic extraction:', aiErr.message);
    warnings.push('AI structuring temporarily unavailable; using deterministic evidence extraction.');
    retrievalMethod = `${retrievalMethod}+deterministic`;
  }

  // 5. Merge and normalize into the standard CareerLens LinkedIn schema
  return mergeAndNormalizeLinkedin(deterministicData, aiStructured, rawContent, cleanUrl, username, retrievalMethod, warnings);
}

/**
 * Fetch public LinkedIn profile content using cascading retrieval mechanisms.
 */
async function fetchWebLinkedinContent(url, username) {
  let content = '';
  let method = 'none';
  const warnings = [];

  // A. Jina Reader (Specialized markdown converter)
  if (process.env.JINA_API_KEY) {
    try {
      const res = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
          'Accept': 'text/plain',
          'X-Target-Selector': 'main, #profile-content, .core-rail, article'
        },
        timeout: 20000
      });
      if (res.data && String(res.data).trim().length > 50) {
        content = String(res.data).trim();
        method = 'jina_reader';
      }
    } catch (err) {
      console.warn('[LinkedIn] Jina Reader warning:', err.message);
    }
  }

  // B. Firecrawl Scraper Fallback
  if (!content && process.env.FIRECRAWL_API_KEY) {
    try {
      const res = await axios.post('https://api.firecrawl.dev/v1/scrape', {
        url,
        formats: ['markdown']
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });
      if (res.data?.data?.markdown && res.data.data.markdown.trim().length > 50) {
        content = res.data.data.markdown.trim();
        method = 'firecrawl';
      }
    } catch (err) {
      console.warn('[LinkedIn] Firecrawl warning:', err.message);
    }
  }

  // C. Tavily Search for Public Snippets
  if (process.env.TAVILY_API_KEY && username && content.length < 300) {
    try {
      const searchRes = await axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query: `site:linkedin.com/in/${username} OR "${username}" linkedin`,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 5
      }, { timeout: 15000 });

      const snippets = (searchRes.data?.results || [])
        .map(r => `${r.title}\n${r.content}`)
        .join('\n\n');

      if (snippets.trim().length > 50) {
        content = content ? `${content}\n\n--- SEARCH SNIPPETS ---\n${snippets}` : snippets;
        if (method === 'none') method = 'tavily_search';
      }
    } catch (err) {
      console.warn('[LinkedIn] Tavily search warning:', err.message);
    }
  }

  // D. Direct HTTP fetch fallback (extracts OpenGraph meta tags / JSON-LD / Title)
  if (!content) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 10000
      });
      if (res.data && typeof res.data === 'string') {
        const extractedMeta = extractMetaAndJsonLd(res.data);
        if (extractedMeta.length > 30) {
          content = extractedMeta;
          method = 'direct_html_meta';
        }
      }
    } catch (err) {
      console.warn('[LinkedIn] Direct fetch warning:', err.message);
    }
  }

  return { content, method, warnings };
}

/**
 * Extract OpenGraph tags, title, meta description, and JSON-LD from raw HTML.
 */
function extractMetaAndJsonLd(html) {
  const parts = [];

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) parts.push(`Title: ${titleMatch[1].trim()}`);

  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitle) parts.push(`OG Title: ${ogTitle[1].trim()}`);

  const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (ogDesc) parts.push(`OG Description: ${ogDesc[1].trim()}`);

  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (metaDesc && (!ogDesc || metaDesc[1] !== ogDesc[1])) {
    parts.push(`Description: ${metaDesc[1].trim()}`);
  }

  // Extract JSON-LD scripts
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      parts.push(`JSON-LD: ${JSON.stringify(parsed)}`);
    } catch (_) {}
  }

  return parts.join('\n');
}

/**
 * Parse LinkedIn text deterministically using pattern matching and skills dictionaries.
 */
function parseLinkedinContentDeterministically(text, url, username) {
  const result = {
    name: null,
    headline: null,
    location: null,
    about: null,
    currentCompany: null,
    currentRole: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    languages: [],
    volunteering: [],
    awards: [],
    publications: []
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Extract Name
  const namePatterns = [
    /Title:\s*([^|\-–]+)/i,
    /OG Title:\s*([^|\-–]+)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:[-–|]|$)/,
    /^#\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/
  ];

  for (const pattern of namePatterns) {
    const m = text.match(pattern);
    if (m && m[1] && !m[1].includes('LinkedIn') && !m[1].includes('Sign In') && !m[1].includes('HTTP')) {
      result.name = m[1].trim();
      break;
    }
  }

  if (!result.name && username) {
    result.name = username.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // 2. Extract Headline & Location
  const headlinePatterns = [
    /OG Description:\s*([^\n.]+)/i,
    /Description:\s*([^\n.]+)/i,
    /(?:Headline|Current):\s*([^\n]+)/i
  ];
  for (const p of headlinePatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      result.headline = m[1].trim();
      break;
    }
  }

  const locationPattern = /(?:Location|Based in|Area):\s*([A-Za-z\s,]+)/i;
  const locMatch = text.match(locationPattern);
  if (locMatch) result.location = locMatch[1].trim();

  // 3. Extract Observable Skills
  const observedSkills = new Set();
  const textLower = ` ${text.toLowerCase()} `;
  for (const skill of KNOWN_SKILLS) {
    const pattern = new RegExp(`[\\s,.(]${skill.replace(/[+#]/g, '\\$&').toLowerCase()}[\\s,.)]`, 'i');
    if (pattern.test(textLower)) {
      observedSkills.add(skill);
    }
  }
  result.skills = Array.from(observedSkills);

  // 4. Extract Experience & Roles
  const expRegex = /(?:Senior |Junior |Lead |Principal |Staff )?(?:Software|Full[\s-]Stack|Frontend|Backend|DevOps|Data|Mobile|Cloud|Security|ML|AI|QA)?\s*(?:Engineer|Developer|Architect|Analyst|Scientist|Intern|Manager|Consultant)\s+(?:at|@)\s+([A-Za-z0-9\s&,.-]+)/gi;
  let expMatch;
  while ((expMatch = expRegex.exec(text)) !== null) {
    const roleTitle = expMatch[0].trim();
    const company = expMatch[1]?.trim() || '';
    if (company.length < 50 && !result.experience.some(e => e.company === company)) {
      result.experience.push({
        role: roleTitle,
        company,
        duration: '',
        description: '',
        skills: []
      });
      if (!result.currentCompany) {
        result.currentCompany = company;
        result.currentRole = roleTitle;
      }
    }
  }

  // 5. Extract Education
  const eduRegex = /(?:Bachelor|Master|B\.?Tech|M\.?Tech|B\.?S|M\.?S|Ph\.?D|Diploma|Degree)\s*(?:of|in)?\s*([A-Za-z\s&,.-]+)?\s*(?:at|from|,)?\s*([A-Za-z\s&,.-]+(?:University|College|Institute|School|Academy)[A-Za-z\s&,.-]*)/gi;
  let eduMatch;
  while ((eduMatch = eduRegex.exec(text)) !== null) {
    const degree = eduMatch[0].trim();
    const inst = eduMatch[2]?.trim() || '';
    if (inst.length < 60 && !result.education.some(e => e.institution === inst)) {
      result.education.push({
        institution: inst,
        degree,
        fieldOfStudy: eduMatch[1]?.trim() || '',
        startYear: '',
        endYear: '',
        grade: ''
      });
    }
  }

  // 6. Extract Certifications
  const certKeywords = ['AWS Certified', 'Google Cloud Certified', 'Azure Certified', 'Certified Kubernetes', 'Oracle Certified', 'Meta Certified', 'Coursera', 'HackerRank'];
  for (const cert of certKeywords) {
    if (text.includes(cert)) {
      result.certifications.push({
        name: cert,
        issuer: cert.split(' ')[0],
        issueDate: '',
        credentialId: ''
      });
    }
  }

  return result;
}

/**
 * Strict AI Prompt for LinkedIn Structuring.
 * Strictly adheres to rule: Extract ONLY facts present in text; never invent.
 */
function buildLinkedinStructuringPrompt(rawText, profileUrl) {
  return `You are CareerLens LinkedIn Extractor. Analyze the following extracted LinkedIn profile evidence and structure it into JSON.

STRICT RULES:
1. Extract ONLY information explicitly supported by the supplied LinkedIn evidence.
2. Never invent skills, jobs, companies, education, projects, dates, certifications, achievements, URLs, or locations.
3. If information is missing, return null or [].
4. Do NOT infer a skill merely because a job title suggests it.
5. Do NOT infer technologies from a company or job title.
6. Return a valid JSON object only.

Return ONLY this JSON schema:
{
  "profile": {
    "name": "Full Name or null",
    "headline": "Headline or null",
    "location": "Location or null",
    "about": "About summary or null",
    "profileUrl": "${profileUrl || ''}"
  },
  "currentCompany": "Company name or null",
  "currentRole": "Role title or null",
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "location": "Location or null",
      "duration": "Duration or null",
      "startDate": "Start Date or null",
      "endDate": "End Date or null",
      "description": "Responsibilities / description or null",
      "skills": ["Skills explicitly tied to this role"]
    }
  ],
  "education": [
    {
      "institution": "University / College",
      "degree": "Degree title or null",
      "fieldOfStudy": "Field of study or null",
      "startYear": "Start year or null",
      "endYear": "End year or null",
      "grade": "Grade / GPA or null",
      "description": "Details or null"
    }
  ],
  "skills": ["Explicitly listed skills"],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Org or null",
      "issueDate": "Issue Date or null",
      "credentialId": "ID or null",
      "url": "URL or null"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Description or null",
      "technologies": ["Tech used"],
      "url": "URL or null"
    }
  ],
  "volunteering": [
    {
      "role": "Volunteer role",
      "organization": "Org name",
      "cause": "Cause or null"
    }
  ],
  "awards": ["Award title"],
  "publications": [{"title": "Title", "publisher": "Publisher or null", "date": "Date or null"}],
  "languages": [{"language": "Language", "proficiency": "Proficiency or null"}]
}

LINKEDIN EVIDENCE:
${rawText.substring(0, 4500)}`;
}

/**
 * Merge deterministic and AI extraction results into the normalized CareerLens schema.
 */
function mergeAndNormalizeLinkedin(deterministic, ai, rawContent, url, username, method, warnings) {
  const name = ai?.profile?.name || ai?.name || deterministic.name || null;
  const headline = ai?.profile?.headline || ai?.headline || deterministic.headline || null;
  const location = ai?.profile?.location || ai?.location || deterministic.location || null;
  const about = ai?.profile?.about || ai?.about || deterministic.about || null;
  const currentCompany = ai?.currentCompany || deterministic.currentCompany || null;
  const currentRole = ai?.currentRole || deterministic.currentRole || null;

  const experience = (Array.isArray(ai?.experience) && ai.experience.length > 0)
    ? ai.experience
    : deterministic.experience;

  const education = (Array.isArray(ai?.education) && ai.education.length > 0)
    ? ai.education
    : deterministic.education;

  // Merge skills without duplicates
  const allSkillsSet = new Set([
    ...(Array.isArray(ai?.skills) ? ai.skills : []),
    ...deterministic.skills
  ].filter(Boolean).map(s => String(s).trim()));
  const skills = Array.from(allSkillsSet);

  const certifications = (Array.isArray(ai?.certifications) && ai.certifications.length > 0)
    ? ai.certifications
    : deterministic.certifications;

  const projects = Array.isArray(ai?.projects) ? ai.projects : deterministic.projects;
  const volunteering = Array.isArray(ai?.volunteering) ? ai.volunteering : deterministic.volunteering;
  const awards = Array.isArray(ai?.awards) ? ai.awards : deterministic.awards;
  const publications = Array.isArray(ai?.publications) ? ai.publications : deterministic.publications;
  const languages = Array.isArray(ai?.languages) ? ai.languages : deterministic.languages;

  // Build explicit Evidence items
  const evidence = [];
  for (const skill of skills) {
    evidence.push({
      skill,
      status: 'observed',
      evidence: `${skill} appears in the supplied LinkedIn profile evidence`,
      source: 'linkedin',
      confidence: 0.95
    });
  }
  for (const exp of experience) {
    if (exp.company) {
      evidence.push({
        claim: `Experience at ${exp.company}`,
        status: 'observed',
        role: exp.role,
        company: exp.company,
        duration: exp.duration,
        source: 'linkedin',
        confidence: 0.90
      });
    }
  }

  const sectionsDetected = [];
  if (experience.length) sectionsDetected.push('experience');
  if (education.length) sectionsDetected.push('education');
  if (skills.length) sectionsDetected.push('skills');
  if (certifications.length) sectionsDetected.push('certifications');
  if (projects.length) sectionsDetected.push('projects');

  return {
    source: 'linkedin',
    url,
    username,
    extracted: true,
    method,
    profile: {
      name,
      headline,
      location,
      about,
      profileUrl: url
    },
    name,
    headline,
    location,
    about,
    currentCompany,
    currentRole,
    experience,
    education,
    skills,
    certifications,
    projects,
    volunteering,
    awards,
    publications,
    languages,
    evidence,
    sourceQuality: {
      retrievalSuccess: true,
      contentLength: rawContent.length,
      sectionsDetected,
      evidenceCount: evidence.length,
      method
    },
    warnings,
    extractedAt: new Date().toISOString()
  };
}

function cleanLinkedinUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

function parseLinkedinUsername(url) {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

module.exports = {
  extractLinkedinData,
  cleanLinkedinUrl,
  parseLinkedinUsername,
  parseLinkedinContentDeterministically
};
