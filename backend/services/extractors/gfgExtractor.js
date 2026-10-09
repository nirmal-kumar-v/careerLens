const axios = require('axios');
const { generateJson } = require('../aiProvider');

/**
 * Extract data from GeeksforGeeks profile using direct web fetch, Next.js flight parsing, Jina, and API fallbacks.
 */
async function extractGfgData(gfgUrl) {
  if (!gfgUrl) return null;

  const username = parseGfgUsername(gfgUrl);
  if (!username) {
    return { source: 'gfg', url: gfgUrl, extracted: false, reason: 'Could not parse GFG username from URL', extractedAt: new Date().toISOString() };
  }

  let profileData = null;

  // 1. Direct Web Fetch & Next.js Flight Data Parsing
  try {
    const profileUrl = `https://www.geeksforgeeks.org/user/${username}/`;
    const res = await axios.get(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    if (res.data && typeof res.data === 'string' && res.data.length > 500) {
      const html = res.data;

      // Extract Flight Chunks
      const chunks = [];
      const flightRegex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
      let match;
      while ((match = flightRegex.exec(html)) !== null) {
        try {
          chunks.push(JSON.parse(`"${match[1]}"`));
        } catch (_) {
          chunks.push(match[1]);
        }
      }
      const fullText = chunks.join('\n') + '\n' + html;

      // Parse name and headline
      let name = null;
      let headline = null;
      const nameMatch = fullText.match(/"name":\s*"([^"]+)"/i);
      if (nameMatch && !['viewport', 'GeeksforGeeks'].includes(nameMatch[1])) {
        name = nameMatch[1];
      }
      const headlineMatch = fullText.match(/"headline":\s*"([^"]+)"/i);
      if (headlineMatch) headline = headlineMatch[1];

      // Problem stats
      let totalProblemsSolved = null;
      const probMatch = fullText.match(/total_problems_solved["':\s]+(\d+)/i) ||
                        fullText.match(/"totalProblemsSolved":\s*(\d+)/i) ||
                        fullText.match(/Problems\s+Solved\s*[:\\"]*\s*(\d+)/i) ||
                        html.match(/Problems\s+Solved\s*[:<>\w\s/="'-]*?(\d+)/i);
      if (probMatch) {
        totalProblemsSolved = parseInt(probMatch[1], 10);
      }

      let codingScore = null;
      const scoreMatch = fullText.match(/"coding_score":\s*(\d+)/i) ||
                         fullText.match(/"codingScore":\s*(\d+)/i) ||
                         fullText.match(/Coding\s+Score\s*[:\\"]*\s*(\d+)/i) ||
                         html.match(/Coding\s+Score\s*[:<>\w\s/="'-]*?(\d+)/i);
      if (scoreMatch) {
        codingScore = parseInt(scoreMatch[1], 10);
      }

      let monthlyScore = null;
      const monthlyMatch = fullText.match(/"monthly_score":\s*(\d+)/i) || fullText.match(/Monthly\s+Score\s*[:\\"]*\s*(\d+)/i);
      if (monthlyMatch) monthlyScore = parseInt(monthlyMatch[1], 10);

      // Extract languages
      const languages = [];
      const langRegex = /"language":\s*"([^"]+)"/gi;
      let lMatch;
      while ((lMatch = langRegex.exec(fullText)) !== null) {
        if (!languages.includes(lMatch[1])) languages.push(lMatch[1]);
      }

      profileData = {
        source: 'gfg',
        url: gfgUrl,
        username,
        name: name || username,
        headline: headline || null,
        extracted: true,
        method: 'direct_web',
        totalProblemsSolved: totalProblemsSolved !== null ? totalProblemsSolved : 0,
        codingScore: codingScore !== null ? codingScore : 0,
        monthlyScore: monthlyScore !== null ? monthlyScore : 0,
        languages,
        problemsByDifficulty: {
          school: 0,
          basic: 0,
          easy: 0,
          medium: 0,
          hard: 0
        },
        extractedAt: new Date().toISOString()
      };
    }
  } catch (err) {
    console.warn('[GFG] Direct fetch warning:', err.message);
  }

  // 2. Jina Reader fallback
  if (!profileData && process.env.JINA_API_KEY) {
    try {
      const profileUrl = `https://www.geeksforgeeks.org/user/${username}/`;
      const res = await axios.get(`https://r.jina.ai/${profileUrl}`, {
        headers: {
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
          'Accept': 'text/plain'
        },
        timeout: 25000
      });

      if (res.data && res.data.length > 50) {
        const { data: parsed } = await generateJson(`Extract GeeksforGeeks profile data. Return ONLY valid JSON:
{
  "name": "",
  "headline": "",
  "totalProblemsSolved": 0,
  "codingScore": 0,
  "monthlyScore": 0,
  "languages": [],
  "topics": []
}
Only extract explicit data. Do NOT invent.

Page content:
${res.data.substring(0, 6000)}`, 'GeeksforGeeks extraction');

        if (parsed && typeof parsed === 'object') {
          profileData = {
            source: 'gfg',
            url: gfgUrl,
            username,
            extracted: true,
            method: 'jina_ai',
            name: parsed.name || username,
            headline: parsed.headline || null,
            totalProblemsSolved: parsed.totalProblemsSolved || 0,
            codingScore: parsed.codingScore || 0,
            monthlyScore: parsed.monthlyScore || 0,
            languages: Array.isArray(parsed.languages) ? parsed.languages : [],
            extractedAt: new Date().toISOString()
          };
        }
      }
    } catch (err) {
      console.warn('[GFG] Jina GFG extraction warning:', err.message);
    }
  }

  // 3. Fallback to stats API if still missing
  if (!profileData) {
    try {
      const res = await axios.get(`https://geeks-for-geeks-stats-api.vercel.app/?userName=${username}`, {
        timeout: 10000
      });
      if (res.data && !res.data.error) {
        const apiData = res.data;
        profileData = {
          source: 'gfg',
          url: gfgUrl,
          username,
          name: username,
          headline: null,
          extracted: true,
          method: 'api',
          totalProblemsSolved: apiData.totalProblemsSolved || 0,
          codingScore: apiData.codingScore || 0,
          monthlyScore: apiData.monthlyScore || 0,
          languages: [],
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
    } catch (err) {
      // ignore
    }
  }

  if (profileData) {
    return profileData;
  }

  return {
    source: 'gfg',
    url: gfgUrl,
    username,
    extracted: false,
    reason: 'Could not retrieve public GeeksforGeeks profile data. Profile may be private or username incorrect.',
    extractedAt: new Date().toISOString()
  };
}

function parseGfgUsername(url) {
  if (!url) return null;
  url = url.trim().replace(/\/+$/, '');
  const match = url.match(/geeksforgeeks\.org\/user\/([a-zA-Z0-9_-]+)/i) ||
                url.match(/auth\.geeksforgeeks\.org\/user\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

module.exports = { extractGfgData };

