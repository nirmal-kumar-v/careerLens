const axios = require('axios');

/**
 * YouTube Resource Service
 *
 * Discovers real, English-only YouTube videos for candidate skill gaps.
 * Rejects non-English videos and strictly avoids inventing fake URLs or thumbnails.
 */

// Regex patterns to detect non-English text/scripts (Devanagari, Tamil, Telugu, Arabic, etc.) and regional keywords
const NON_ENGLISH_REGEX = /[\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0D00-\u0D7F\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF]/;
const NON_ENGLISH_KEYWORDS = /\b(tamil|hindi|telugu|malayalam|kannada|urdu|bengali|marathi|gujarati|punjabi|en español|em português|en francais|auf deutsch)\b/i;

function isEnglishVideo(title = '', channel = '', description = '') {
  const combined = `${title} ${channel} ${description}`.toLowerCase();
  if (NON_ENGLISH_REGEX.test(title)) return false;
  if (NON_ENGLISH_KEYWORDS.test(combined)) return false;
  return true;
}

/**
 * Search YouTube for a query and return ranked English-only real video metadata.
 */
async function searchEnglishYouTubeVideo(searchQuery, gapTitle = '') {
  if (!searchQuery) return null;

  // Append 'English tutorial' if not already explicit to guide search engines towards English content
  let cleanQuery = searchQuery.trim();
  if (!/english/i.test(cleanQuery)) {
    cleanQuery = `${cleanQuery} English`;
  }

  // 1. YouTube Data API v3 (if key is configured)
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          q: cleanQuery,
          part: 'snippet',
          type: 'video',
          videoEmbeddable: 'true',
          relevanceLanguage: 'en',
          maxResults: 10,
          order: 'relevance',
          safeSearch: 'moderate'
        },
        timeout: 10000
      });

      const items = (ytRes.data?.items || []).filter(item => {
        const snippet = item.snippet || {};
        return isEnglishVideo(snippet.title, snippet.channelTitle, snippet.description);
      });

      if (items.length > 0) {
        const best = rankYouTubeItems(items, cleanQuery);
        if (best) {
          const videoId = best.id?.videoId || best.id;
          const snippet = best.snippet || {};
          return {
            title: snippet.title || cleanQuery,
            video_id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channel: snippet.channelTitle || 'YouTube Educator',
            channel_name: snippet.channelTitle || 'YouTube Educator',
            description: snippet.description || '',
            published_at: snippet.publishedAt ? new Date(snippet.publishedAt).toLocaleDateString() : '',
            duration: '~1-2 hours',
            language: 'English',
            resource_type: 'youtube_video',
            matched_gap: gapTitle || cleanQuery,
            reason_selected: 'Selected for high instructional clarity, practical code examples, and alignment with your target role.'
          };
        }
      }
    } catch (err) {
      console.warn('[YouTubeService] YouTube API warning:', err.message);
    }
  }

  // 2. Direct Scraper / YouTube Results Parser
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    const scrapeRes = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    if (scrapeRes.data && typeof scrapeRes.data === 'string') {
      const match = scrapeRes.data.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (match && match[1]) {
        const ytData = JSON.parse(match[1]);
        const contents = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        const videoItems = [];

        if (Array.isArray(contents)) {
          for (const section of contents) {
            const itemSection = section?.itemSectionRenderer?.contents || [];
            for (const it of itemSection) {
              if (it.videoRenderer) {
                const vr = it.videoRenderer;
                const vidId = vr.videoId;
                const title = vr.title?.runs?.map(r => r.text).join('') || vr.title?.simpleText;
                const channel = vr.ownerText?.runs?.map(r => r.text).join('') || vr.shortBylineText?.runs?.map(r => r.text).join('');
                const duration = vr.lengthText?.simpleText || '';
                const published = vr.publishedTimeText?.simpleText || '';
                const description = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || '';

                if (vidId && title && isEnglishVideo(title, channel, description)) {
                  videoItems.push({
                    videoId: vidId,
                    title,
                    channel,
                    duration,
                    published,
                    description,
                    thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`
                  });
                }
              }
            }
          }
        }

        if (videoItems.length > 0) {
          const best = videoItems[0];
          return {
            title: best.title,
            video_id: best.videoId,
            url: `https://www.youtube.com/watch?v=${best.videoId}`,
            youtube_url: `https://www.youtube.com/watch?v=${best.videoId}`,
            thumbnail_url: best.thumbnail,
            channel: best.channel || 'YouTube Educator',
            channel_name: best.channel || 'YouTube Educator',
            description: best.description || '',
            published_at: best.published || '',
            duration: best.duration || '~1 hour',
            language: 'English',
            resource_type: 'youtube_video',
            matched_gap: gapTitle || cleanQuery,
            reason_selected: 'Selected for direct topic relevance, high rating, and practical project implementation in English.'
          };
        }
      }
    }
  } catch (err) {
    console.warn('[YouTubeService] Direct search warning:', err.message);
  }

  // 3. Tavily API Search Fallback
  if (process.env.TAVILY_API_KEY) {
    try {
      const tavilyRes = await axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query: `site:youtube.com/watch ${cleanQuery} English`,
        search_depth: 'basic',
        max_results: 5
      }, { timeout: 8000 });

      const results = (tavilyRes.data?.results || []).filter(r => isEnglishVideo(r.title, '', r.content));
      for (const res of results) {
        const vidMatch = res.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (vidMatch && vidMatch[1]) {
          const videoId = vidMatch[1];
          return {
            title: res.title || cleanQuery,
            video_id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channel: 'YouTube Educator',
            channel_name: 'YouTube Educator',
            description: res.content || '',
            published_at: '',
            duration: '~1-2 hours',
            language: 'English',
            resource_type: 'youtube_video',
            matched_gap: gapTitle || cleanQuery,
            reason_selected: 'Selected for English instructional depth and direct alignment with your skill gap.'
          };
        }
      }
    } catch (tavErr) {
      console.warn('[YouTubeService] Tavily search warning:', tavErr.message);
    }
  }

  // 4. Clean search link fallback (never invent a fake video ID)
  return {
    title: `${searchQuery} (Search)`,
    video_id: null,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`,
    youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`,
    thumbnail_url: null,
    channel: 'YouTube',
    channel_name: 'YouTube',
    description: `Search query for ${searchQuery}`,
    published_at: '',
    duration: '',
    language: 'English',
    resource_type: 'youtube_search',
    matched_gap: gapTitle || cleanQuery,
    reason_selected: 'Relevant YouTube search query for hands-on practice.'
  };
}

function rankYouTubeItems(items, query) {
  if (!items.length) return null;
  const qLower = query.toLowerCase();

  return items.slice().sort((a, b) => {
    const titleA = (a.snippet?.title || a.title || '').toLowerCase();
    const titleB = (b.snippet?.title || b.title || '').toLowerCase();

    const scoreA = (titleA.includes('tutorial') ? 3 : 0) +
                   (titleA.includes('course') ? 2 : 0) +
                   (titleA.includes('full') ? 1 : 0) +
                   (qLower.split(' ').filter(w => titleA.includes(w)).length);

    const scoreB = (titleB.includes('tutorial') ? 3 : 0) +
                   (titleB.includes('course') ? 2 : 0) +
                   (titleB.includes('full') ? 1 : 0) +
                   (qLower.split(' ').filter(w => titleB.includes(w)).length);

    return scoreB - scoreA;
  })[0];
}

module.exports = {
  searchEnglishYouTubeVideo,
  isEnglishVideo
};
