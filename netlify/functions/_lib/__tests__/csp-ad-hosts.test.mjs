// ============================================================
// The CSP must allow the tags we actually ship
// ============================================================
// Found by reading a Lighthouse report rather than the code: the home
// page logged "Connecting to 'https://ad.doubleclick.net/ccm/s/collect'
// violates the following Content Security Policy directive". The Google
// Ads tag was loading and then being blocked by our own header when it
// tried to report — the shop was paying for clicks it could not fully
// attribute, and nothing in the site's own behaviour showed it.
//
// `connect-src` listed `googleads.g.doubleclick.net` specifically while
// `frame-src` already allowed `*.doubleclick.net`, so the beacon host
// fell in the gap between the two.
//
// This test exists so the next tag change is checked against the header
// in the same commit. If an ad tag is REMOVED, delete its hosts here
// too, and update the Privacy Policy in the same change — the policy
// describing reality is the deal (see CLAUDE.md).
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");

/** Every CSP in the file, longest first — the site-wide one is the big one. */
function policies() {
  return [...toml.matchAll(/Content-Security-Policy\s*=\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .sort((a, b) => b.length - a.length);
}

function directive(csp, name) {
  const part = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name} `));
  return part ? part.slice(name.length + 1).trim().split(/\s+/) : [];
}

/** CSP host matching, including the one wildcard form it supports. */
function allowed(sources, host) {
  return sources.some((src) => {
    const bare = src.replace(/^https:\/\//, "");
    if (bare === host) return true;
    if (bare.startsWith("*.")) return host.endsWith(bare.slice(1));
    return false;
  });
}

// Hosts the shipped tags contact. Meta Pixel loads from connect.facebook.net
// and beacons to www.facebook.com; the Google Ads gtag loads from
// googletagmanager.com and beacons through googleadservices, google.com and
// the doubleclick hosts (ad.doubleclick.net is the collect endpoint).
const AD_CONNECT_HOSTS = [
  "connect.facebook.net",
  "www.facebook.com",
  "www.googletagmanager.com",
  "www.googleadservices.com",
  "ad.doubleclick.net",
  "googleads.g.doubleclick.net",
  "www.google.com",
];

test("the site CSP lets every shipped ad tag report", () => {
  const csp = policies()[0];
  const connect = directive(csp, "connect-src");
  assert.ok(connect.length > 0, "no connect-src in the site policy");
  for (const host of AD_CONNECT_HOSTS) {
    assert.ok(allowed(connect, host), `connect-src blocks ${host} — the tag will load and then fail to report`);
  }
});

test("the studio CSP is separate and does NOT carry the ad hosts", () => {
  // /studio is Lusik's editor. It has its own looser policy for Decap's
  // sake; widening it with ad hosts as well would be scope creep on the
  // one page that never needs them.
  const studio = policies().find((c) => c.includes("unpkg.com"));
  assert.ok(studio, "expected a scoped /studio policy");
  const connect = directive(studio, "connect-src");
  assert.ok(!allowed(connect, "ad.doubleclick.net"));
  assert.ok(!allowed(connect, "www.facebook.com"));
});

test("script-src still does not carry a doubleclick wildcard", () => {
  // Widening connect-src (a beacon) is not the same as widening
  // script-src (arbitrary code). Keep them apart.
  const csp = policies()[0];
  const script = directive(csp, "script-src");
  assert.ok(!script.some((s) => s.includes("doubleclick")), "script-src must not allow doubleclick");
});
