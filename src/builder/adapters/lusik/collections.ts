// ============================================================
// Lusik CMS adapter — collection + field definitions
// ============================================================
// Declares the site's editable content surfaces (the JSON the
// existing generators compile) as form-renderable collections.
// These specs drive the editor's forms; the SAVE gate is the
// generators' own validators (server/validateDoc.ts), so a field
// listed here can never bypass a build rule — the spec is UX,
// the gate is law.
//
// Money rule made visible: priceFrom/trustedKey/status carry
// warnings in the UI, and a "live" save that disagrees with
// netlify/functions/_lib/trusted-products.mjs is rejected
// server-side by the same function that fails the build.
// ============================================================

export type FieldType =
  | "string"
  | "text" // multi-line
  | "number"
  | "boolean"
  | "select"
  | "image" // path string with image affordances (Phase 6 adds the picker)
  | "string[]"
  | "object[]"
  | "json"; // structured fallback — raw JSON sub-editor

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // select
  fields?: FieldSpec[]; // object[]
  help?: string;
  warning?: string; // money/safety-adjacent fields surface this prominently
}

export interface CollectionSpec {
  id: string;
  label: string;
  /** Directory of per-entry documents, or fixed single files. */
  dir?: string;
  files?: Array<{ path: string; label: string }>;
  fields: FieldSpec[];
  blurb: string;
}

const HY = (label: string): FieldSpec[] => [
  { name: `${label}_hy`, label: `${label} (Armenian)`, type: label === "description" ? "text" : "string", help: "Optional — shown when the guest switches to Հայերեն" },
];

export const LUSIK_COLLECTIONS: CollectionSpec[] = [
  {
    id: "products",
    label: "Products",
    dir: "content/products",
    blurb: "All eleven products. Live ones are price-locked to Stripe by the build gate.",
    fields: [
      { name: "name", label: "Name", type: "string", required: true },
      { name: "category", label: "Category", type: "select", required: true, options: ["blankets", "bibs", "towels", "baby"] },
      { name: "key", label: "Product key", type: "string", required: true, help: "Internal id — don't change after launch" },
      { name: "slug", label: "URL slug", type: "string", required: true, help: "lowercase-kebab-case; changing it breaks shared links" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: ["draft", "placeholder", "live"],
        warning: "“live” requires a matching trusted-products entry and an exact price match — the save will be rejected otherwise.",
      },
      {
        name: "priceFrom",
        label: "Displayed price ($)",
        type: "number",
        warning: "Display only — Stripe charges what netlify/functions/_lib/trusted-products.mjs says. For live products the two must match to the cent.",
      },
      {
        name: "trustedKey",
        label: "Trusted price key",
        type: "string",
        warning: "The server-side price entry that vouches for this product. Set by a developer alongside trusted-products.mjs.",
      },
      { name: "tagline", label: "Tagline", type: "string", required: true },
      { name: "description", label: "Description", type: "text" },
      ...HY("name"),
      ...HY("tagline"),
      ...HY("description"),
      { name: "coverImage", label: "Cover image", type: "image" },
      { name: "images", label: "Photos", type: "string[]", help: "Paths under /img/…" },
      {
        name: "details",
        label: "Details rows",
        type: "object[]",
        fields: [
          { name: "label", label: "Label", type: "string", required: true },
          { name: "value", label: "Value", type: "text", required: true },
        ],
      },
      { name: "colorways", label: "Colorways", type: "json", help: "Gallery color filter — label, photo indices, swatch. Structured editor lands in a later phase." },
      { name: "displayOrder", label: "Display order", type: "number", help: "Lower numbers list first" },
    ],
  },
  {
    id: "categories",
    label: "Categories",
    dir: "content/categories",
    blurb: "The four shop categories — cards, copy, ordering.",
    fields: [
      { name: "label", label: "Label", type: "string", required: true },
      { name: "slug", label: "URL slug", type: "string", required: true },
      { name: "description", label: "Description", type: "text", required: true },
      { name: "eyebrow", label: "Eyebrow", type: "string" },
      { name: "label_hy", label: "Label (Armenian)", type: "string" },
      { name: "eyebrow_hy", label: "Eyebrow (Armenian)", type: "string" },
      { name: "displayOrder", label: "Display order", type: "number" },
    ],
  },
  {
    id: "pages",
    label: "Page surfaces",
    files: [
      { path: "content/pages/announcement.json", label: "Announcement bar" },
      { path: "content/pages/home.json", label: "Home featured pick" },
      { path: "content/pages/faq.json", label: "FAQ" },
      { path: "content/pages/story.json", label: "Our Story" },
      { path: "content/pages/testimonials.json", label: "Testimonials" },
    ],
    blurb: "Site-wide editorial surfaces, each with its own build validator.",
    fields: [], // resolved per-file below
  },
];

/** Per-file field specs for the fixed page surfaces. */
export const PAGE_FIELDS: Record<string, FieldSpec[]> = {
  "content/pages/announcement.json": [
    { name: "enabled", label: "Show the bar", type: "boolean", help: "Off = renders nothing site-wide" },
    { name: "message", label: "Message", type: "string" },
    { name: "link", label: "Link (path or https URL)", type: "string" },
    { name: "linkLabel", label: "Link label", type: "string" },
  ],
  "content/pages/home.json": [
    {
      name: "featured",
      label: "Featured product",
      type: "json",
      help: '{ "category": "...", "slug": "..." } — must point at a LIVE product; the gate checks the real catalog.',
    },
  ],
  "content/pages/faq.json": [
    { name: "eyebrow", label: "Eyebrow", type: "string", required: true },
    { name: "title", label: "Title", type: "string", required: true },
    {
      name: "items",
      label: "Questions",
      type: "object[]",
      fields: [
        { name: "q", label: "Question", type: "string", required: true },
        { name: "a", label: "Answer", type: "text", required: true },
      ],
    },
  ],
  "content/pages/story.json": [
    { name: "eyebrow", label: "Eyebrow", type: "string", required: true },
    { name: "heading", label: "Heading", type: "string", required: true },
    { name: "paragraphs", label: "Paragraphs", type: "string[]", required: true },
    { name: "signature", label: "Signature", type: "string", required: true },
    { name: "signatureSub", label: "Signature subline", type: "string", required: true },
  ],
  "content/pages/testimonials.json": [
    { name: "eyebrow", label: "Eyebrow", type: "string", required: true },
    { name: "titlePre", label: "Title (before italics)", type: "string", required: true },
    { name: "titleEm", label: "Title (italic part)", type: "string", required: true },
    {
      name: "quotes",
      label: "Quotes (first three display)",
      type: "object[]",
      fields: [
        { name: "quote", label: "Quote", type: "text", required: true },
        { name: "name", label: "Name", type: "string", required: true },
        { name: "place", label: "Place", type: "string" },
      ],
    },
  ],
};

/** Resolve the field spec for any document path, or null if it's not a form-editable collection doc. */
export function fieldsForPath(path: string): FieldSpec[] | null {
  if (PAGE_FIELDS[path]) return PAGE_FIELDS[path];
  for (const c of LUSIK_COLLECTIONS) {
    if (c.dir && path.startsWith(c.dir + "/")) return c.fields;
  }
  return null;
}

/** Which collection a path belongs to (sidebar grouping). */
export function collectionForPath(path: string): CollectionSpec | null {
  for (const c of LUSIK_COLLECTIONS) {
    if (c.dir && path.startsWith(c.dir + "/")) return c;
    if (c.files?.some((f) => f.path === path)) return c;
  }
  return null;
}
