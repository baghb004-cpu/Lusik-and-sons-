// ============================================================
// Calendar engine (pure) — every format that matters, no deps
// ============================================================
// One event, three doors for the visitor:
//   - .ics as a data: link — the UNIVERSAL format (RFC 5545).
//     Tapping it on iPhone/iPad opens Apple Calendar, on Android
//     the native calendar, on desktop Outlook/Thunderbird/Apple
//     Calendar. Zero JS, zero server, works in static exports.
//   - Google Calendar prefill URL (for visitors who live there).
//   - Outlook.com prefill URL.
// Pure string builders — escaping per the RFC, fully unit-tested.

export interface CalendarEvent {
  title: string;
  /** ISO local datetimes, e.g. "2026-07-04T14:00" */
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  details?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-07-04T14:00" → "20260704T140000" (floating local time — the
 *  visitor's calendar shows the event at the venue's wall-clock time). */
export function icsStamp(iso: string, allDay = false): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return allDay ? date : `${date}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** RFC 5545 text escaping: backslash, semicolon, comma, newline. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildIcs(e: CalendarEvent, uidSeed = "workshop"): string {
  const end = e.end ?? e.start;
  const dt = e.allDay
    ? [`DTSTART;VALUE=DATE:${icsStamp(e.start, true)}`, `DTEND;VALUE=DATE:${icsStamp(end, true)}`]
    : [`DTSTART:${icsStamp(e.start)}`, `DTEND:${icsStamp(end)}`];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Baghdos Workshop//Builder//EN",
    "BEGIN:VEVENT",
    `UID:${uidSeed}-${icsStamp(e.start)}@builder.local`,
    `SUMMARY:${icsEscape(e.title)}`,
    ...dt,
    ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
    ...(e.details ? [`DESCRIPTION:${icsEscape(e.details)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** The zero-JS download link: works in static exports, opens native apps. */
export function icsDataHref(e: CalendarEvent, uidSeed?: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(e, uidSeed))}`;
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const fmt = (iso: string) => icsStamp(iso, e.allDay);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(e.end ?? e.start)}`,
    ...(e.location ? { location: e.location } : {}),
    ...(e.details ? { details: e.details } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.start,
    ...(e.end ? { enddt: e.end } : {}),
    ...(e.location ? { location: e.location } : {}),
    ...(e.details ? { body: e.details } : {}),
    ...(e.allDay ? { allday: "true" } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

/** Booking/scheduling presets (free or free-tier) with honest blurbs. */
export const BOOKING_PROVIDERS = [
  { id: "calendly", label: "Calendly", urlHint: "https://calendly.com/yourname/30min", blurb: "Free tier: one event type, unlimited bookings. Visitors pick a slot on your page." },
  { id: "cal-com", label: "Cal.com", urlHint: "https://cal.com/yourname", blurb: "Open-source scheduling; generous free plan, can even be self-hosted later." },
  { id: "custom", label: "Custom link", urlHint: "https://…", blurb: "Any scheduling service with a booking page URL — the button just links there." },
] as const;
