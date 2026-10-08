const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const { generateJson } = require('../aiProvider');

/** Extract structured data from PDF/DOCX resume text using configured AI providers. */
async function extractResumeData(resumePath) {
  const absolutePath = path.resolve(resumePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Resume file not found');
  }

  let resumeText;
  try {
    resumeText = await extractResumeText(fs.readFileSync(absolutePath), path.extname(absolutePath));
  } catch (err) {
    throw new Error(`Failed to parse resume: ${err.message}`);
  }

  if (!resumeText || resumeText.trim().length < 10) {
    throw new Error('Resume text extraction returned insufficient content. Ensure your PDF or DOCX contains selectable text.');
  }

  const prompt = `You are a resume data extractor. Analyze the following resume text and extract structured information.

Return ONLY a valid JSON object with these fields:
{
  "personal": {"name": "", "email": "", "phone": "", "location": "", "summary": ""},
  "education": [{"degree": "", "institution": "", "year": ""}],
  "skills": ["skills explicitly stated"],
  "technologies": ["specific technologies, frameworks, libraries, tools mentioned"],
  "languages": ["programming languages explicitly stated"],
  "projects": [{"name": "project name", "description": "brief description", "technologies": ["tech used"]}],
  "experience": [{"role": "job title", "company": "company name", "duration": "time period", "description": "brief desc"}],
  "certifications": ["list of certifications"],
  "achievements": ["explicitly stated achievements"],
  "links": {"github": "", "portfolio": "", "linkedin": "", "other": []}
}

Rules:
- Only extract what is explicitly stated in the resume. Do NOT invent or assume anything.
- If a field has no data, use an empty object, empty array, or empty string matching its declared type.
- Skills and technologies should be specific (e.g., "React.js" not just "web development").
- Separate programming languages from frameworks/tools.

Resume text:
${resumeText}`;

  const { data: extracted, provider } = await generateJson(prompt, 'Resume extraction');

  return {
    rawText: resumeText,
    personal: objectOrEmpty(extracted.personal),
    education: arrayOrEmpty(extracted.education),
    skills: stringArrayOrEmpty(extracted.skills),
    technologies: stringArrayOrEmpty(extracted.technologies),
    languages: stringArrayOrEmpty(extracted.languages),
    projects: arrayOrEmpty(extracted.projects),
    experience: arrayOrEmpty(extracted.experience),
    certifications: stringArrayOrEmpty(extracted.certifications),
    achievements: stringArrayOrEmpty(extracted.achievements),
    links: objectOrEmpty(extracted.links),
    source: 'resume',
    extractionProvider: provider,
    extractedAt: new Date().toISOString()
  };
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function stringArrayOrEmpty(value) {
  return arrayOrEmpty(value).filter(item => typeof item === 'string');
}

async function extractResumeText(buffer, extension) {
  const fileExtension = extension.toLowerCase();
  if (fileExtension === '.pdf') {
    const pdfData = await pdf(buffer);
    return pdfData.text;
  }
  if (fileExtension !== '.docx') {
    throw new Error('Unsupported file type. Upload a PDF or DOCX resume.');
  }

  const archive = await JSZip.loadAsync(buffer);
  const documentFile = archive.file('word/document.xml');
  if (!documentFile || documentFile._data?.uncompressedSize > 25 * 1024 * 1024) {
    throw new Error('DOCX document is missing or exceeds the extraction size limit');
  }
  const xml = await documentFile.async('string');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) {
    throw new Error('Invalid DOCX document XML');
  }

  const paragraphs = Array.from(document.getElementsByTagName('w:p')).map(paragraph =>
    Array.from(paragraph.getElementsByTagName('w:t')).map(text => text.textContent || '').join('')
  );
  return paragraphs.filter(Boolean).join('\n');
}

module.exports = { extractResumeData, extractResumeText };
