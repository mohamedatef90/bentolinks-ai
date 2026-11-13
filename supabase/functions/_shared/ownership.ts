// Ownership checks for client-supplied IDs.
//
// Edge Functions talk to Postgres with the service-role key, which bypasses RLS.
// Every ID that arrives from a caller (folder_id, parent_id, item id) must
// therefore be verified against the caller's user_id here before it is used in a
// write. This is the single code path for that check; the database triggers in
// the `enforce_folder_tenancy` migration are the second line of defence.
//
// The helper deliberately returns the same message for "does not exist",
// "belongs to someone else" and "not a UUID", so it cannot be used to probe
// which IDs exist in other accounts.

/** JSON-RPC "invalid params" code, used by the MCP server for rejected IDs. */
export const INVALID_PARAMS = -32602;

export class OwnershipError extends Error {
  readonly code = INVALID_PARAMS;
  constructor(message: string) {
    super(message);
    this.name = 'OwnershipError';
  }
}

// Minimal structural type so this module has no runtime dependency on supabase-js
// (and can be unit-tested in plain Node with a fake client).
// deno-lint-ignore no-explicit-any
export type DbLike = { from(table: string): any };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

async function assertOwned(
  db: DbLike,
  userId: string,
  table: 'folders' | 'content_items',
  id: unknown,
  notFound: string,
): Promise<string> {
  if (!isUuid(id)) throw new OwnershipError(notFound);
  const { data, error } = await db
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  // A database failure is not an authorization answer: surface it as a normal
  // error rather than pretending the row is missing.
  if (error) throw new Error(`Ownership check failed: ${error.message}`);
  if (!data) throw new OwnershipError(notFound);
  return id;
}

/** Resolve when `folderId` is a folder owned by `userId`; throw OwnershipError otherwise. */
export function assertOwnedFolder(db: DbLike, userId: string, folderId: unknown): Promise<string> {
  return assertOwned(db, userId, 'folders', folderId, 'Folder not found.');
}

/** Resolve when `itemId` is an item owned by `userId`; throw OwnershipError otherwise. */
export function assertOwnedItem(db: DbLike, userId: string, itemId: unknown): Promise<string> {
  return assertOwned(db, userId, 'content_items', itemId, 'Item not found.');
}
