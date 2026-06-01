"use client";

import { useParams } from "next/navigation";
import { useSiteNav } from "../state/useSiteNav.js";

// SSR: direct import (was dynamic({ ssr:false })) so the server renders the
// real journal/gallery content in the initial HTML. JournalView is SSR-safe — its
// slug comes from a prop and all window/document access is in effects.
import { JournalView } from "../components/JournalView.jsx";

// `/journal` (list) and `/journal/[slug]` (post) — JournalView switches on slug.
export function JournalRoute() {
  const nav = useSiteNav();
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : null;
  return (
    <JournalView
      slug={slug}
      onSelectPost={nav.goJournalPost}
      onBack={slug ? nav.goJournal : nav.goForYou}
    />
  );
}

export default JournalRoute;
