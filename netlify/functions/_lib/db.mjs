// ============================================================
// Shared Netlify Database client
// ============================================================
// Every function imports `sql` from here. The @netlify/database
// package connects automatically — no connection string needed.
//
// Usage:
//   import { sql } from "./_lib/db.mjs";
//   const rows = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
//
// The tagged-template form is the safe-by-default API — parameters are
// always bound, never interpolated. Don't build SQL with string
// concatenation. Don't use `sql(string)` with user-controlled input.
// ============================================================

import { getDatabase } from "@netlify/database";

const db = getDatabase();
export const sql = db.sql;
