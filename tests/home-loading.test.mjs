import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function homeApi(responses) {
  const requests = [];
  const supabase = {
    from(table) {
      const calls = [['from', table]];
      const response = responses[requests.length];
      requests.push(calls);
      const builder = new Proxy({}, {
        get(_, key) {
          if (key === 'then') return (resolve, reject) => Promise.resolve(response).then(resolve, reject);
          return (...args) => { calls.push([key, ...args]); return builder; };
        },
      });
      return builder;
    },
  };
  const source = (await readFile(new URL('../services/api.ts', import.meta.url), 'utf8'))
    .replace("import { supabase } from './supabase';", 'const supabase = globalThis.__homeLoadingTestClient;');
  globalThis.__homeLoadingTestClient = supabase;
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
  const module = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);
  delete globalThis.__homeLoadingTestClient;
  return { api: module.api, requests };
}

test('home loads bounded sections while keeping archive-wide counts', async () => {
  const older = { id: 'old-pin', created_at: '2020-01-01T00:00:00Z' };
  const newer = { id: 'new', created_at: '2026-10-25T00:00:00Z' };
  const responses = Array.from({ length: 7 }, () => ({ data: [newer], error: null }));
  responses[5] = { data: [older, newer], error: null };
  const counts = [992, 900, 5, 8858, 8000, 41];
  responses.push(...counts.map(count => ({ count, data: null, error: null })));
  const { api, requests } = await homeApi(responses);
  const result = await api.items.fetchHome();
  assert.deepEqual(result.items.map(item => item.id), ['new', 'old-pin']);
  assert.deepEqual(Object.values(result.stats), counts);
  for (const calls of requests.slice(0, 7)) {
    assert.ok(calls.some(([method]) => method === 'limit'), 'unbounded home query');
    const columns = calls.find(([method]) => method === 'select')[1];
    assert.ok(!/raw_metadata|key_points|content_text/.test(columns), 'reader payload fetched on home');
  }
  for (const calls of requests.slice(7)) {
    assert.deepEqual(calls.find(([method]) => method === 'select')[2], { count: 'exact', head: true });
  }
});

test('home propagates database failures instead of displaying false empty counts', async () => {
  const responses = Array.from({ length: 13 }, () => ({ data: [], error: null }));
  responses[0] = { data: null, error: { message: 'network unavailable' } };
  const { api } = await homeApi(responses);
  await assert.rejects(api.items.fetchHome(), /network unavailable/);
});

test('home search queries the archive without downloading reader payloads or invoking AI', async () => {
  const { api, requests } = await homeApi([{ data: [{ id: 'older-match' }], error: null }]);
  assert.equal((await api.items.searchHome('older article'))[0].id, 'older-match');
  assert.ok(requests[0].some(([method, column]) => method === 'textSearch' && column === 'search_tsv'));
  assert.ok(requests[0].some(([method, size]) => method === 'limit' && size === 100));
});
