import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSourceType, inferItemKind } from '../supabase/functions/_shared/canonical.ts';

const bookmarks = [
  'https://example.com',
  'https://www.notion.so/product',
  'https://github.com/openai',
  'https://facebook.com/qlip',
  'https://linear.app/pricing',
];

const reading = [
  'https://example.com/blog/how-to-build-a-personal-knowledge-vault',
  'https://news.example.com/2026/07/23/qlip-launches-new-reader',
  'https://medium.com/@writer/a-complete-guide-to-reading-better-123456',
  'https://en.wikipedia.org/wiki/Artificial_intelligence',
  'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
  'https://developer.apple.com/xcode/swiftui/',
  'https://supabase.com/docs/guides/functions',
  'https://doc.rust-lang.org/book/',
  'https://docs.python.org/3/library/asyncio.html',
  'https://example.com/files/guide.pdf?download=1',
  'https://example.com/books/knowledge.epub',
  'https://youtube.com/watch?v=abc123',
  'https://m.youtube.com/live/abc123?feature=share',
  'https://instagram.com/p/ABC123/',
  'https://instagram.com/share/reel/ABC123/',
  'https://tiktok.com/@creator/video/123456',
  'https://vm.tiktok.com/ZM123456/',
  'https://x.com/creator/status/123456',
  'https://reddit.com/r/productivity/comments/abc123/a_useful_post/',
  'https://facebook.com/share/p/abc123/',
  'https://www.facebook.com/share/r/1M5NDEZm1E/?mibextid=wwXIfr',
  'https://facebook.com/share/v/1BcSsNvwX9/',
  'https://facebook.com/reel/1058766843146036',
  'https://threads.net/@creator/post/abc123',
  'https://linkedin.com/feed/update/urn:li:activity:123456',
];

test('domain and product URLs route to Bookmarks', () => {
  for (const url of bookmarks) {
    assert.equal(inferItemKind(url), 'bookmark', url);
  }
});

test('documentation and knowledge-base home pages remain Bookmarks', () => {
  assert.equal(inferItemKind('https://en.wikipedia.org/wiki/Main_Page'), 'bookmark');
  assert.equal(inferItemKind('https://developer.apple.com/'), 'bookmark');
  assert.equal(inferItemKind('https://supabase.com/'), 'bookmark');
});

test('articles, social posts, PDFs and e-books route to Reading', () => {
  for (const url of reading) {
    assert.equal(inferItemKind(url), 'content', url);
  }
});

test('rich source detection remains compatible with the worker parsers', () => {
  assert.equal(detectSourceType('https://youtube.com/watch?v=abc123'), 'youtube');
  assert.equal(detectSourceType('https://m.youtube.com/live/abc123'), 'youtube');
  assert.equal(detectSourceType('https://instagram.com/reel/abc123/'), 'reel');
  assert.equal(detectSourceType('https://instagram.com/share/p/abc123/'), 'reel');
  assert.equal(detectSourceType('https://vm.tiktok.com/ZM123456/'), 'reel');
  assert.equal(detectSourceType('https://x.com/user/status/123'), 'tweet');
  assert.equal(detectSourceType('https://example.com/article'), 'article');
});
