import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGeminiError,
  normalizeGeminiContents,
  buildCompactMonvianKnowledgePrompt,
} from './geminiAssistantEngine';

test('classifyGeminiError accurately identifies API key, auth, rate limit, high demand, timeout, and empty errors', () => {
  const invalidKey = classifyGeminiError({ status: 400, message: 'API_KEY_INVALID: API key not valid.' });
  assert.equal(invalidKey.code, 'INVALID_API_KEY');
  assert.equal(invalidKey.retryable, false);

  const authErr = classifyGeminiError({ status: 403, message: 'PERMISSION_DENIED: Request had insufficient authentication scopes.' });
  assert.equal(authErr.code, 'AUTH_ERROR');
  assert.equal(authErr.retryable, false);

  const modelNotFound = classifyGeminiError({ status: 404, message: 'NOT_FOUND: model not found' });
  assert.equal(modelNotFound.code, 'MODEL_UNAVAILABLE');
  assert.equal(modelNotFound.retryable, false);

  const rateLimit = classifyGeminiError({ status: 429, message: 'RESOURCE_EXHAUSTED: quota exceeded' });
  assert.equal(rateLimit.code, 'RATE_LIMIT');
  assert.equal(rateLimit.retryable, true);

  const unavailable = classifyGeminiError({ status: 503, message: 'UNAVAILABLE: high demand' });
  assert.equal(unavailable.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(unavailable.retryable, true);

  const timeout = classifyGeminiError({ status: 504, message: 'DEADLINE_EXCEEDED' });
  assert.equal(timeout.code, 'TIMEOUT');
  assert.equal(timeout.retryable, true);

  const empty = classifyGeminiError(new Error('EMPTY_RESPONSE: no text'));
  assert.equal(empty.code, 'EMPTY_RESPONSE');
  assert.equal(empty.retryable, true);
});

test('normalizeGeminiContents ensures valid alternating user/model turns starting with user', () => {
  const contents = normalizeGeminiContents(
    [
      { role: 'assistant', content: 'Olá! Que experiência você gostaria de viver?' },
      { role: 'user', content: 'Olá' },
      { role: 'assistant', content: 'Olá! Como posso ajudar?' },
    ],
    'Testando'
  );

  assert.equal(contents.length, 3);
  assert.equal(contents[0].role, 'user');
  assert.equal(contents[0].parts[0].text, 'Olá');
  assert.equal(contents[1].role, 'model');
  assert.equal(contents[2].role, 'user');
  assert.equal(contents[2].parts[0].text, 'Testando');
});

test('buildCompactMonvianKnowledgePrompt filters test placeholders and preserves real spots', () => {
  const prompt = buildCompactMonvianKnowledgePrompt({
    spots: [
      { id: '1', name: 'Teste', category: 'other', lat: -22.7, lng: -45.5 },
      {
        id: 'amantikir',
        name: 'Parque Amantikir',
        category: 'parks',
        categoryLabel: 'Jardins & Natureza',
        priceRange: '$$',
        rating: 5.0,
        address: 'R. Simplício Ribeiro de Gouveia, 320',
        lat: -22.7661,
        lng: -45.6125,
      },
    ],
    itineraries: [],
    events: [],
  });

  assert.ok(prompt.includes('Parque Amantikir'));
  assert.ok(prompt.includes('[ID:amantikir]'));
  assert.ok(!prompt.includes('] Teste |'));
});
