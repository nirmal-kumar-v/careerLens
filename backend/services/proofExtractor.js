const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const axios = require('axios');
const { extractLeetcodeData } = require('./extractors/leetcodeExtractor');

/**
 * Extracts text and structured context from an uploaded proof file.
 */
async function extractFileProof(file, claim) {
  if (!file) throw new Error('No file provided for proof extraction');

  const ext = path.extname(file.originalname || file.path || '').toLowerCase();
  let buffer;
  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path && fs.existsSync(file.path)) {
    buffer = fs.readFileSync(file.path);
  } else {
    throw new Error('File buffer or valid file path not available');
  }

  let extractedText = '';

  if (ext === '.pdf') {
    try {
      const pdfData = await pdf(buffer);
      extractedText = (pdfData.text || '').trim();
    } catch (err) {
      throw new Error(`Failed to parse PDF proof: ${err.message}`);
    }
  } else if (ext === '.docx' || ext === '.doc') {
    try {
      if (ext === '.docx') {
        const archive = await JSZip.loadAsync(buffer);
        const documentFile = archive.file('word/document.xml');
        if (documentFile) {
          const xml = await documentFile.async('string');
          const doc = new DOMParser().parseFromString(xml, 'application/xml');
          const paragraphs = doc.getElementsByTagName('w:p');
          const lines = [];
          for (let i = 0; i < paragraphs.length; i++) {
            const textNodes = paragraphs[i].getElementsByTagName('w:t');
            let pText = '';
            for (let j = 0; j < textNodes.length; j++) {
              pText += textNodes[j].textContent || '';
            }
            if (pText.trim()) lines.push(pText.trim());
          }
          extractedText = lines.join('\n');
        }
      } else {
        extractedText = buffer.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch (err) {
      throw new Error(`Failed to parse DOCX proof: ${err.message}`);
    }
  } else if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv') {
    extractedText = buffer.toString('utf8').trim();
  } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    extractedText = `[Image Evidence File: ${file.originalname || 'proof_image'}${ext} - Size: ${(buffer.length / 1024).toFixed(1)} KB]`;
  } else {
    extractedText = buffer.toString('utf8').slice(0, 5000).trim();
  }

  if (!extractedText || extractedText.length < 5) {
    extractedText = `[File: ${file.originalname || 'evidence_file'}${ext} uploaded for claim '${claim}']`;
  }

  return {
    claim,
    source: 'proof_added',
    type: 'file',
    fileName: file.originalname || path.basename(file.path || 'evidence_file'),
    fileType: ext,
    filePath: file.path || null,
    extracted_text: extractedText,
    validation_status: 'pending',
    submittedAt: new Date().toISOString()
  };
}

/**
 * Extracts readable content from a proof URL (LeetCode, GitHub, Certificate, Portfolio, etc.).
 */
async function extractUrlProof(rawUrl, claim) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Valid URL required for proof extraction');
  }

  let cleanUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    new URL(cleanUrl);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  let extractedText = '';

  // 1. LeetCode profile URL check
  if (cleanUrl.includes('leetcode.com')) {
    try {
      const leetData = await extractLeetcodeData(cleanUrl);
      if (leetData && !leetData.error) {
        extractedText = `LeetCode Profile: ${leetData.username || cleanUrl}\nTotal Solved: ${leetData.totalSolved || 0} (Easy: ${leetData.easySolved || 0}, Medium: ${leetData.mediumSolved || 0}, Hard: ${leetData.hardSolved || 0})\nRanking: ${leetData.ranking || 'N/A'}\nTop Languages: ${(leetData.languages || []).map(l => typeof l === 'string' ? l : l.languageName).join(', ')}`;
      }
    } catch (err) {
      console.warn('[ProofExtractor] LeetCode extract warning:', err.message);
    }
  }

  // 2. GitHub URL check
  if (!extractedText && cleanUrl.includes('github.com')) {
    try {
      const ghMatch = cleanUrl.match(/github\.com\/([^\/]+)(?:\/([^\/]+))?/);
      if (ghMatch) {
        const [, owner, repo] = ghMatch;
        if (repo) {
          const apiRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { 'User-Agent': 'CareerLens-Evidence-Verifier' },
            timeout: 10000
          }).catch(() => null);
          if (apiRes?.data) {
            extractedText = `GitHub Repository: ${apiRes.data.full_name}\nDescription: ${apiRes.data.description || 'None'}\nPrimary Language: ${apiRes.data.language || 'N/A'}\nStars: ${apiRes.data.stargazers_count}\nUpdated: ${apiRes.data.pushed_at}`;
          }
        }
      }
    } catch (err) {
      console.warn('[ProofExtractor] GitHub extract warning:', err.message);
    }
  }

  // 3. Jina AI Reader / Direct Web Scraper
  if (!extractedText) {
    if (process.env.JINA_API_KEY) {
      try {
        const jinaRes = await axios.get(`https://r.jina.ai/${cleanUrl}`, {
          headers: {
            'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
            'Accept': 'text/plain'
          },
          timeout: 20000
        });
        if (jinaRes.data && String(jinaRes.data).trim().length > 30) {
          extractedText = String(jinaRes.data).trim().slice(0, 8000);
        }
      } catch (err) {
        console.warn('[ProofExtractor] Jina reader warning:', err.message);
      }
    }
  }

  // 4. Direct HTML fallback
  if (!extractedText) {
    try {
      const res = await axios.get(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 12000
      });
      if (res.data && typeof res.data === 'string') {
        const text = res.data
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 20) {
          extractedText = text.slice(0, 4000);
        }
      }
    } catch (err) {
      console.warn('[ProofExtractor] Direct fetch warning:', err.message);
    }
  }

  if (!extractedText) {
    extractedText = `[External Evidence URL provided for claim '${claim}': ${cleanUrl}]`;
  }

  return {
    claim,
    source: 'proof_added',
    type: 'url',
    source_url: cleanUrl,
    extracted_text: extractedText,
    validation_status: 'pending',
    submittedAt: new Date().toISOString()
  };
}

module.exports = {
  extractFileProof,
  extractUrlProof
};
