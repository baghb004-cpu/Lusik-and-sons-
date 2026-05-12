// ============================================================
// Shared Netlify Database client
// ============================================================
// Every function imports `sql` from here. The @netlify/neon package
// reads the connection string from NETLIFY_DATABASE_URL (auto-injected
// by Netlify when the database is provisioned), so there is nothing
// to configure in code.
//
// Usage:
//   import { sql } from "./_lib/db.mjs";
//   const rows = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
//
// The tagged-template form is the safe-by-default API — parameters are
// always bound, never interpolated. Don't build SQL with string
// concatenation. Don't use `sql(string)` with user-controlled input.
// ============================================================

import { neon } from "@netlify/neon";

export const sql = neon();
