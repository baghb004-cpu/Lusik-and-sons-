// ============================================================
// Builder schema — rich text (safety-critical)
// ============================================================
// Rich text is stored as a structured ProseMirror-style JSON
// document, NEVER as an HTML string. Rendering goes through our
// own React serializer, so script injection is structurally
// impossible — but we still validate the two attack surfaces a
// document can carry (link hrefs and image srcs) at the schema
// boundary, so unsafe values can't even be SAVED.
// ============================================================

import { z } from "zod";

// Site-relative ("/x" but not protocol-relative "//host"), https/http,
// or the contact schemes the site already uses. `javascript:` and
// friends fail the regex by construction.
export const SAFE_HREF_RE = /^(?:https?:\/\/|mailto:|tel:|sms:|\/(?!\/))/i;
export const safeHref = z.string().min(1).regex(SAFE_HREF_RE);

// Images: the site's photo tree, the (future) upload store, or https.
export const SAFE_IMAGE_SRC_RE = /^(?:\/img\/|\/uploads\/|https:\/\/)/;
export const imageSrc = z.string().min(1).regex(SAFE_IMAGE_SRC_RE);

const textAlign = z.enum(["left", "center", "right"]);

const markSchema = z.union([
  z.object({ type: z.enum(["bold", "italic", "underline"]) }).strict(),
  z.object({ type: z.literal("link"), attrs: z.object({ href: safeHref }).strict() }).strict(),
]);

export interface RichTextNode {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: { href: string } }>;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
}

const textNode = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    marks: z.array(markSchema).optional(),
  })
  .strict();

// Recursive node set. Kept deliberately small (Word/Docs basics);
// growing it is additive and versioned via the document schemaVersion.
export const richTextNode: z.ZodType<RichTextNode> = z.lazy(() =>
  z.union([
    textNode,
    z
      .object({
        type: z.literal("paragraph"),
        attrs: z.object({ textAlign: textAlign.optional() }).strict().optional(),
        content: z.array(richTextNode).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("heading"),
        attrs: z
          .object({
            level: z.number().int().min(1).max(4),
            textAlign: textAlign.optional(),
          })
          .strict(),
        content: z.array(richTextNode).optional(),
      })
      .strict(),
    z
      .object({
        type: z.enum(["bulletList", "orderedList", "blockquote", "listItem"]),
        content: z.array(richTextNode).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("image"),
        attrs: z
          .object({
            src: imageSrc,
            alt: z.string(),
            caption: z.string().optional(),
          })
          .strict(),
      })
      .strict(),
  ])
);

export const richTextDoc = z
  .object({
    type: z.literal("doc"),
    content: z.array(richTextNode),
  })
  .strict();

export type RichTextDoc = z.infer<typeof richTextDoc>;

/** Convenience for fixtures/tests: a one-paragraph document. */
export function textDoc(text: string): RichTextDoc {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}
