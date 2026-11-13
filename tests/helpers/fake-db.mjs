// Tiny in-memory stand-in for the supabase-js query builder, used by the
// ownership tests. It supports exactly the calls the MCP handlers and the
// ownership helper make, and records every write so a test can prove a rejected
// call wrote nothing. It does NOT emulate database triggers (those are tested in SQL).

/** @param {Record<string, any[]>} [seed] @returns {any} */
export function createFakeDb(seed = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));
  const writes = [];
  let counter = 0;
  const table = (name) => (tables[name] ??= []);

  function builder(name) {
    const state = { op: 'select', filters: [], payload: null, wantsRow: false, onConflict: null };
    const run = () => {
      const rows = table(name);
      const match = (r) => state.filters.every(([c, v]) => r[c] === v);
      if (state.op === 'insert') {
        const list = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = list.map((p) => ({ id: p.id ?? `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`, ...p }));
        rows.push(...inserted);
        writes.push({ op: 'insert', table: name, rows: inserted.map((r) => ({ ...r })) });
        return { data: inserted, error: null };
      }
      if (state.op === 'upsert') {
        const keys = (state.onConflict ?? 'id').split(',');
        const fresh = [];
        for (const p of Array.isArray(state.payload) ? state.payload : [state.payload]) {
          if (rows.some((r) => keys.every((k) => r[k] === p[k]))) continue; // ignoreDuplicates
          const row = { id: p.id ?? `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`, ...p };
          rows.push(row);
          fresh.push(row);
        }
        writes.push({ op: 'upsert', table: name, rows: fresh.map((r) => ({ ...r })) });
        return { data: fresh, error: null };
      }
      if (state.op === 'update') {
        const hit = rows.filter(match);
        hit.forEach((r) => Object.assign(r, state.payload));
        writes.push({ op: 'update', table: name, patch: { ...state.payload }, count: hit.length });
        return { data: hit, error: null };
      }
      if (state.op === 'delete') {
        const hit = rows.filter(match);
        tables[name] = rows.filter((r) => !match(r));
        writes.push({ op: 'delete', table: name, count: hit.length });
        return { data: hit, error: null };
      }
      return { data: rows.filter(match), error: null };
    };
    const api = {
      select() { return api; },
      insert(p) { state.op = 'insert'; state.payload = p; return api; },
      update(p) { state.op = 'update'; state.payload = p; return api; },
      upsert(p, opts) { state.op = 'upsert'; state.payload = p; state.onConflict = opts?.onConflict ?? null; return api; },
      delete() { state.op = 'delete'; return api; },
      eq(c, v) { state.filters.push([c, v]); return api; },
      in() { return api; },
      textSearch() { return api; },
      order() { return api; },
      range() { return api; },
      limit() { return api; },
      overlaps() { return api; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }); },
      single() { const r = run(); return Promise.resolve(r.data[0] ? { data: r.data[0], error: null } : { data: null, error: { message: 'no rows' } }); },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return api;
  }

  return { from: (name) => builder(name), tables, writes };
}

export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';
export const FOLDER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const FOLDER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const ITEM_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const ITEM_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/** @returns {any} */
export function seededDb() {
  return createFakeDb({
    folders: [
      { id: FOLDER_A, user_id: USER_A, name: 'A folder', parent_id: null },
      { id: FOLDER_B, user_id: USER_B, name: 'B folder', parent_id: null },
    ],
    content_items: [
      { id: ITEM_A, user_id: USER_A, title: 'A item', canonical_url: 'https://a.example/x' },
      { id: ITEM_B, user_id: USER_B, title: 'B item', canonical_url: 'https://b.example/x' },
    ],
    item_folders: [],
    jobs: [],
  });
}
