// ============================================================
// /.netlify/functions/embroidery-order
// ============================================================
// POST — the /embroidery order desk's submit endpoint.
//
// Accepts the design the customer configured (product, placement,
// text, thread/fabric) plus the machine-ready .pes file the
// browser-side stitch engine generated, stamps an order reference,
// and emails everything to Lusik through Resend (the .pes rides
// along as an attachment). Email is the system of record for these
// vendor orders — no DB row; the Tuxedos Online arrangement is
// invoiced off the emails.
//
// Public (no auth): Gohar/Vrej use it signed out, and quote
// requests are open by design. Abuse posture mirrors waitlist.mjs:
//   - honeypot field absorbs dumb bots,
//   - per-IP daily rate limit (blob-backed, fail-closed),
//   - Origin allowlist (same-origin pages only),
//   - every string bounded, the .pes size-capped and magic-checked
//     so the attachment is at most a small, well-formed PES file.
//
// The .pes is OPTIONAL: an old browser (no canvas/getImageData)
// still submits a complete parameter set and the email says
// "digitize manually" — never block the order on the engine.
// ============================================================

import { json } from "./_lib/json.mjs";
import { ipFromRequest, checkRateLimit } from "./_lib/rate-limit.mjs";
import { isAllowedOrigin } from "./_lib/origin.mjs";
import { sendEmbroideryOrderEmail } from "./_lib/email.mjs";

const HONEYPOT_FIELD = "bot-field";

// Generous for a two-person order desk placing a day's batch;
// tight enough that a bot can't burn the Resend daily quota
// (100/day free tier) from one network.
const MAX_ORDERS_PER_IP_PER_DAY = 40;

// A lettering .pes is a few KB; the biggest legitimate design
// (dense fill on a 340mm showpiece panel) stays well under this.
// Caps what an attacker can relay through our mailbox.
const MAX_PES_BASE64_CHARS = 900_000; // ~660 KB decoded

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);

export default async (req, context) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return json(403, { error: "Bad origin" });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.[HONEYPOT_FIELD]) {
    return json(200, { ok: true, ref: "EMB-OK" }); // bot moves on
  }

  // Fail-closed on a missing IP (checkRateLimit denies null ip), but
  // fail-OPEN if the blob store itself is down: the email is the order
  // here, and a Blobs outage shouldn't turn away Gohar's real batch.
  // Worst case during such an outage, the Resend daily quota is the cap.
  const ip = ipFromRequest(req, context);
  try {
    const rate = await checkRateLimit({ bucket: "embroidery", ip, limit: MAX_ORDERS_PER_IP_PER_DAY });
    if (!rate.ok) {
      return json(429, { error: "Too many orders from this network today. Call or email us instead." });
    }
  } catch (err) {
    console.warn("[embroidery-order] rate-limit store unavailable, allowing:", err?.message ?? err);
  }

  // ---- validate + bound every field ----
  const account = body?.account === "company" ? "company" : "public";

  const textStitched = str(body?.design?.text, 120);
  const productName = str(body?.product?.name, 200);
  const panelLabel = str(body?.panel?.label, 80);
  const areaW = num(body?.panel?.area_mm?.[0], 10, 500);
  const areaH = num(body?.panel?.area_mm?.[1], 10, 500);
  if (!textStitched || !productName || !panelLabel || areaW === null || areaH === null) {
    return json(400, { error: "Missing design details. Go back and re-check the order." });
  }

  const HEX = /^#[0-9a-f]{6}$/i;
  const threadHex = HEX.test(body?.threadHex ?? "") ? body.threadHex.toLowerCase() : "#1f2f6b";
  const fabricHex = HEX.test(body?.fabricHex ?? "") ? body.fabricHex.toLowerCase() : "#f4f2ec";

  const contactEmail = str(body?.contact?.email, 200);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return json(400, { error: "Please enter a valid email address." });
  }
  // Quote requests are only actionable with a way to reply.
  if (account === "public" && !contactEmail) {
    return json(400, { error: "Please include an email so Lusik can send your quote." });
  }

  // ---- the optional .pes attachment ----
  let pesBase64 = null;
  let stats = null;
  const rawPes = body?.pes;
  if (rawPes && typeof rawPes.base64 === "string") {
    const b64 = rawPes.base64;
    if (b64.length <= MAX_PES_BASE64_CHARS && /^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
      let head = "";
      try {
        head = Buffer.from(b64.slice(0, 12), "base64").toString("latin1");
      } catch { /* fall through — treated as absent */ }
      if (head.startsWith("#PES")) {
        pesBase64 = b64;
        stats = {
          stitchCount: num(rawPes.stitchCount, 0, 1_000_000) ?? 0,
          jumps: num(rawPes.jumps, 0, 100_000) ?? 0,
          widthMm: num(rawPes.widthMm * 10, 0, 10_000) / 10,
          heightMm: num(rawPes.heightMm * 10, 0, 10_000) / 10,
        };
      }
    }
  }

  // Server-stamped reference — authoritative, unlike the demo's
  // per-browser localStorage counter. Date + 4 random hex chars is
  // collision-safe at this volume and reads well on an invoice.
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = [...crypto.getRandomValues(new Uint8Array(2))]
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const ref = `EMB-${day}-${rand}`;

  const order = {
    ref,
    account,
    contact: {
      name: str(body?.contact?.name, 120),
      email: contactEmail,
      phone: str(body?.contact?.phone, 40),
    },
    productName,
    panelLabel,
    areaMm: [areaW, areaH],
    modeLine: str(body?.design?.modeLine, 200) || "name",
    textStitched,
    threadHex,
    threadName: str(body?.threadName, 40) || threadHex,
    fabricHex,
    fabricName: str(body?.fabricName, 40) || fabricHex,
    notes: str(body?.notes, 1000),
    stats,
  };

  const sent = await sendEmbroideryOrderEmail({ order, pesBase64 }).catch(() => false);
  if (!sent) {
    // Unlike the storefront emails (best-effort after a DB write),
    // the email IS the order here — surface the failure honestly
    // so the customer calls instead of assuming Lusik knows.
    return json(502, { error: "The order couldn't be delivered right now. Please call or email us directly." });
  }

  return json(200, { ok: true, ref });
};
