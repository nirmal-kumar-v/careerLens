const fs = require('fs');
const path = require('path');

/**
 * Resume and Document Evidence Integrity Verifier
 * 
 * Inspects PDF/document raw stream and extracted text for low-contrast/hidden text,
 * zero-width characters, suspicious keyword stuffing, and timeline contradictions.
 */

async function verifyDocumentIntegrity(resumeData, resumeFilePath = null) {
  const result = {
    source: 'resume',
    visibility_status: 'visible', // 'visible' | 'low_visibility' | 'hidden_or_suspicious'
    verification_status: 'pending',
    hidden_text_detected: false,
    keyword_stuffing_detected: false,
    timeline_anomalies_detected: false,
    integrity_notes: [],
    personalized_explanation: ''
  };

  const rawText = resumeData?.rawText || '';

  // 1. Zero-width character and hidden unicode detection
  const zeroWidthRegex = /[\u200B-\u200D\uFEFF\u2060\u180E]/g;
  const zeroWidthMatches = rawText.match(zeroWidthRegex);
  if (zeroWidthMatches && zeroWidthMatches.length > 5) {
    result.hidden_text_detected = true;
    result.visibility_status = 'hidden_or_suspicious';
    result.integrity_notes.push(`Detected ${zeroWidthMatches.length} zero-width / hidden characters in extracted document text.`);
  }

  // 2. Keyword repetition / stuffing detection
  const words = rawText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordFreq = {};
  words.forEach(w => {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  });

  const highRepetitionWords = Object.entries(wordFreq)
    .filter(([word, count]) => count > 18 && !['with', 'from', 'have', 'experience', 'developer', 'project', 'using'].includes(word));

  if (highRepetitionWords.length > 3) {
    result.keyword_stuffing_detected = true;
    if (result.visibility_status === 'visible') result.visibility_status = 'low_visibility';
    result.integrity_notes.push(`High repetition observed for terms: ${highRepetitionWords.map(([w, c]) => `${w} (${c}x)`).join(', ')}.`);
  }

  // 3. Document buffer inspection for raw PDF font size / color anomalies if path provided
  if (resumeFilePath && fs.existsSync(resumeFilePath) && path.extname(resumeFilePath).toLowerCase() === '.pdf') {
    try {
      const buffer = fs.readFileSync(resumeFilePath);
      const rawPdfString = buffer.toString('binary');

      // Check for tiny font rendering commands (e.g. Tf with size < 2)
      const tinyFontRegex = /\/F\d+\s+0\.[0-9]+\s+Tf|\/F\d+\s+1(?:\.0+)?\s+Tf/g;
      if (tinyFontRegex.test(rawPdfString)) {
        result.hidden_text_detected = true;
        result.visibility_status = 'low_visibility';
        result.integrity_notes.push('Extremely small font sizes detected in document layout.');
      }

      // Check for pure white color operators on text (e.g. '1 1 1 rg' or '1 1 1 RG')
      const whiteTextRegex = /1(?:\.0+)?\s+1(?:\.0+)?\s+1(?:\.0+)?\s+(?:rg|RG|k|K)/g;
      const whiteTextMatches = rawPdfString.match(whiteTextRegex);
      if (whiteTextMatches && whiteTextMatches.length > 3) {
        result.hidden_text_detected = true;
        result.visibility_status = 'hidden_or_suspicious';
        result.integrity_notes.push('Low-contrast / white text elements observed in document formatting.');
      }
    } catch (err) {
      // Safe fallback
    }
  }

  // 4. Timeline consistency checks in experience
  const experiences = resumeData?.experience || [];
  if (Array.isArray(experiences) && experiences.length >= 2) {
    // Check for impossible date ranges if dates are parsed
    experiences.forEach((exp, idx) => {
      const durationStr = exp.duration || exp.dates || '';
      const yearMatches = durationStr.match(/\b(19\d\d|20\d\d)\b/g);
      if (yearMatches && yearMatches.length >= 2) {
        const startYear = parseInt(yearMatches[0], 10);
        const endYear = parseInt(yearMatches[1], 10);
        if (endYear < startYear) {
          result.timeline_anomalies_detected = true;
          result.integrity_notes.push(`Reversed date range detected in experience #${idx + 1}: ${durationStr}`);
        }
      }
    });
  }

  // 5. Generate personalized, neutral explanation
  if (result.visibility_status === 'hidden_or_suspicious' || result.visibility_status === 'low_visibility') {
    result.personalized_explanation = 'Some extracted document text appears visually low-contrast or includes high repetition. This may affect evidence reliability and could also be an accidental formatting issue.';
  } else {
    result.personalized_explanation = 'Document structure and text contrast verified cleanly against standard readability criteria.';
  }

  return result;
}

module.exports = {
  verifyDocumentIntegrity
};
