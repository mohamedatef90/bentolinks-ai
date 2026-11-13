import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFacebook } from '../supabase/functions/_shared/parsers/facebook.ts';

test('Facebook parser maps the current Apify post dataset shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json([{
    facebookUrl: 'https://www.facebook.com/share/p/example/',
    topLevelUrl: 'https://www.facebook.com/example/posts/123',
    postId: '123',
    author: { name: 'Qlip Creator' },
    text: 'A real Facebook post caption from the current Apify dataset shape.',
    media: [{
      thumbnail: 'https://cdn.example.com/post-thumbnail.jpg',
      photo_image: { uri: 'https://cdn.example.com/post-image.jpg' },
    }],
    time: '2026-08-17T18:00:00.000Z',
  }]);

  try {
    const result = await parseFacebook('https://www.facebook.com/share/p/example/', {
      apifyToken: 'test-token',
      geminiKey: null,
    });

    assert.equal(result.author, 'Qlip Creator');
    assert.equal(result.content_text, 'A real Facebook post caption from the current Apify dataset shape.');
    assert.equal(result.thumbnail_url, 'https://cdn.example.com/post-thumbnail.jpg');
    assert.equal(result.published_at, '2026-08-17T18:00:00.000Z');
    assert.equal(result.raw_metadata?.shareable_url, 'https://www.facebook.com/example/posts/123');
    assert.equal(result.raw_metadata?.facebook_extraction?.has_text, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Facebook parser still maps the original actor response shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json([{
    message: JSON.stringify({ text: 'A caption from the original actor response.' }),
    owner: { name: 'Original Page' },
    attachments: [{ media: { image: { uri: 'https://cdn.example.com/original.jpg' } } }],
    facebookUrl: 'https://www.facebook.com/original/posts/456',
    publish_time: 1786999200,
  }]);

  try {
    const result = await parseFacebook('https://www.facebook.com/share/p/original/', {
      apifyToken: 'test-token',
      geminiKey: null,
    });

    assert.equal(result.author, 'Original Page');
    assert.equal(result.content_text, 'A caption from the original actor response.');
    assert.equal(result.thumbnail_url, 'https://cdn.example.com/original.jpg');
    assert.equal(result.raw_metadata?.shareable_url, 'https://www.facebook.com/original/posts/456');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
