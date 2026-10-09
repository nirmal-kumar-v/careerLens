const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEvidence } = require('../services/evidenceNormalizer');
const { buildClaimValidation, generateDeterministicEvaluation } = require('../services/aiEvaluator');
const { runJsonProviders, safeErrorCategory } = require('../services/aiProvider');
const JSZip = require('jszip');
const { extractResumeText } = require('../services/extractors/resumeExtractor');

function makeExtractedData(github, extra = {}) {
  return {
    resume: { skills: ['Java'], languages: ['Java'], technologies: [], projects: [] },
    github,
    ...extra
  };
}

test('JavaScript repositories do not verify a Java resume claim', () => {
  const extracted = makeExtractedData({
    repositories: [{ name: 'web-app', languages: { JavaScript: 18000 } }],
    languageTotals: { JavaScript: 18000 },
    originalRepoCount: 1,
    forkedRepoCount: 0
  });
  const evidence = normalizeEvidence(extracted);
  const [claim] = buildClaimValidation(evidence);
  const evaluation = generateDeterministicEvaluation(evidence, 'Java Developer', extracted);

  assert.equal(claim.status, 'requires_proof');
  assert.match(claim.evidenceDetails.at(-1).detail, /Not detected in 1 analyzed GitHub repositories/);
  assert.equal(evaluation.proofRequests[0].skill, 'Java');
  assert.equal(evaluation.recommendations.projects[0].technologies[0], 'Java');
  assert.equal(evidence.crossSourceConsistency.consistencyScore, 0);
});

test('LeetCode evidence does not replace a missing GitHub project', () => {
  const extracted = makeExtractedData({
    repositories: [{ name: 'javascript-only', languages: { JavaScript: 18000 } }],
    languageTotals: { JavaScript: 18000 },
    originalRepoCount: 1,
    forkedRepoCount: 0
  }, { leetcode: { extracted: true, languages: ['Java'] } });
  const evidence = normalizeEvidence(extracted);
  const [claim] = buildClaimValidation(evidence);

  assert.equal(claim.status, 'requires_proof');
  assert.deepEqual(claim.evidenceIn, ['leetcode']);
});

test('a substantial Java repository supports a Java resume claim', () => {
  const extracted = makeExtractedData({
    repositories: [{ name: 'spring-service', languages: { Java: 60000 } }],
    languageTotals: { Java: 60000 },
    originalRepoCount: 1,
    forkedRepoCount: 0
  });
  const evidence = normalizeEvidence(extracted);
  const [claim] = buildClaimValidation(evidence);

  assert.equal(claim.status, 'verified');
  assert.match(claim.evidenceDetails[0].detail, /spring-service/);
  assert.equal(evidence.crossSourceConsistency.consistencyScore, 100);
});

test('failed GitHub extraction is not treated as evidence against a claim', () => {
  const evidence = normalizeEvidence(makeExtractedData({ error: 'GitHub API unavailable' }));
  const [claim] = buildClaimValidation(evidence);

  assert.equal(claim.status, 'not_verifiable');
});

test('AI extraction falls through to the next provider after a provider failure', async () => {
  const tried = [];
  const result = await runJsonProviders([
    { name: 'Groq', generate: async () => { tried.push('Groq'); throw Object.assign(new Error('model error details must not be logged'), { status: 404 }); } },
    { name: 'Gemini', generate: async () => { tried.push('Gemini'); return '{"skills":["Java"]}'; } }
  ], 'Test extraction');

  assert.deepEqual(tried, ['Groq', 'Gemini']);
  assert.deepEqual(result.data, { skills: ['Java'] });
  assert.equal(result.provider, 'Gemini');
  assert.equal(safeErrorCategory(Object.assign(new Error('private detail'), { status: 404 })), 'model unavailable or not permitted (404)');
});

test('DOCX resume text extraction reads paragraphs from the document body', async () => {
  const archive = new JSZip();
  archive.file('word/document.xml', '<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>Java developer</w:t></w:r></w:p><w:p><w:r><w:t>Spring Boot project</w:t></w:r></w:p></w:body></w:document>');
  const buffer = await archive.generateAsync({ type: 'nodebuffer' });

  assert.equal(await extractResumeText(buffer, '.docx'), 'Java developer\nSpring Boot project');
});

test('GeeksforGeeks problem solving verifies DSA resume claim without requiring GitHub DSA repo', () => {
  const extracted = {
    resume: { skills: ['DSA'], languages: [], technologies: [], projects: [] },
    github: { repositories: [], languageTotals: {}, originalRepoCount: 0, forkedRepoCount: 0 },
    gfg: { extracted: true, totalProblemsSolved: 45, codingScore: 120 }
  };
  const evidence = normalizeEvidence(extracted);
  const [claim] = buildClaimValidation(evidence, extracted);

  assert.equal(claim.status, 'verified');
  assert.match(claim.explanation, /GeeksforGeeks profile provides strong direct evidence with 45 solved problems/);
  assert.ok(evidence.codingEvidence.gfg);
  assert.equal(evidence.codingEvidence.gfg.totalProblemsSolved, 45);
});

test('LinkedIn professional experience and certifications support role-specific skill claims', () => {
  const extracted = {
    resume: { skills: ['AWS', 'Java'], languages: ['Java'], technologies: ['AWS'], projects: [] },
    github: { repositories: [], languageTotals: {}, originalRepoCount: 0, forkedRepoCount: 0 },
    linkedin: {
      extracted: true,
      experience: [{ role: 'Cloud Engineer', company: 'TechCorp', description: 'Architected AWS services' }],
      certifications: [{ name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services' }]
    }
  };
  const evidence = normalizeEvidence(extracted);
  const claims = buildClaimValidation(evidence, extracted);
  const awsClaim = claims.find(c => c.skill === 'AWS');

  assert.equal(awsClaim.status, 'verified');
  assert.ok(awsClaim.evidenceIn.includes('linkedin'));
  assert.match(awsClaim.explanation, /AWS/);
});