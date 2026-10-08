const axios = require('axios');
const { generateJson } = require('../aiProvider');

/**
 * Extract data from GeeksforGeeks profile using Jina + Groq.
 */
async function extractGfgData(gfgUrl) {
  if (!gfgUrl) return null;

  const username = parseGfgUsername(gfgUrl);
  if (!username) {
    return { source: 'gfg', url: gfgUrl, extracted: false, reason: 'Could not parse GFG username' };
  }

  // Try GFG API
  let apiData = null;
  try {
    const res = await axios.get(`https://geeks-for-geeks-stats-api.vercel.app/?userName=${username}`, {
      timeout: 15000
    });
    if (res.data && !res.data.error) {
      apiData = res.data;
    }
  } catch (err) {
    console.warn('GFG API failed:', err.message);
  }

  // Fallback to Jina
  if (!apiData && process.env.JINA_API_KEY) {
    try {
      const profileUrl = `https://www.geeksforgeeks.org/user/${username}/`;
      const res = await axios.get(`https://r.jina.ai/${profileUrl}`, {
        headers: {
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
          'Accept': 'text/plain'
        },
        timeout: 30000
      });

      if (res.data && res.data.length > 50) {
        const { data: parsed } = await generateJson(`Extract GeeksforGeeks profile data. Return ONLY valid JSON:
{
  "username": "",
  "totalProblemsSolved": 0,
  "codingScore": 0,
  "languages": [],
  "topics": []
}
Only extract explicit data. Do NOT invent.

Page content:
${res.data.substring(0, 2000)}`, 'GeeksforGeeks extraction');
        return { source: 'gfg', url: gfgUrl, username, extracted: true, method: 'jina_ai', ...parsed, extractedAt: new Date().toISOString() };
      }
    } catch (err) {
      console.warn('Jina GFG extraction failed:', err.message);
    }
  }

  if (apiData) {
    return {
      source: 'gfg',
      url: gfgUrl,
      username,
      extracted: true,
      method: 'api',
      totalProblemsSolved: apiData.totalProblemsSolved || 0,
      codingScore: apiData.codingScore || 0,
      problemsByDifficulty: {
        school: apiData.School || 0,
        basic: apiData.Basic || 0,
        easy: apiData.Easy || 0,
        medium: apiData.Medium || 0,
        hard: apiData.Hard || 0
      },
      extractedAt: new Date().toISOString()
    };
  }

  return { source: 'gfg', url: gfgUrl, username, extracted: false, reason: 'Could not retrieve GFG profile data', extractedAt: new Date().toISOString() };
}

function parseGfgUsername(url) {
  if (!url) return null;
  url = url.trim().replace(/\/+$/, '');
  const match = url.match(/geeksforgeeks\.org\/user\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

module.exports = { extractGfgData };
