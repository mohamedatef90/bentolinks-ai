import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENRICH_PROMPT_VERSION,
  buildPrompt,
  normalize,
  resolveContentTypeLabel,
  routeNvidiaModel,
} from '../supabase/functions/_shared/llm.ts';

const config = {
  provider: 'nvidia',
  geminiKey: null,
  anthropicKey: null,
  openaiKey: null,
  nvidiaKey: 'test',
  model: null,
  fastModel: null,
};

const input = (content, extractionQuality = 'partial') => ({
  title: 'A useful page',
  url: 'https://example.com/page',
  sourceType: 'article',
  content,
  extractionQuality,
});

test('normal articles use the latency-safe NVIDIA tier', () => {
  assert.equal(routeNvidiaModel(config, input('a'.repeat(11_999))), 'openai/gpt-oss-20b');
  assert.equal(routeNvidiaModel(config, input('a'.repeat(12_000))), 'z-ai/glm-5.2');
});

test('thin-content prompt prohibits unsupported inference', () => {
  const prompt = buildPrompt(input('Short snippet', 'metadata_only'));
  assert.match(prompt, /only evidence/i);
  assert.match(prompt, /do not invent/i);
  assert.match(prompt, /appears to/i);
  assert.doesNotMatch(prompt, /Infer from the URL/i);
  assert.match(prompt, /Do not call the destination an article/i);
  assert.equal(ENRICH_PROMPT_VERSION, 'qlip-enrich-v2.1');
});

test('metadata-only pages cannot receive an invented specific content type', () => {
  assert.equal(resolveContentTypeLabel(input('', 'metadata_only'), 'News Article'), 'Other');
  assert.equal(
    resolveContentTypeLabel({ ...input('', 'metadata_only'), sourceType: 'tweet' }, 'Opinion'),
    'Social Post',
  );
  assert.equal(resolveContentTypeLabel(input('full body', 'full'), 'Tutorial'), 'Tutorial');
});

test('provider output is normalized to the shared contract', () => {
  const result = normalize({
    summary: 'Summary',
    key_points: ['one', 'two', 'three', 'four', 'five', 'six'],
    tags: ['Machine Learning', '  Swift UI  ', ''],
    topic_category: 'not-a-topic',
    content_type_label: 'not-a-label',
    language: 'ar',
    suggested_title: 'Title',
  });
  assert.deepEqual(result.tags, ['machine-learning', 'swift-ui']);
  assert.equal(result.key_points.length, 5);
  assert.equal(result.topic_category, 'Other');
  assert.equal(result.content_type_label, 'Other');
  assert.equal(result.language, 'ar');
});
