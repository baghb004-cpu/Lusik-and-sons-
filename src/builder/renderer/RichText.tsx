// ============================================================
// Renderer — rich text JSON → React
// ============================================================
// The ONLY way stored rich text becomes markup. There is no
// dangerouslySetInnerHTML anywhere in the renderer: documents
// are structured nodes (schema-validated, hrefs/srcs already
// constrained), serialized to real React elements here. External
// links get rel hardening; everything else is plain elements
// styled with the site's type idiom.
// ============================================================

import type { CSSProperties, ReactNode } from "react";
import type { RichTextDoc, RichTextNode } from "../schema/index.ts";

function alignStyle(attrs?: Record<string, unknown>): CSSProperties | undefined {
  const ta = attrs?.textAlign;
  return ta === "center" || ta === "right" || ta === "left" ? { textAlign: ta } : undefined;
}

function renderMarks(text: ReactNode, marks: NonNullable<RichTextNode["marks"]>, key: number): ReactNode {
  let out = text;
  for (const mark of marks) {
    if (mark.type === "bold") out = <strong key={key}>{out}</strong>;
    else if (mark.type === "italic") out = <em key={key}>{out}</em>;
    else if (mark.type === "underline") out = <span key={key} className="underline">{out}</span>;
    else if (mark.type === "link" && mark.attrs?.href) {
      const href = mark.attrs.href;
      const external = /^https?:\/\//i.test(href);
      out = (
        <a
          key={key}
          href={href}
          className="underline decoration-accent/60 underline-offset-2 hover:text-accent"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {out}
        </a>
      );
    }
  }
  return out;
}

const HEADING_CLASS: Record<number, string> = {
  1: "font-display text-3xl md:text-4xl",
  2: "font-display text-2xl md:text-3xl",
  3: "font-display text-xl md:text-2xl",
  4: "font-display text-lg",
};

function renderNode(node: RichTextNode, key: number): ReactNode {
  const children = node.content?.map(renderNode) ?? null;
  switch (node.type) {
    case "text":
      return node.marks?.length ? renderMarks(node.text, node.marks, key) : node.text;
    case "paragraph":
      return (
        <p key={key} className="leading-relaxed" style={alignStyle(node.attrs)}>
          {children}
        </p>
      );
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (`h${Math.min(Math.max(level + 1, 2), 5)}`) as "h2" | "h3" | "h4" | "h5";
      return (
        <Tag key={key} className={HEADING_CLASS[level] ?? HEADING_CLASS[2]} style={alignStyle(node.attrs)}>
          {children}
        </Tag>
      );
    }
    case "bulletList":
      return <ul key={key} className="list-disc pl-6 space-y-1">{children}</ul>;
    case "orderedList":
      return <ol key={key} className="list-decimal pl-6 space-y-1">{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-2 border-accent/50 pl-4 italic text-muted">
          {children}
        </blockquote>
      );
    case "image":
      return (
        <figure key={key} className="my-4">
          <img
            src={String(node.attrs?.src ?? "")}
            alt={String(node.attrs?.alt ?? "")}
            loading="lazy"
            className="rounded-lg max-w-full"
          />
          {node.attrs?.caption ? (
            <figcaption className="mt-1 text-sm text-muted">{String(node.attrs.caption)}</figcaption>
          ) : null}
        </figure>
      );
    default:
      return null; // unknown node types render nothing, never raw content
  }
}

export function RichText({ doc }: { doc: RichTextDoc }) {
  return <div className="space-y-3 font-body">{doc.content.map(renderNode)}</div>;
}
