import type { Metadata } from "next";
import { JOURNAL_POSTS } from "../../../src/data/journalPosts.js";
import { pageMetadata, postJsonLd, jsonLdScript } from "../../../src/lib/seo.js";
import { JournalRoute } from "../../../src/routes/JournalRoute.jsx";

type Params = { slug: string };

// Prerender every journal post (SSG) so each indexes as its own page with a
// BlogPosting JSON-LD + SSR <head>.
export function generateStaticParams(): Params[] {
  return (JOURNAL_POSTS as any[]).map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const post = (JOURNAL_POSTS as any[]).find((p) => p.slug === params.slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.excerpt || "",
    path: `/journal/${post.slug}`,
    type: "article",
  });
}

export default function Page({ params }: { params: Params }) {
  const post = (JOURNAL_POSTS as any[]).find((p) => p.slug === params.slug);
  return (
    <>
      {post && <script {...jsonLdScript(postJsonLd(post))} />}
      <JournalRoute />
    </>
  );
}
