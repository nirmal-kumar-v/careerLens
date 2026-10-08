const axios = require('axios');

/**
 * Search for relevant courses and learning resources using Tavily API.
 * Only called when there are actual learning gaps to fill.
 */
async function searchCourseResources(gaps, targetRole) {
  if (!process.env.TAVILY_API_KEY || !gaps || gaps.length === 0) {
    return [];
  }

  const results = [];

  for (const gap of gaps.slice(0, 5)) { // Limit to top 5 gaps
    try {
      const query = `best free course learn ${gap.skill || gap} ${targetRole ? 'for ' + targetRole : ''} 2024 2025`;
      const res = await axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true
      }, { timeout: 15000 });

      if (res.data && res.data.results) {
        results.push({
          gap: gap.skill || gap,
          reason: gap.reason || `Required for ${targetRole || 'career advancement'}`,
          resources: res.data.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content ? r.content.substring(0, 200) : ''
          }))
        });
      }
    } catch (err) {
      console.warn(`Tavily search for "${gap.skill || gap}" failed:`, err.message);
    }
  }

  return results;
}

module.exports = { searchCourseResources };
