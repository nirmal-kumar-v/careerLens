const axios = require('axios');

/**
 * Extract structured data from GitHub profile using GitHub API.
 * Uses GITHUB_TOKEN for authenticated requests.
 */
async function extractGithubData(githubUrl) {
  // Parse username from URL
  const username = parseGithubUsername(githubUrl);
  if (!username) {
    throw new Error('Invalid GitHub URL. Expected format: https://github.com/username');
  }

  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const baseUrl = 'https://api.github.com';

  // Fetch user profile
  let userProfile;
  try {
    const res = await axios.get(`${baseUrl}/users/${username}`, { headers });
    userProfile = res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(`GitHub user '${username}' not found`);
    }
    throw new Error('Failed to fetch GitHub profile: ' + err.message);
  }

  // Fetch repository pages (up to 1,000, sorted by updated).
  let repos = [];
  for (let page = 1; page <= 10; page += 1) {
    try {
      const res = await axios.get(`${baseUrl}/users/${username}/repos`, {
        headers,
        params: { per_page: 100, page, sort: 'updated', direction: 'desc' }
      });
      repos.push(...res.data);
      if (res.data.length < 100) break;
    } catch (err) {
      throw new Error(`Failed to fetch GitHub repositories: ${err.response?.status || err.message}`);
    }
  }

  // Keep supplemental API calls bounded while retaining repository metadata for all pages.
  const processRepo = async (repo, index) => {
    const repoData = {
      name: repo.name,
      description: repo.description || '',
      url: repo.html_url,
      language: repo.language,
      languages: repo.language ? { [repo.language]: 0 } : {},
      isFork: repo.fork,
      isOwner: repo.owner.login.toLowerCase() === username.toLowerCase(),
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      size: repo.size,
      topics: repo.topics || [],
      defaultBranch: repo.default_branch,
      hasReadme: false,
      readmeSnippet: ''
    };

    if (index < 30) {
      try {
        const langRes = await axios.get(`${baseUrl}/repos/${username}/${repo.name}/languages`, { headers });
        repoData.languages = langRes.data;
      } catch (err) {
        console.warn(`GitHub language lookup failed for ${repo.name}:`, err.response?.status || err.message);
      }
    }

    if (index < 10) {
      try {
        const readmeRes = await axios.get(`${baseUrl}/repos/${username}/${repo.name}/readme`, { headers });
        if (readmeRes.data.content) {
          const readmeText = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8');
          repoData.hasReadme = true;
          repoData.readmeSnippet = readmeText.substring(0, 500);
        }
      } catch (err) {
        // A README is optional evidence.
      }
    }

    return repoData;
  };
  const reposToProcess = repos.slice(0, 1000);
  const processedRepos = [];
  for (let index = 0; index < reposToProcess.length; index += 5) {
    const batch = reposToProcess.slice(index, index + 5);
    const processedBatch = await Promise.all(batch.map((repo, offset) => processRepo(repo, index + offset)));
    processedRepos.push(...processedBatch);
  }

  // Aggregate language data
  const languageTotals = {};
  for (const repo of processedRepos) {
    for (const [lang, bytes] of Object.entries(repo.languages)) {
      languageTotals[lang] = (languageTotals[lang] || 0) + bytes;
    }
  }

  // Count original vs forked
  const originalRepos = processedRepos.filter(r => !r.isFork);
  const forkedRepos = processedRepos.filter(r => r.isFork);

  // Fetch recent activity (events)
  let recentActivity = [];
  try {
    const eventsRes = await axios.get(`${baseUrl}/users/${username}/events/public`, {
      headers,
      params: { per_page: 30 }
    });
    recentActivity = eventsRes.data.map(e => ({
      type: e.type,
      repo: e.repo.name,
      createdAt: e.created_at
    }));
  } catch (err) {
    // skip
  }

  return {
    source: 'github',
    username,
    profileUrl: userProfile.html_url,
    name: userProfile.name,
    bio: userProfile.bio,
    company: userProfile.company,
    location: userProfile.location,
    publicRepos: userProfile.public_repos,
    followers: userProfile.followers,
    following: userProfile.following,
    createdAt: userProfile.created_at,
    repositories: processedRepos,
    repositoriesAnalyzed: processedRepos.length,
    repositoriesAvailable: repos.length,
    publicRepoCount: userProfile.public_repos,
    originalRepoCount: originalRepos.length,
    forkedRepoCount: forkedRepos.length,
    languageTotals,
    topLanguages: Object.entries(languageTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([lang, bytes]) => ({ language: lang, bytes })),
    recentActivity,
    extractedAt: new Date().toISOString()
  };
}

function parseGithubUsername(url) {
  if (!url) return null;
  // Handle various formats
  url = url.trim().replace(/\/+$/, '');
  const patterns = [
    /github\.com\/([a-zA-Z0-9_-]+)\/?$/,
    /^([a-zA-Z0-9_-]+)$/  // Just username
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = { extractGithubData };
