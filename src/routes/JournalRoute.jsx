"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useSiteNav } from "../state/useSiteNav.js";

const JournalView = dynamic(() => import("../components/JournalView.jsx").then((m) => m.JournalView), { ssr: false });

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
