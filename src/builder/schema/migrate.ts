// ============================================================
// Builder schema — versioning & migrations
// ============================================================
// Every document carries schemaVersion. When the schema evolves,
// register a migration here and old documents (including ones
// restored from a years-old thumb drive) load forever. Documents
// from a NEWER schema than this code fail loudly instead of being
// silently mangled.
// ============================================================

export const CURRENT_SCHEMA_VERSION = 1;

type RawDoc = Record<string, unknown>;

/** Migration from version N to N+1, keyed by N. */
const MIGRATIONS: Record<number, (doc: RawDoc) => RawDoc> = {
  // 1: (doc) => ({ ...doc, newField: defaultValue, schemaVersion: 2 }),
};

export class SchemaVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaVersionError";
  }
}

/**
 * Bring a raw parsed-JSON document up to CURRENT_SCHEMA_VERSION.
 * Run this BEFORE zod validation — migrations operate on raw shapes.
 */
export function migrateDocument(raw: unknown): RawDoc {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaVersionError("Document is not an object");
  }
  let doc = raw as RawDoc;
  const v = doc.schemaVersion;
  let version = typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `Document schemaVersion ${version} is newer than this builder (${CURRENT_SCHEMA_VERSION}). ` +
        `Update the builder before opening this document.`
    );
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new SchemaVersionError(`No migration registered from schemaVersion ${version}`);
    }
    doc = step(doc);
    version += 1;
  }
  return { ...doc, schemaVersion: CURRENT_SCHEMA_VERSION };
}
