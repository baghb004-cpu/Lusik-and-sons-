// ============================================================
// /.netlify/functions/avatar-get
// ============================================================
// GET ?key=<blob-key> -> streams the avatar bytes back.
//
// Public (no auth) — avatar URLs are meant to be embeddable in
// <img src>. The key includes a random nonce (see avatar.mjs) so
// learning a user_id alone is not enough to guess valid keys.
// ============================================================

import { getStore } from "@netlify/blobs";
import { json }     from "./_lib/json.mjs";

const STORE_NAME = "profile-photos";

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return json(400, { error: "Missing key" });

  // Shape gate before the blob lookup. Avatar keys are produced by
  // avatar.mjs as `<uuid>/avatar-<ts>-<nonce>.<ext>` — anything else
  // can't be a real key, and rejecting cheaply prevents attacker-
  // controlled segments (".." etc.) from reaching the blob store.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar-[0-9a-f-]+\.(png|jpe?g|webp)$/i.test(key)) {
    return json(400, { error: "Malformed key" });
  }

  const store = getStore({ name: STORE_NAME });
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return json(404, { error: "Not found" });

  const contentType = result.metadata?.contentType ?? "application/octet-stream";
  return new Response(result.data, {
    status: 200,
    headers: {
      "Content-Type":          contentType,
      "Cache-Control":         "public, max-age=3600",
      // Browser must honor the declared Content-Type — defense
      // against a future upload path that accepts a wider type set.
      "X-Content-Type-Options": "nosniff",
    },
  });
};
