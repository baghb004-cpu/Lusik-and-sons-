import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JOURNAL_POSTS } from "../../../src/data/journalPosts.js";
import { pageMetadata, postJsonLd, jsonLdScript } from "../../../src/lib/seo.js";
import { JournalRoute } from "../../../src/routes/JournalRoute.jsx";

type Params = { slug: string };

// Prerender every journal post (SSG) so each indexes as its own page with a
// BlogPosting JSON-LD + SSR <head>.
export function generateStaticParams(): Params[] {
  return (JOURNAL_POSTS as any[]).map((p) => ({ slug: p.slug }));
}

// Next 15: `params` is async and must be awaited.
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = (JOURNAL_POSTS as any[]).find((p) => p.slug === slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.excerpt || "",
    path: `/journal/${post.slug}`,
    type: "article",
  });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = (JOURNAL_POSTS as any[]).find((p) => p.slug === slug);
  if (!post) notFound();
  return (
    <>
      <script {...jsonLdScript(postJsonLd(post))} />
      <JournalRoute />
    </>
  );
}
