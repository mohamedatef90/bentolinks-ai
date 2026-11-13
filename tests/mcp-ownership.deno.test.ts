/// <reference lib="deno.ns" />
// Run with Deno (the MCP handlers import `npm:` packages):
//   npm run test:edge
// Proves that a rejected foreign ID returns a JSON-RPC error and writes nothing,
// and that same-user flows are unchanged. Uses an in-memory fake database.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { FOLDER_A, FOLDER_B, ITEM_A, ITEM_B, USER_A, seededDb } from './helpers/fake-db.mjs';

// The MCP module calls Deno.serve at import time; stub it so importing starts nothing.
// deno-lint-ignore no-explicit-any
(Deno as any).serve = () => ({});
const { handleMessage } = await import('../supabase/functions/mcp/index.ts');

// deno-lint-ignore no-explicit-any
type Msg = any;
const call = (db: unknown, name: string, args: Record<string, unknown>): Promise<Msg> =>
  // deno-lint-ignore no-explicit-any
  handleMessage(db as any, USER_A, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

function assertRejected(res: Msg, db: { writes: unknown[] }) {
  assertEquals(res.error?.code, -32602);
  assert(/not found/i.test(res.error.message));
  assertEquals(db.writes.length, 0, 'a rejected call must write nothing');
}

Deno.test('save_note with another user\'s folder_id is rejected and writes nothing', async () => {
  const db = seededDb();
  assertRejected(await call(db, 'save_note', { text: 'hello', folder_id: FOLDER_B }), db);
});

Deno.test('save_note with a malformed folder_id is rejected and writes nothing', async () => {
  const db = seededDb();
  assertRejected(await call(db, 'save_note', { text: 'hello', folder_id: "x'; drop table folders;--" }), db);
});

Deno.test('save_note: same-user flows unchanged (with and without folder)', async () => {
  const db = seededDb();
  const withFolder = await call(db, 'save_note', { text: 'hello', folder_id: FOLDER_A });
  assertEquals(withFolder.result?.isError, undefined);
  assertEquals(db.tables.item_folders.length, 1);
  assertEquals(db.tables.item_folders[0].folder_id, FOLDER_A);
  assertEquals(db.tables.item_folders[0].user_id, USER_A);
  const without = await call(db, 'save_note', { text: 'plain note' });
  assertEquals(without.result?.isError, undefined);
  assertEquals(db.tables.item_folders.length, 1);
  assertEquals(db.tables.jobs.length, 2);
});

Deno.test('create_folder with another user\'s parent_id is rejected and writes nothing', async () => {
  const db = seededDb();
  assertRejected(await call(db, 'create_folder', { name: 'evil', parent_id: FOLDER_B }), db);
});

Deno.test('create_folder: same-user flows unchanged (with and without parent)', async () => {
  const db = seededDb();
  const child = await call(db, 'create_folder', { name: 'child', parent_id: FOLDER_A });
  assertEquals(child.result?.isError, undefined);
  const root = await call(db, 'create_folder', { name: 'root' });
  assertEquals(root.result?.isError, undefined);
  const created = db.tables.folders.filter((f: Msg) => f.name === 'child' || f.name === 'root');
  assertEquals(created.length, 2);
  assertEquals(created.find((f: Msg) => f.name === 'child').parent_id, FOLDER_A);
  assertEquals(created.find((f: Msg) => f.name === 'root').parent_id, null);
  assert(created.every((f: Msg) => f.user_id === USER_A));
});

Deno.test('update_item on another user\'s item is rejected and writes nothing', async () => {
  const db = seededDb();
  assertRejected(await call(db, 'update_item', { id: ITEM_B, folder_id: FOLDER_A }), db);
  assertRejected(await call(db, 'update_item', { id: ITEM_B, title: 'hijacked' }), db);
  assertEquals(db.tables.content_items.find((i: Msg) => i.id === ITEM_B).title, 'B item');
});

Deno.test('update_item with a foreign folder keeps the existing filing (no unfile before validation)', async () => {
  const db = seededDb();
  db.tables.item_folders.push({ item_id: ITEM_A, folder_id: FOLDER_A, user_id: USER_A });
  assertRejected(await call(db, 'update_item', { id: ITEM_A, folder_id: FOLDER_B }), db);
  assertEquals(db.tables.item_folders.length, 1);
});

Deno.test('update_item: same-user flows unchanged (file, retitle, unfile)', async () => {
  const db = seededDb();
  const filed = await call(db, 'update_item', { id: ITEM_A, folder_id: FOLDER_A, title: 'renamed' });
  assertEquals(filed.result?.isError, undefined);
  assertEquals(db.tables.item_folders.length, 1);
  assertEquals(db.tables.content_items.find((i: Msg) => i.id === ITEM_A).title, 'renamed');
  const unfiled = await call(db, 'update_item', { id: ITEM_A, folder_id: null });
  assertEquals(unfiled.result?.isError, undefined);
  assertEquals(db.tables.item_folders.length, 0);
});

Deno.test('save_link with another user\'s folder_id is rejected and writes nothing', async () => {
  const db = seededDb();
  assertRejected(await call(db, 'save_link', { url: 'https://example.com/article-one', folder_id: FOLDER_B }), db);
});

Deno.test('save_link: same-user flow unchanged', async () => {
  const db = seededDb();
  const res = await call(db, 'save_link', { url: 'https://example.com/article-one', folder_id: FOLDER_A });
  assertEquals(res.result?.isError, undefined);
  assertEquals(db.tables.item_folders.length, 1);
  assertEquals(db.tables.item_folders[0].folder_id, FOLDER_A);
  assertEquals(db.tables.jobs.length, 1);
});
