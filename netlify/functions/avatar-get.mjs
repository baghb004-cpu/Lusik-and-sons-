// ============================================================
// /.netlify/functions/avatar-get
// ============================================================
// GET ?key=<blob-key> -> streams the avatar bytes back.
//
// Public (no auth) — avatar URLs are meant to be embeddable in
// <img src>. Knowing the key is enough to view; the key is opaque
// and namespaced by user_id so it's not enumerable.
// ============================================================

import { getStore } from "@netlify/blobs";
import { json }     from "./_lib/json.mjs";

const STORE_NAME = "profile-photos";

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return json(400, { error: "Missing key" });

  const store = getStore({ name: STORE_NAME });
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return json(404, { error: "Not found" });

  const contentType = result.metadata?.contentType ?? "application/octet-stream";
  return new Response(result.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
};
