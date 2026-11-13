import assert from 'node:assert/strict';
import test from 'node:test';

import { INVALID_PARAMS, OwnershipError, assertOwnedFolder, assertOwnedItem, isUuid } from '../supabase/functions/_shared/ownership.ts';
import { FOLDER_A, FOLDER_B, ITEM_A, ITEM_B, USER_A, seededDb } from './helpers/fake-db.mjs';

test('assertOwnedFolder returns the id for the owner', async () => {
  assert.equal(await assertOwnedFolder(seededDb(), USER_A, FOLDER_A), FOLDER_A);
});

test('assertOwnedFolder rejects another user\'s folder with the same message as a missing one', async () => {
  const db = seededDb();
  const missing = '99999999-9999-4999-8999-999999999999';
  const foreign = await assertOwnedFolder(db, USER_A, FOLDER_B).catch((e) => e);
  const absent = await assertOwnedFolder(db, USER_A, missing).catch((e) => e);
  for (const e of [foreign, absent]) {
    assert.ok(e instanceof OwnershipError);
    assert.equal(e.code, INVALID_PARAMS);
    assert.equal(e.message, 'Folder not found.');
  }
});

test('assertOwnedFolder rejects values that are not UUIDs without querying', async () => {
  const db = seededDb();
  for (const bad of ['', 'not-a-uuid', '1; drop table folders', null, undefined, 42, {}, FOLDER_A + 'x']) {
    await assert.rejects(() => assertOwnedFolder(db, USER_A, bad), OwnershipError);
  }
  assert.equal(db.writes.length, 0);
});

test('assertOwnedItem accepts own items and rejects foreign ones', async () => {
  const db = seededDb();
  assert.equal(await assertOwnedItem(db, USER_A, ITEM_A), ITEM_A);
  await assert.rejects(() => assertOwnedItem(db, USER_A, ITEM_B), { name: 'OwnershipError', message: 'Item not found.' });
});

test('a database failure is not reported as "not found"', async () => {
  const brokenDb = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'boom' } }) }) }) }) }) };
  const err = await assertOwnedFolder(brokenDb, USER_A, FOLDER_A).catch((e) => e);
  assert.ok(!(err instanceof OwnershipError));
  assert.match(err.message, /Ownership check failed: boom/);
});

test('isUuid', () => {
  assert.equal(isUuid(FOLDER_A), true);
  assert.equal(isUuid(FOLDER_A.toUpperCase()), true);
  assert.equal(isUuid('nope'), false);
});
