// ============================================================
// scripts/apply-schema.mjs: the statement splitter
// ============================================================
// The build applies netlify/schema.sql one statement at a time, because
// the Neon HTTP driver takes one statement per call. The splitter cuts
// on a semicolon that ends a line, which is only safe while schema.sql
// stays plain DDL. These tests fail the moment that stops being true,
// so a future dollar-quoted function body can't quietly get cut in half
// and half-applied to production.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitStatements } from "../../../../scripts/apply-schema.mjs";

const schema = readFileSync(new URL("../../../schema.sql", import.meta.url), "utf8");

// A line with its `--` comment removed. Comments are full-line or
// trailing in this file; there are no block comments.
const withoutComment = (line) => line.replace(/--.*$/, "");

test("schema.sql contains nothing the splitter cannot handle", () => {
  assert.ok(
    !/\$\$|\$[a-z_]*\$/i.test(schema),
    "dollar-quoted block found: a semicolon inside one is not a statement boundary, so the splitter in apply-schema.mjs must be replaced before this lands",
  );
  assert.ok(
    !/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER|^\s*DO\s/im.test(schema),
    "function, trigger or DO block found: same problem as above",
  );
});

test("every statement is whole", () => {
  const statements = splitStatements(schema);
  assert.ok(statements.length > 40, "expected the full schema, got " + statements.length);

  for (const statement of statements) {
    const code = statement.split("\n").map(withoutComment).join("\n");

    const open = (code.match(/\(/g) || []).length;
    const close = (code.match(/\)/g) || []).length;
    assert.equal(open, close, `unbalanced parentheses, so the statement was cut:\n${statement}`);

    assert.ok(
      !code.includes(";"),
      `semicolon left inside a statement, so the split missed a boundary:\n${statement}`,
    );

    assert.match(
      code.trim(),
      /^(CREATE|ALTER|COMMENT)\b/i,
      `statement does not start with a DDL verb:\n${statement}`,
    );
  }
});

test("every statement is additive: nothing drops a table, column or row", () => {
  for (const statement of splitStatements(schema)) {
    const code = statement.split("\n").map(withoutComment).join("\n");
    assert.ok(
      !/\bDROP\s+(TABLE|COLUMN|DATABASE|SCHEMA|INDEX)\b/i.test(code),
      `destructive statement. This file runs on every production deploy:\n${statement}`,
    );
    assert.ok(
      !/^\s*(DELETE|TRUNCATE|UPDATE)\b/im.test(code),
      `statement touches rows. schema.sql is structure only:\n${statement}`,
    );
  }
});

test("the tables the site depends on are all created", () => {
  const created = splitStatements(schema)
    .map((s) => s.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1])
    .filter(Boolean);

  for (const table of [
    "profiles",
    "addresses",
    "saved_carts",
    "orders",
    "order_items",
    "product_waitlist",
    "order_milestones",
    "reviews",
  ]) {
    assert.ok(created.includes(table), `schema.sql no longer creates ${table}`);
  }
});
