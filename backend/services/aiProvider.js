const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');
const axios = require('axios');

/**
 * Parse a JSON object from AI response text.
 * Strips markdown fences and extracts the first { ... } block.
 */
function parseJsonResponse(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI response did not contain a JSON object');
  return JSON.parse(match[0]);
}

/**
 * Generate a JSON response from the configured AI providers.
 * Fallback order: Groq → Gemini → OpenRouter
 * Each provider is only added if its API key + model are configured.
 */
async function generateJson(prompt, taskName = 'AI extraction') {
  const providers = [];

  // 1. Groq (fastest)
  if (process.env.GROQ_API_KEY?.trim() && process.env.GROQ_MODEL?.trim()) {
    providers.push({
      name: 'Groq',
      generate: async () => {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 25000 });
        const completion = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a career evaluation engine. Return a valid json object only. Do not use markdown code fences.' },
            { role: 'user', content: prompt }
          ]
        });
        return completion.choices[0]?.message?.content;
      }
    });
  }

  // 2. Gemini
  if (process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_MODEL?.trim()) {
    providers.push({
      name: 'Gemini',
      generate: async () => {
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const result = await genAI.models.generateContent({
          model: process.env.GEMINI_MODEL,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0.1 }
        });
        return result.text;
      }
    });
  }

  // 3. OpenRouter (broadest model access, reliable fallback)
  if (process.env.OPENROUTER_API_KEY?.trim() && process.env.OPENROUTER_MODEL?.trim()) {
    providers.push({
      name: 'OpenRouter',
      generate: async () => {
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: process.env.OPENROUTER_MODEL,
            temperature: 0.1,
            messages: [
              { role: 'system', content: 'Return a valid JSON object only. Do not use markdown code fences.' },
              { role: 'user', content: prompt }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://careerlens.app',
              'X-Title': 'CareerLens'
            },
            timeout: 120000
          }
        );
        return response.data?.choices?.[0]?.message?.content;
      }
    });
  }

  const missingConfiguration = getMissingProviderConfiguration();
  if (!providers.length) {
    throw new Error(`AI providers are not ready: ${missingConfiguration.join('; ') || 'configure at least one provider'}`);
  }
  return runJsonProviders(providers, taskName);
}

/**
 * Try each provider in order until one succeeds.
 * Returns { data, provider } on success, throws on total failure.
 */
async function runJsonProviders(providers, taskName = 'AI extraction') {
  if (!providers.length) throw new Error('No AI providers were configured for this request');
  const failures = [];
  for (const provider of providers) {
    console.info(`[AI] Trying ${provider.name} for ${taskName}...`);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('provider timed out after 60s')), 60000)
      );
      const rawText = await Promise.race([provider.generate(), timeoutPromise]);
      const data = parseJsonResponse(rawText);
      console.info(`[AI] ${provider.name} succeeded for ${taskName}`);
      return { data, provider: provider.name };
    } catch (error) {
      const reason = safeErrorCategory(error);
      failures.push(`${provider.name}: ${reason}`);
      console.warn(`[AI] ${provider.name} failed for ${taskName}: ${reason}`);
    }
  }

  throw new Error(`${taskName} failed after trying ${providers.map(p => p.name).join(', ')} (${failures.join('; ')})`);
}

function safeErrorCategory(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status);
  if (status === 400) return 'invalid request or unsupported response format (400)';
  if (status === 401 || status === 403) return `authentication or access denied (${status})`;
  if (status === 404) return 'model unavailable or not permitted (404)';
  if (status === 429) return 'rate limit or quota exceeded (429)';
  if (status >= 500) return `provider temporarily unavailable (${status})`;
  if (error instanceof SyntaxError) return 'provider returned invalid JSON';
  return error?.message || 'request failed';
}

function getMissingProviderConfiguration() {
  const missing = [];
  if (!process.env.GROQ_API_KEY?.trim()) missing.push('GROQ_API_KEY is missing');
  if (!process.env.GROQ_MODEL?.trim()) missing.push('GROQ_MODEL is missing');
  if (!process.env.GEMINI_API_KEY?.trim()) missing.push('GEMINI_API_KEY is missing');
  if (!process.env.GEMINI_MODEL?.trim()) missing.push('GEMINI_MODEL is missing');
  if (!process.env.OPENROUTER_API_KEY?.trim()) missing.push('OPENROUTER_API_KEY is missing');
  if (!process.env.OPENROUTER_MODEL?.trim()) missing.push('OPENROUTER_MODEL is missing');
  return missing;
}

function logAiConfiguration() {
  const groqOk = Boolean(process.env.GROQ_API_KEY?.trim());
  const geminiOk = Boolean(process.env.GEMINI_API_KEY?.trim());
  const openrouterOk = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  console.info(`[AI] Groq configured: ${groqOk ? 'yes' : 'no'} | model: ${process.env.GROQ_MODEL?.trim() || '(missing)'}`);
  console.info(`[AI] Gemini configured: ${geminiOk ? 'yes' : 'no'} | model: ${process.env.GEMINI_MODEL?.trim() || '(missing)'}`);
  console.info(`[AI] OpenRouter configured: ${openrouterOk ? 'yes' : 'no'} | model: ${process.env.OPENROUTER_MODEL?.trim() || '(missing)'}`);
  for (const missing of getMissingProviderConfiguration()) {
    console.warn(`[AI] Configuration warning: ${missing}`);
  }
}

module.exports = { generateJson, parseJsonResponse, runJsonProviders, logAiConfiguration, safeErrorCategory };
