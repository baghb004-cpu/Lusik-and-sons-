// Small-business blocks (plan §22): contactForm, video, socialRow,
// hoursTable, mapLink — provider/id gates and the video privacy facade.
import { test } from "node:test";
import assert from "node:assert/strict";

import { blockSchema, SOCIAL_PLATFORMS } from "../schema/index.ts";
import { videoFacadeScript, videoEmbedUrl, videoWatchUrl, videoDomId } from "../renderer/videoScript.ts";

const ok = (type: string, props: unknown) => blockSchema.safeParse({ id: "b_test00000001", type, props });

test("contactForm: each provider demands its own credential shape; action is never free-form", () => {
  assert.equal(ok("contactForm", { provider: "netlify" }).success, true); // zero-config on Netlify
  assert.equal(ok("contactForm", { provider: "mailto", endpoint: "lusik@example.com" }).success, true);
  assert.equal(ok("contactForm", { provider: "mailto", endpoint: "not-an-email" }).success, false);
  assert.equal(ok("contactForm", { provider: "formspree", endpoint: "https://formspree.io/f/xyzabc" }).success, true);
  // an attacker-chosen action URL refuses — only formspree.io passes
  assert.equal(ok("contactForm", { provider: "formspree", endpoint: "https://evil.example/steal" }).success, false);
  assert.equal(ok("contactForm", { provider: "formspree", endpoint: "javascript:alert(1)" }).success, false);
  assert.equal(ok("contactForm", { provider: "web3forms", endpoint: "abcd1234-ef56-7890-abcd-ef1234567890" }).success, true);
  assert.equal(ok("contactForm", { provider: "web3forms", endpoint: "short" }).success, false);
});

test("video: per-provider id gates; local files must be site-relative video paths", () => {
  assert.equal(ok("video", { kind: "youtube", src: "dQw4w9WgXcQ" }).success, true);
  assert.equal(ok("video", { kind: "youtube", src: "https://youtube.com/watch?v=x" }).success, false); // id, not URL
  assert.equal(ok("video", { kind: "vimeo", src: "123456789" }).success, true);
  assert.equal(ok("video", { kind: "vimeo", src: "abc" }).success, false);
  assert.equal(ok("video", { kind: "file", src: "/video/workshop.mp4" }).success, true);
  assert.equal(ok("video", { kind: "file", src: "https://cdn.example/x.mp4" }).success, false); // local only
  assert.equal(ok("video", { kind: "file", src: "//evil.example/x.mp4" }).success, false);
});

test("video facade: zero-JS path is a real link; the script upgrades to a privacy embed", () => {
  assert.equal(videoWatchUrl("youtube", "dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl("youtube", "dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
  assert.match(videoEmbedUrl("vimeo", "12345678"), /player\.vimeo\.com.*dnt=1/);
  const js = videoFacadeScript("b_vid00000001", "youtube", "dQw4w9WgXcQ");
  assert.ok(js.includes(`getElementById("${videoDomId("b_vid00000001")}")`));
  assert.match(js, /youtube-nocookie\.com/);
  assert.match(js, /preventDefault/); // the click stays on-page once JS runs
  assert.ok(!/\beval\(|new Function/.test(js));
});

test("socialRow / hoursTable / mapLink: shapes hold, hrefs stay safe", () => {
  assert.equal(ok("socialRow", { links: [{ platform: "instagram", href: "https://instagram.com/x" }] }).success, true);
  assert.equal(ok("socialRow", { links: [{ platform: "myspace", href: "https://x.com" }] }).success, false);
  assert.equal(ok("socialRow", { links: [{ platform: "x", href: "javascript:alert(1)" }] }).success, false);
  assert.equal(ok("socialRow", { links: [] }).success, false);
  assert.equal(SOCIAL_PLATFORMS.length, 9);

  assert.equal(ok("hoursTable", { rows: [{ days: "Mon–Fri", hours: "9–5" }] }).success, true);
  assert.equal(ok("hoursTable", { rows: [] }).success, false);
  assert.equal(
    ok("hoursTable", { rows: [{ days: { _i18n: { en: "Mon–Fri", hy: "Երկ–Ուրբ" } }, hours: "9–5" }] }).success,
    true // translatable day labels
  );

  assert.equal(ok("mapLink", { address: "7872 Western Ave, Buena Park, CA" }).success, true);
  assert.equal(ok("mapLink", {}).success, false);
});
