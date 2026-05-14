// ============================================================
// /.netlify/functions/avatar
// ============================================================
// POST body: { filename, contentType, dataBase64 }
//   -> stores the file in Netlify Blobs and returns a public URL.
//
// Replaces Supabase Storage's `profile-photos` bucket. The browser
// sends the file as base64 to keep the request shape simple (avoids
// multipart parsing in the Function); we cap at the same 2 MB the
// old upload path enforced.
//
// The stored URL is written back to profiles.avatar_url by a
// separate PUT to /profile, mirroring the old two-step flow.
// ============================================================

import { getStore }    from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { requireUser } from "./_lib/auth.mjs";
import { sniffImageType } from "./_lib/image-sniff.mjs";
import { json }        from "./_lib/json.mjs";

const MAX_BYTES        = 2 * 1024 * 1024;
const ALLOWED_TYPES    = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTS     = new Set(["png", "jpg", "jpeg", "webp"]);
const STORE_NAME       = "profile-photos";

export default async (req, context) => {
  const auth = requireUser(context);
  if (auth.response) return auth.response;
  const { user } = auth;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const body = await req.json().catch(() => ({}));
  const { filename, contentType, dataBase64 } = body;

  if (!filename || !contentType || !dataBase64) {
    return json(400, { error: "Need filename, contentType, dataBase64" });
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    return json(415, { error: "Unsupported image type" });
  }
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return json(400, { error: "Unsupported file extension" });
  }

  // Decode + size-check before writing. The base64 payload is ~33% larger
  // than the bytes it represents; cap on the decoded size, not the string.
  let bytes;
  try {
    bytes = Buffer.from(dataBase64, "base64");
  } catch (e) {
    return json(400, { error: "Invalid base64" });
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return json(413, { error: `Image must be 1 byte – ${MAX_BYTES} bytes` });
  }

  // Magic-byte sniff. The browser-supplied `contentType` is a hint
  // only; an attacker can label HTML or JS as `image/png` and serve
  // it through avatar-get to confuse downstream consumers that don't
  // honor nosniff. Reject when the leading bytes don't match the
  // claimed type. (X-Content-Type-Options: nosniff is set on the
  // response, but defense-in-depth is cheap.)
  const sniffed = sniffImageType(bytes);
  if (!sniffed || sniffed !== contentType) {
    return json(415, { error: "Image content doesn't match declared type" });
  }

  // Path: <user_id>/avatar-<ts>-<nonce>.<ext>. The random nonce
  // makes the key unguessable even if an attacker learns the
  // user_id — avatar-get is public-by-design (so <img src> works
  // without an auth header), so we rely on the key being a
  // capability that only the owner ever sees.
  const nonce = randomBytes(8).toString("hex");
  const key = `${user.id}/avatar-${Date.now()}-${nonce}.${ext}`;
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  await store.set(key, bytes, {
    metadata: { contentType, uploadedAt: new Date().toISOString(), userId: user.id },
  });

  // Public URL pattern. Netlify Blobs are served at this path when
  // accessed through a Function, but for direct browser display we expose
  // a dedicated read-only Function (see avatar-get.mjs). Return the
  // canonical URL the UI should use.
  const url = `/.netlify/functions/avatar-get?key=${encodeURIComponent(key)}`;
  return json(201, { url, key });
};
