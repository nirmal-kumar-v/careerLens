const axios = require('axios');
const { generateJson } = require('../aiProvider');

/**
 * Enhanced LeetCode Extractor.
 * Extracts comprehensive problem-solving statistics, difficulty breakdown,
 * language-specific stats, topic/tag breakdown, contest ranking, badges,
 * and recent submissions.
 */
async function extractLeetcodeData(leetcodeUrl) {
  if (!leetcodeUrl) return null;

  const username = parseLeetcodeUsername(leetcodeUrl);
  if (!username) {
    return {
      source: 'leetcode',
      url: leetcodeUrl,
      extracted: false,
      reason: 'Could not parse LeetCode username from URL'
    };
  }

  // 1. Try LeetCode Public GraphQL API
  let graphqlData = null;
  try {
    const query = `
      query getLeetCodeComprehensive($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            aboutMe
            ranking
            reputation
            countryName
            school
            company
          }
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
            totalSubmissionNum {
              difficulty
              count
              submissions
            }
          }
          languageProblemCount {
            languageName
            problemsSolved
          }
          tagProblemCounts {
            fundamental {
              tagName
              tagSlug
              problemsSolved
            }
            intermediate {
              tagName
              tagSlug
              problemsSolved
            }
            advanced {
              tagName
              tagSlug
              problemsSolved
            }
          }
          badges {
            displayName
            icon
            creationDate
          }
        }
        userContestRanking(username: $username) {
          attendedContestsCount
          rating
          globalRanking
          totalParticipants
          topPercentage
          badge { name }
        }
        recentAcSubmissionList(username: $username, limit: 20) {
          id
          title
          titleSlug
          timestamp
        }
        recentSubmissionList(username: $username, limit: 20) {
          title
          titleSlug
          statusDisplay
          lang
          timestamp
        }
      }
    `;

    const res = await axios.post('https://leetcode.com/graphql', {
      query,
      variables: { username }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    if (res.data?.data?.matchedUser) {
      graphqlData = res.data.data;
    }
  } catch (err) {
    console.warn('LeetCode GraphQL API attempt failed:', err.message);
  }

  // 2. Fallback / supplementary extraction using Jina Reader + AI if GraphQL failed
  if (!graphqlData && (process.env.JINA_API_KEY || process.env.FIRECRAWL_API_KEY)) {
    try {
      const pageContent = await fetchWebPageMarkdown(`https://leetcode.com/u/${username}/`);
      if (pageContent && pageContent.length > 50) {
        const prompt = `Extract LeetCode profile statistics. Return ONLY a valid JSON object matching this schema:
{
  "username": "${username}",
  "realName": "",
  "totalSolved": 0,
  "easySolved": 0,
  "mediumSolved": 0,
  "hardSolved": 0,
  "ranking": 0,
  "acceptanceRate": 0,
  "languages": [{"language": "Java", "count": 10}],
  "topics": [{"name": "Array", "count": 15, "category": "fundamental"}],
  "recentSubmissions": [{"title": "Two Sum", "language": "Java"}]
}
Only extract facts directly present in the text. Do NOT invent numbers.

LeetCode Page Content:
${pageContent.substring(0, 4000)}`;

        const { data: parsed } = await generateJson(prompt, 'LeetCode web fallback');
        return {
          source: 'leetcode',
          url: leetcodeUrl,
          username,
          extracted: true,
          method: 'web_ai_fallback',
          ...parsed,
          extractedAt: new Date().toISOString()
        };
      }
    } catch (fallbackErr) {
      console.warn('LeetCode web fallback failed:', fallbackErr.message);
    }
  }

  if (!graphqlData) {
    return {
      source: 'leetcode',
      url: leetcodeUrl,
      username,
      extracted: false,
      reason: 'Could not retrieve LeetCode profile data from public API or web scrapers',
      extractedAt: new Date().toISOString()
    };
  }

  // 3. Process and structure GraphQL data into complete breakdown
  const user = graphqlData.matchedUser;
  const contest = graphqlData.userContestRanking || null;
  const submissions = user.submitStatsGlobal?.acSubmissionNum || [];
  const totalSubmissions = user.submitStatsGlobal?.totalSubmissionNum || [];

  const totalSolved = submissions.find(s => s.difficulty === 'All')?.count || 0;
  const easySolved = submissions.find(s => s.difficulty === 'Easy')?.count || 0;
  const mediumSolved = submissions.find(s => s.difficulty === 'Medium')?.count || 0;
  const hardSolved = submissions.find(s => s.difficulty === 'Hard')?.count || 0;

  const totalAttempts = totalSubmissions.find(s => s.difficulty === 'All')?.submissions || 0;
  const totalAcceptedSubmissions = submissions.find(s => s.difficulty === 'All')?.submissions || 0;
  const acceptanceRate = totalAttempts > 0
    ? Number(((totalAcceptedSubmissions / totalAttempts) * 100).toFixed(1))
    : 0;

  // Language Breakdown
  const languages = (user.languageProblemCount || [])
    .filter(l => l.problemsSolved > 0)
    .map(l => ({
      language: l.languageName,
      count: l.problemsSolved
    }))
    .sort((a, b) => b.count - a.count);

  // Topics / Tags Categorization (Fundamental, Intermediate, Advanced)
  const allTopics = [];
  const categories = ['fundamental', 'intermediate', 'advanced'];

  categories.forEach(category => {
    const tagList = user.tagProblemCounts?.[category] || [];
    tagList.forEach(t => {
      if (t.problemsSolved > 0) {
        allTopics.push({
          name: t.tagName,
          slug: t.tagSlug,
          count: t.problemsSolved,
          category
        });
      }
    });
  });

  allTopics.sort((a, b) => b.count - a.count);

  // Badges
  const badges = (user.badges || []).map(b => ({
    name: b.displayName,
    icon: b.icon?.startsWith('http') ? b.icon : (b.icon ? `https://leetcode.com${b.icon}` : null),
    creationDate: b.creationDate
  }));

  // Recent Submissions
  const recentSubmissions = [];
  const seenTitles = new Set();

  if (Array.isArray(graphqlData.recentSubmissionList)) {
    graphqlData.recentSubmissionList.forEach(sub => {
      if (sub.title && !seenTitles.has(sub.title)) {
        seenTitles.add(sub.title);
        recentSubmissions.push({
          title: sub.title,
          titleSlug: sub.titleSlug,
          status: sub.statusDisplay || 'Accepted',
          language: sub.lang,
          timestamp: sub.timestamp ? new Date(Number(sub.timestamp) * 1000).toISOString() : null
        });
      }
    });
  }

  if (Array.isArray(graphqlData.recentAcSubmissionList)) {
    graphqlData.recentAcSubmissionList.forEach(sub => {
      if (sub.title && !seenTitles.has(sub.title)) {
        seenTitles.add(sub.title);
        recentSubmissions.push({
          id: sub.id,
          title: sub.title,
          titleSlug: sub.titleSlug,
          status: 'Accepted',
          language: null,
          timestamp: sub.timestamp ? new Date(Number(sub.timestamp) * 1000).toISOString() : null
        });
      }
    });
  }

  return {
    source: 'leetcode',
    url: leetcodeUrl,
    username,
    extracted: true,
    method: 'graphql_full',
    profile: {
      realName: user.profile?.realName || null,
      aboutMe: user.profile?.aboutMe || null,
      ranking: user.profile?.ranking || null,
      reputation: user.profile?.reputation || 0,
      country: user.profile?.countryName || null,
      school: user.profile?.school || null,
      company: user.profile?.company || null
    },
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    ranking: user.profile?.ranking || null,
    acceptanceRate,
    submissionStats: {
      totalSubmissions: totalAttempts,
      acceptedSubmissions: totalAcceptedSubmissions,
      easy: {
        solved: easySolved,
        submissions: totalSubmissions.find(s => s.difficulty === 'Easy')?.submissions || 0
      },
      medium: {
        solved: mediumSolved,
        submissions: totalSubmissions.find(s => s.difficulty === 'Medium')?.submissions || 0
      },
      hard: {
        solved: hardSolved,
        submissions: totalSubmissions.find(s => s.difficulty === 'Hard')?.submissions || 0
      }
    },
    languages,
    topics: allTopics,
    contestRating: contest ? {
      rating: Math.round(contest.rating || 0),
      attendedContests: contest.attendedContestsCount || 0,
      globalRanking: contest.globalRanking || null,
      totalParticipants: contest.totalParticipants || null,
      topPercentage: contest.topPercentage ? `${contest.topPercentage.toFixed(2)}%` : null,
      badge: contest.badge?.name || null
    } : null,
    badges,
    recentSubmissions: recentSubmissions.slice(0, 15),
    extractedAt: new Date().toISOString()
  };
}

async function fetchWebPageMarkdown(url) {
  if (process.env.JINA_API_KEY) {
    try {
      const res = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
          'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
          'Accept': 'text/plain'
        },
        timeout: 25000
      });
      if (res.data) return res.data;
    } catch (_) {}
  }

  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const res = await axios.post('https://api.firecrawl.dev/v1/scrape', {
        url,
        formats: ['markdown']
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      if (res.data?.data?.markdown) return res.data.data.markdown;
    } catch (_) {}
  }

  return null;
}

function parseLeetcodeUsername(url) {
  if (!url) return null;
  url = url.trim().replace(/\/+$/, '');
  const patterns = [
    /leetcode\.com\/u\/([a-zA-Z0-9_-]+)/,
    /leetcode\.com\/([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1] && !['problemset', 'problems', 'contest', 'explore'].includes(m[1].toLowerCase())) {
      return m[1];
    }
  }
  return null;
}

module.exports = { extractLeetcodeData };
