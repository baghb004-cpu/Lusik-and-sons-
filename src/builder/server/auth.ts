// ============================================================
// Builder server auth — who may read/write documents
// ============================================================
// Mirrors the proven netlify/functions/_lib/auth.mjs posture
// (verify against the Identity issuer, never decode-and-trust),
// reimplemented here because Next API routes can't import from
// the separate functions package. Two accepted credentials:
//
//   1. Netlify Identity admin — Authorization: Bearer <Identity
//      JWT>, verified against GoTrue's /user endpoint; the
//      account must carry the "admin" role or be in ADMIN_EMAILS.
//      (Hosted mode, and self-hosted GoTrue later.)
//   2. Local access token — Bearer <BUILDER_LOCAL_TOKEN> when
//      that env var is set. Thumb-drive / home-server mode where
//      no Identity service exists. Compared in constant time.
//      NEVER set this on the hosted site.
//
// Fails closed on any error. `fetchImpl` injectable for tests.
// ============================================================

import { timingSafeEqual } from "node:crypto";

const VERIFY_TIMEOUT_MS = 5000;

export interface BuilderAuthResult {
  ok: boolean;
  who?: string;
  response?: Response;
}

function deny(status: number, error: string): BuilderAuthResult {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  };
}

function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function identityBaseUrl(env: NodeJS.ProcessEnv): string | null {
  if (env.BUILDER_IDENTITY_URL) return env.BUILDER_IDENTITY_URL;
  const site = env.URL || env.DEPLOY_PRIME_URL;
  return site ? `${site.replace(/\/$/, "")}/.netlify/identity` : null;
}

function isAdminUser(
  user: { email?: string; app_metadata?: { roles?: unknown } },
  env: NodeJS.ProcessEnv
): boolean {
  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  if (roles.some((r) => String(r).toLowerCase() === "admin")) return true;
  const adminEmails = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = String(user.email || "").toLowerCase();
  return !!email && adminEmails.includes(email);
}

export async function requireBuilderAdmin(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<BuilderAuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return deny(401, "Sign in required");
  const token = m[1].trim();

  // Path 1: local access token (thumb-drive / home-server mode).
  const localToken = env.BUILDER_LOCAL_TOKEN;
  if (localToken && localToken.length >= 16 && constantTimeMatch(token, localToken)) {
    return { ok: true, who: "local-operator" };
  }

  // Path 2: verify the bearer token against the Identity issuer.
  const base = identityBaseUrl(env);
  if (!base) return deny(401, "No identity issuer configured");

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${base}/user`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal,
    });
    if (!res.ok) return deny(401, "Invalid or expired session");
    const user = (await res.json()) as { id?: string; email?: string; app_metadata?: { roles?: unknown } };
    if (!user?.id) return deny(401, "Invalid or expired session");
    if (!isAdminUser(user, env)) return deny(403, "Admin access required");
    return { ok: true, who: user.email || user.id };
  } catch {
    return deny(401, "Could not verify session"); // network error/timeout → fail closed
  } finally {
    clearTimeout(timer);
  }
}
