// ============================================================
// Apply netlify/schema.sql to the Netlify Database
// ============================================================
// Runs as part of `prenext:build`, so every deploy lands the code and
// the schema it expects at the same time. Before this existed the
// schema had to be applied by hand (`netlify db query --file
// netlify/schema.sql`) and it silently never was: production reached
// September 2026 with an empty database, so every DB-backed feature
// (accounts, saved carts, orders, order items) was dead on the live
// site while the code that used them shipped fine.
//
// Safe to run on every build:
//   * schema.sql is additive and idempotent: CREATE TABLE / INDEX
//     IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, and constraint drops
//     that are immediately re-added. It never drops a table or a
//     column and never touches a row.
//   * With no NETLIFY_DATABASE_URL it exits 0 without connecting, so
//     CI and a local `npm run next:build` are unaffected.
//   * A failure fails the build. That is deliberate: a deploy whose
//     database is missing tables is worse than no deploy, and the
//     previous deploy stays published.
// ============================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SCHEMA = fileURLToPath(new URL("../netlify/schema.sql", import.meta.url));

// schema.sql is plain DDL: no functions, no triggers, no DO blocks and
// no dollar-quoted bodies, so a semicolon ending a line is always a
// statement boundary. apply-schema.test.mjs fails if that stops being
// true, rather than letting this splitter quietly cut a statement in half.
export function splitStatements(sql) {
  return sql
    .split(/;[ \t]*$/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) =>
      chunk
        .split("\n")
        .some((line) => line.trim() && !line.trim().startsWith("--")),
    );
}

async function main() {
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log(
      "[schema] No NETLIFY_DATABASE_URL, so skipping. (Expected in CI and in local builds without a database.)",
    );
    return;
  }

  const statements = splitStatements(readFileSync(SCHEMA, "utf8"));
  console.log(`[schema] Applying ${statements.length} statements from netlify/schema.sql`);

  const { neon } = await import("@netlify/neon");
  const sql = neon();
  const run =
    typeof sql.query === "function" ? (text) => sql.query(text) : (text) => sql(text);

  for (const [i, statement] of statements.entries()) {
    try {
      await run(statement);
    } catch (error) {
      // The first line of a statement is its CREATE/ALTER, which is the
      // part worth reading in a build log.
      const head = statement.split("\n").find((l) => l.trim() && !l.trim().startsWith("--"));
      console.error(`[schema] Failed at statement ${i + 1}/${statements.length}: ${head}`);
      throw error;
    }
  }

  console.log(`[schema] Applied ${statements.length} statements cleanly.`);
}

// Only migrate when run as a command. Importing this module (the test
// does, for splitStatements) must not touch a database.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main().catch((error) => {
    console.error("[schema] Migration failed. This build will not deploy.");
    console.error(error);
    process.exit(1);
  });
}
