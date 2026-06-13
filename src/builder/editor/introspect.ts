// ============================================================
// Inspector forms — derived from the schema registry (plan §21)
// ============================================================
// block.ts promised that "one registry drives schema validation,
// the editor's inspector forms, and the renderer's prop
// contracts" — this module cashes the middle promise. It walks
// each block type's zod schema (v4 `.def` tree) and compiles a
// FieldSpec list the BlockPropsForm component renders, so EVERY
// block gets a visual editor and a future block type gets one
// for free the moment it's registered.
//
// Honest degradation, never a crash: any prop shape this walker
// doesn't recognize compiles to a "json" field (a validated
// textarea for that one prop), and a type whose schema isn't a
// plain object compiles to null (whole-props JSON editing, the
// old behavior). A lockstep test asserts every registered type
// introspects cleanly so regressions surface in CI, not in the
// inspector.
//
// The walker reads zod v4's public `.def` shape (type/shape/
// options/entries/element/innerType/checks). Defensive `unknown`
// casts throughout: a zod upgrade that moves these fails the
// lockstep test loudly.
// ============================================================

import { BLOCK_TYPES, newId, type Block } from "../schema/index.ts";
import { textDoc } from "../schema/richtext.ts";
import type { RichTextDoc } from "../schema/index.ts";

export type FieldKind =
  | "text" // plain string
  | "translatable" // string | {_i18n} — per-locale editing
  | "richdoc" // rich-text doc (paragraph textarea when simple)
  | "boolean"
  | "number"
  | "select" // enum / literal union
  | "multiselect" // array of enum
  | "color" // hex string
  | "href" // safe link
  | "image" // image src path
  | "productRef" // "category/slug" into the catalog
  | "rows" // array of objects (repeatable)
  | "group" // optional nested object (e.g. card.image)
  | "constant" // literal — shown, not edited
  | "json"; // honest fallback for one prop

export interface FieldOption {
  value: string | number;
  label: string;
}

export interface FieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options?: FieldOption[];
  min?: number;
  max?: number;
  /** rows / group: the nested fields ("id" fields are managed, not shown). */
  itemFields?: FieldSpec[];
  rowsMin?: number;
  rowsMax?: number;
  /** rows: whether the item schema carries a managed "id" (not all do). */
  rowsHaveId?: boolean;
  constantValue?: string;
}

// ── tiny def readers (zod v4) ───────────────────────────────
type Def = {
  type?: string;
  shape?: Record<string, unknown>;
  options?: unknown[];
  entries?: Record<string, string>;
  element?: unknown;
  innerType?: unknown;
  values?: unknown[];
  checks?: unknown[];
};

function defOf(schema: unknown): Def {
  return ((schema as { def?: Def })?.def ?? {}) as Def;
}

function checksOf(schema: unknown): Array<{ check?: string; value?: number; pattern?: unknown; minimum?: number; maximum?: number }> {
  return (defOf(schema).checks ?? []).map(
    (c) => ((c as { _zod?: { def?: object } })?._zod?.def ?? {}) as { check?: string; value?: number; pattern?: unknown }
  );
}

function patternOf(schema: unknown): string {
  for (const c of checksOf(schema)) {
    if (c.check === "string_format" && c.pattern) return String(c.pattern);
  }
  return "";
}

/** Unwrap optional/default/nullable wrappers; reports requiredness. */
function unwrap(schema: unknown): { inner: unknown; required: boolean } {
  let cur = schema;
  let required = true;
  for (let i = 0; i < 4; i++) {
    const d = defOf(cur);
    if (d.type === "optional" || d.type === "default" || d.type === "nullable") {
      required = false;
      cur = d.innerType;
    } else break;
  }
  return { inner: cur, required };
}

function humanize(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

// ── shape detectors ─────────────────────────────────────────
const shapeKeys = (schema: unknown): string[] => Object.keys(defOf(schema).shape ?? {});

function isRichDocObject(schema: unknown): boolean {
  const keys = shapeKeys(schema);
  return keys.includes("type") && keys.includes("content");
}

function isTranslatableUnion(options: unknown[]): boolean {
  return (
    options.length === 2 &&
    defOf(options[0]).type === "string" &&
    shapeKeys(options[1]).includes("_i18n")
  );
}

function isRichDocUnion(options: unknown[]): boolean {
  return options.some(isRichDocObject) || options.some((o) => shapeKeys(o).includes("_i18nDoc"));
}

function classifyString(schema: unknown): FieldKind {
  const pattern = patternOf(schema);
  if (pattern.includes("0-9a-fA-F]{3}")) return "color";
  if (pattern.includes("\\/img\\/")) return "image";
  if (pattern.includes("mailto:")) return "href";
  if (pattern.includes("[a-z0-9-]+\\/[a-z0-9-]+")) return "productRef";
  return "text";
}

function numberBounds(schema: unknown): { min?: number; max?: number } {
  const out: { min?: number; max?: number } = {};
  for (const c of checksOf(schema)) {
    if (c.check === "greater_than" && typeof c.value === "number") out.min = c.value;
    if (c.check === "less_than" && typeof c.value === "number") out.max = c.value;
  }
  return out;
}

function arrayBounds(schema: unknown): { min?: number; max?: number } {
  const out: { min?: number; max?: number } = {};
  for (const c of checksOf(schema) as Array<{ check?: string; value?: number; minimum?: number; maximum?: number }>) {
    if (c.check === "min_length") out.min = c.value ?? c.minimum;
    if (c.check === "max_length") out.max = c.value ?? c.maximum;
  }
  return out;
}

// ── the compiler ────────────────────────────────────────────
function fieldFor(name: string, rawSchema: unknown): FieldSpec {
  const { inner, required } = unwrap(rawSchema);
  const d = defOf(inner);
  const base: FieldSpec = { name, label: humanize(name), kind: "json", required };

  switch (d.type) {
    case "string":
      return { ...base, kind: classifyString(inner) };
    case "boolean":
      return { ...base, kind: "boolean" };
    case "number":
      return { ...base, kind: "number", ...numberBounds(inner) };
    case "enum": {
      const values = Object.keys(d.entries ?? {});
      return { ...base, kind: "select", options: values.map((v) => ({ value: v, label: v })) };
    }
    case "literal":
      return { ...base, kind: "constant", constantValue: String(d.values?.[0] ?? "") };
    case "union": {
      const options = d.options ?? [];
      if (isTranslatableUnion(options)) {
        return { ...base, kind: "translatable" };
      }
      if (isRichDocUnion(options)) {
        return { ...base, kind: "richdoc" };
      }
      if (options.every((o) => defOf(o).type === "literal")) {
        const opts = options.map((o) => {
          const v = defOf(o).values?.[0] as string | number;
          return { value: v, label: String(v) };
        });
        return { ...base, kind: "select", options: opts };
      }
      // e.g. featuredProduct.binding: literal | productRef → free text
      if (options.some((o) => defOf(o).type === "string")) {
        return { ...base, kind: "text" };
      }
      return base; // json fallback
    }
    case "array": {
      const elem = d.element;
      const ed = defOf(elem);
      if (ed.type === "enum") {
        const values = Object.keys(ed.entries ?? {});
        return { ...base, kind: "multiselect", options: values.map((v) => ({ value: v, label: v })) };
      }
      if (ed.type === "object") {
        const keys = Object.keys(ed.shape ?? {});
        const itemFields = Object.entries(ed.shape ?? {})
          .filter(([k]) => k !== "id") // ids are managed by the form, never shown
          .map(([k, s]) => fieldFor(k, s));
        return { ...base, kind: "rows", itemFields, rowsHaveId: keys.includes("id"), ...mapRows(arrayBounds(inner)) };
      }
      return base; // json fallback
    }
    case "object": {
      if (isRichDocObject(inner)) return { ...base, kind: "richdoc" };
      const itemFields = Object.entries(d.shape ?? {}).map(([k, s]) => fieldFor(k, s));
      return { ...base, kind: "group", itemFields };
    }
    default:
      return base; // json fallback
  }
}

const mapRows = (b: { min?: number; max?: number }) => ({ rowsMin: b.min, rowsMax: b.max });

/**
 * Compile a block type's schema into form fields.
 * null = the type has no plain-object schema (fall back to JSON editing).
 */
export function fieldsForBlockType(type: string): FieldSpec[] | null {
  const schema = BLOCK_TYPES[type];
  if (!schema) return null;
  const d = defOf(schema);
  if (d.type !== "object" || !d.shape) return null;
  try {
    return Object.entries(d.shape).map(([name, s]) => fieldFor(name, s));
  } catch {
    return null; // introspection failure → honest JSON fallback
  }
}

// ── default values (for "+ Add row" / "Add group") ──────────
export function defaultForField(f: FieldSpec): unknown {
  switch (f.kind) {
    case "text":
    case "href":
      return f.required ? "/" : undefined;
    case "translatable":
      return f.required ? "New item" : undefined;
    case "richdoc":
      return f.required ? textDoc("Text.") : undefined;
    case "boolean":
      return undefined;
    case "number":
      return f.min ?? 0;
    case "select":
      return f.required ? f.options?.[0]?.value : undefined;
    case "color":
      return "#B08842";
    case "image":
      return "/img/armenian-flag.jpg";
    case "productRef":
      return undefined;
    default:
      return undefined;
  }
}

export function newRowValue(itemFields: FieldSpec[], hasId = true): Record<string, unknown> {
  const row: Record<string, unknown> = hasId ? { id: newId() } : {};
  for (const f of itemFields) {
    const v = defaultForField(f);
    if (v !== undefined) row[f.name] = v;
  }
  return row;
}

// ── simple rich-doc ⇄ plain text (the paragraph textarea) ───
/** A doc is "simple" when it's only paragraphs of unmarked text. */
export function isSimpleDoc(doc: unknown): doc is RichTextDoc {
  const d = doc as RichTextDoc | undefined;
  if (!d || d.type !== "doc" || !Array.isArray(d.content)) return false;
  return d.content.every(
    (n) =>
      n.type === "paragraph" &&
      (n.content ?? []).every((r) => r.type === "text" && !(r.marks ?? []).length)
  );
}

export function docToPlainText(doc: RichTextDoc): string {
  return doc.content
    .map((n) => (n.content ?? []).map((r) => r.text ?? "").join(""))
    .join("\n\n");
}

export function plainTextToDoc(text: string): RichTextDoc {
  const paras = text.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  if (paras.length === 0) return textDoc("");
  return {
    type: "doc",
    content: paras.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

/** Plain-language help shown under fields in the generated form —
 *  "what is this for, what do I achieve" (keyed "type.field"). */
export const FIELD_HELP: Record<string, string> = {
  "event.start": "When it begins. Visitors' calendar apps convert it to their device automatically.",
  "event.showIcs": "The universal button (.ics file): tapping it on iPhone/iPad opens Apple Calendar, on Android the native calendar, on desktop Outlook/Apple Calendar. Works offline, works in every export.",
  "event.showGoogle": "A 'Google Calendar' button that opens calendar.google.com with the event pre-filled — for visitors who live in Google's calendar.",
  "event.showOutlook": "An 'Outlook' button that opens outlook.com with the event pre-filled — for Microsoft-calendar visitors.",
  "event.allDay": "All-day events show a date with no start time (festivals, closures).",
  "bookingButton.provider": "Calendly: free tier, one event type, visitors pick a slot. Cal.com: open-source with a generous free plan (self-hostable later). Custom: any booking page URL.",
  "bookingButton.url": "Your personal booking page link from the service (https only). The button sends visitors there — no tracking script ever loads on your site.",
  "video.kind": "Local file plays natively. YouTube/Vimeo show a privacy facade: nothing loads from them until the visitor presses play.",
  "contactForm.provider": "Netlify: zero-config when hosted on Netlify. Formspree/Web3Forms: work on ANY host with your free account key. Mailto: no backend at all — opens the visitor's email app.",
};

/** The block types whose dedicated editors take precedence over the generic form. */
export const DEDICATED_EDITORS: ReadonlySet<string> = new Set(["pillNav"]);

/** Convenience for tests + the Inspector: does this block get a generated form? */
export function hasGeneratedForm(block: Block): boolean {
  return !DEDICATED_EDITORS.has(block.type) && fieldsForBlockType(block.type) !== null;
}
