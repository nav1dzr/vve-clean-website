// Minimal in-memory fake of the Supabase JS query builder, purpose-built
// for unit-testing admin/api/_lib/invoiceLifecycle.js and
// receiptLifecycle.js directly (they take `supabase` as a plain argument —
// dependency injection — rather than importing a module to mock, which is
// the pattern the existing admin/tests/api/**/*.test.js files use for HTTP
// route handlers). Supports exactly the chain shapes those two lifecycle
// modules use: select/insert/update/delete, eq/in/is, order, single/
// maybeSingle, and plain `await` on the builder itself. Not a general-
// purpose Supabase mock — extend deliberately if a new chain shape appears.

export function createFakeSupabase(initialData = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(initialData)) {
    tables[name] = rows.map((r) => ({ ...r }));
  }
  let idCounter = 1;
  let createdAtCounter = 0;
  const numberCounters = {};

  // Real Postgres generates gen_random_uuid()-shaped ids; several routes
  // validate :id path params with a strict UUID regex
  // (admin/api/_lib/normalise.js isValidUuid), so a fixture id has to look
  // like a real one for route-level tests that round-trip an id through a
  // URL, not just table-lookup tests that only ever compare ids to
  // themselves.
  function genId() {
    const n = (idCounter++).toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${n}`;
  }

  function from(table) {
    if (!tables[table]) tables[table] = [];
    let pendingInsert = null;
    let pendingUpdate = null;
    let pendingDelete = false;
    const filters = [];
    let orderSpec = null;
    let rangeSpec = null;

    async function execute(wantSingle) {
      if (pendingInsert) {
        // Mimics a `created_at timestamptz DEFAULT now()` column: only
        // fills it in when the caller didn't supply one, and guarantees
        // strictly increasing values (a real DB call would too, at
        // microsecond resolution) so ordered-by-created_at test
        // assertions are deterministic regardless of how fast the fake
        // executes.
        const inserted = pendingInsert.map((row) => ({
          id: genId(),
          created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, createdAtCounter++)).toISOString(),
          ...row,
        }));
        tables[table].push(...inserted);
        return { data: wantSingle ? inserted[0] : inserted, error: null };
      }
      if (pendingUpdate) {
        const matched = tables[table].filter((r) => filters.every((f) => f(r)));
        matched.forEach((r) => Object.assign(r, pendingUpdate));
        return { data: wantSingle ? (matched[0] || null) : matched, error: null };
      }
      if (pendingDelete) {
        const matched = tables[table].filter((r) => filters.every((f) => f(r)));
        tables[table] = tables[table].filter((r) => !filters.every((f) => f(r)));
        return { data: wantSingle ? (matched[0] || null) : matched, error: null };
      }
      let rows = tables[table].filter((r) => filters.every((f) => f(r)));
      if (orderSpec) {
        rows = [...rows].sort((a, b) => {
          const av = a[orderSpec.col];
          const bv = b[orderSpec.col];
          if (av < bv) return orderSpec.ascending ? -1 : 1;
          if (av > bv) return orderSpec.ascending ? 1 : -1;
          return 0;
        });
      }
      const totalCount = rows.length;
      if (rangeSpec) rows = rows.slice(rangeSpec.from, rangeSpec.to + 1);
      return { data: wantSingle ? (rows[0] || null) : rows, error: null, count: totalCount };
    }

    const builder = {
      select() { return builder; },
      // Real (small) implementation of Postgrest-style .or('a.ilike.%x%,b.eq.y')
      // strings — comma-separated clauses, each `column.operator.value`,
      // combined as a logical OR and AND-ed with every other filter already
      // on the builder. Supports exactly the two operators this codebase's
      // .or() calls ever use (ilike with %wildcard%, eq) — extend
      // deliberately if a new operator shape appears.
      or(expr) {
        const clauses = expr.split(',').map((c) => {
          const [col, op, ...rest] = c.split('.');
          return { col, op, value: rest.join('.') };
        });
        filters.push((r) => clauses.some(({ col, op, value }) => {
          const cell = r[col];
          if (op === 'eq') return String(cell) === value;
          if (op === 'ilike') {
            if (cell == null) return false;
            const pattern = value.replace(/%/g, '.*');
            return new RegExp(`^${pattern}$`, 'i').test(String(cell));
          }
          return false;
        }));
        return builder;
      },
      range(from, to) { rangeSpec = { from, to }; return builder; },
      insert(rowOrRows) {
        pendingInsert = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        return builder;
      },
      update(patch) { pendingUpdate = patch; return builder; },
      delete() { pendingDelete = true; return builder; },
      eq(col, val) { filters.push((r) => r[col] === val); return builder; },
      neq(col, val) { filters.push((r) => r[col] !== val); return builder; },
      // SQL LIKE semantics (case-sensitive, % wildcard) — used by
      // customerLifecycle.js's manual-booking-ref uniqueness check
      // (`booking_ref LIKE 'BASE%'`), mirroring api/create-checkout-
      // session.js's real query.
      like(col, pattern) {
        const regex = new RegExp(`^${pattern.replace(/%/g, '.*')}$`);
        filters.push((r) => r[col] != null && regex.test(String(r[col])));
        return builder;
      },
      ilike(col, pattern) {
        const regex = new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i');
        filters.push((r) => r[col] != null && regex.test(String(r[col])));
        return builder;
      },
      in(col, vals) { filters.push((r) => vals.includes(r[col])); return builder; },
      // `?? null` treats an unset column the same as an explicit NULL,
      // matching real Postgres — a nullable column that was never written
      // reads back as NULL, not `undefined`.
      is(col, val) { filters.push((r) => (r[col] ?? null) === val); return builder; },
      order(col, opts) { orderSpec = { col, ascending: opts?.ascending !== false }; return builder; },
      async maybeSingle() { return execute(true); },
      async single() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };

    return builder;
  }

  async function rpc(fnName, args) {
    if (fnName === 'next_document_number') {
      const type = args.p_doc_type;
      numberCounters[type] = (numberCounters[type] || 0) + 1;
      const year = new Date().getFullYear();
      const prefix = type === 'invoice' ? 'INV' : 'REC';
      return { data: `${prefix}-${year}-${String(numberCounters[type]).padStart(6, '0')}`, error: null };
    }
    return { data: null, error: new Error(`fakeSupabase: unknown rpc ${fnName}`) };
  }

  // Minimal fake of the Storage API surface admin/api/_lib/invoiceStorage.js
  // uses: upload() and createSignedUrl(). Files are kept in memory only —
  // no real bytes ever touch disk or a network call in tests.
  const storedFiles = {};
  function storageFrom(bucket) {
    return {
      async upload(path, buffer) {
        storedFiles[`${bucket}/${path}`] = buffer;
        return { data: { path }, error: null };
      },
      async createSignedUrl(path) {
        if (!storedFiles[`${bucket}/${path}`]) {
          return { data: null, error: new Error('object not found') };
        }
        return { data: { signedUrl: `https://fake-storage.test/${bucket}/${path}?signed=1` }, error: null };
      },
      async download(path) {
        const buffer = storedFiles[`${bucket}/${path}`];
        if (!buffer) return { data: null, error: new Error('object not found') };
        return { data: { arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) }, error: null };
      },
    };
  }

  return { from, rpc, storage: { from: storageFrom }, _tables: tables, _storedFiles: storedFiles };
}
