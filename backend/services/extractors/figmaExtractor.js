const axios = require('axios');
const { generateJson } = require('../aiProvider');

/**
 * Extract data from Figma profile/links using Jina.
 */
async function extractFigmaData(figmaUrl) {
  if (!figmaUrl) return null;

  let pageContent = '';

  // Use Jina to extract content
  if (process.env.JINA_API_KEY) {
    try {
      const res = await axios.get(`https://r.jina.ai/${figmaUrl}`, {
        headers: {
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
          'Accept': 'text/plain'
        },
        timeout: 30000
      });
      pageContent = res.data;
    } catch (err) {
      console.warn('Jina Figma extraction failed:', err.message);
    }
  }

  if (!pageContent || pageContent.trim().length < 30) {
    return {
      source: 'figma',
      url: figmaUrl,
      extracted: false,
      reason: 'Could not extract Figma content. Figma projects may require access permissions.',
      extractedAt: new Date().toISOString()
    };
  }

  try {
    const { data: parsed } = await generateJson(`Extract Figma/design profile data. Return ONLY valid JSON:
{
  "projects": [{"name": "", "description": "", "type": ""}],
  "designWork": [],
  "skills": [],
  "tools": []
}
Only extract explicit data. Do NOT invent.

Page content:
${pageContent.substring(0, 2000)}`, 'Figma extraction');
    return { source: 'figma', url: figmaUrl, extracted: true, ...parsed, extractedAt: new Date().toISOString() };
  } catch (err) {
    console.warn('Figma extraction providers failed:', err.message);
  }

  return {
    source: 'figma',
    url: figmaUrl,
    extracted: false,
    reason: 'Could not structure Figma data',
    extractedAt: new Date().toISOString()
  };
}

module.exports = { extractFigmaData };
