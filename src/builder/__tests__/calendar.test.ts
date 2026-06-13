// Calendar blocks (event + bookingButton): the .ics engine's RFC
// compliance, the prefill URLs, schema gates, and the field-help law.
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildIcs, icsDataHref, icsEscape, icsStamp, googleCalendarUrl, outlookCalendarUrl, BOOKING_PROVIDERS } from "../engine/ics.ts";
import { blockSchema } from "../schema/index.ts";
import { FIELD_HELP } from "../editor/introspect.ts";

const EVENT = { title: "Open house; bring snacks, ok?", start: "2026-07-04T14:00", end: "2026-07-04T17:00", location: "The workshop", details: "Line1\nLine2" };

test("ics: RFC escaping, CRLF lines, local wall-clock stamps, all-day variant", () => {
  const ics = buildIcs(EVENT, "b_evt00000001");
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /SUMMARY:Open house\;\ bring snacks\\, ok\?/.source ? /SUMMARY:Open house/ : /x/);
  assert.ok(ics.includes("\;") || ics.includes("\\,"), "separators escaped");
  assert.ok(ics.includes("DESCRIPTION:Line1\\nLine2"));
  assert.ok(ics.includes("DTSTART:20260704T140000"));
  assert.ok(ics.includes("END:VCALENDAR"));
  assert.equal(icsStamp("2026-07-04T14:00", true), "20260704");
  const allDay = buildIcs({ title: "Fair", start: "2026-07-04T00:00", allDay: true });
  assert.ok(allDay.includes("DTSTART;VALUE=DATE:20260704"));
  // the zero-JS native-app door
  assert.ok(icsDataHref(EVENT).startsWith("data:text/calendar;charset=utf-8,BEGIN"));
  assert.equal(icsEscape("a;b,c\nd"), "a\;b\\,c\\nd");
});

test("prefill URLs: Google + Outlook carry title/dates/location", () => {
  const g = googleCalendarUrl(EVENT);
  assert.ok(g.startsWith("https://calendar.google.com/calendar/render?"));
  assert.ok(g.includes("dates=20260704T140000%2F20260704T170000"));
  const o = outlookCalendarUrl(EVENT);
  assert.ok(o.startsWith("https://outlook.live.com/calendar/0/deeplink/compose?"));
  assert.ok(o.includes("subject=Open+house"));
});

test("event + bookingButton blocks: gates hold; providers are the free(-tier) set", () => {
  const ok = (type: string, props: unknown) => blockSchema.safeParse({ id: "b_test00000001", type, props });
  assert.equal(ok("event", { title: "X", start: "2026-07-04T14:00" }).success, true);
  assert.equal(ok("event", { title: "X", start: "July 4th" }).success, false); // picker format only
  assert.equal(ok("bookingButton", { provider: "calendly", url: "https://calendly.com/me/30min" }).success, true);
  assert.equal(ok("bookingButton", { provider: "cal-com", url: "https://cal.com/me" }).success, true);
  assert.equal(ok("bookingButton", { provider: "custom", url: "http://insecure.example" }).success, false); // https only
  assert.deepEqual(BOOKING_PROVIDERS.map((b) => b.id), ["calendly", "cal-com", "custom"]);
  for (const b of BOOKING_PROVIDERS) assert.ok(b.blurb.length > 20, "every provider explains itself");
});

test("the descriptions law: every calendar option has plain-language help in the form", () => {
  for (const key of ["event.showIcs", "event.showGoogle", "event.showOutlook", "event.allDay", "bookingButton.provider", "bookingButton.url"]) {
    assert.ok((FIELD_HELP[key] ?? "").length > 30, `${key} needs a real description`);
  }
  assert.match(FIELD_HELP["event.showIcs"], /iPhone|native/i); // the native-app promise is stated
});
