// ============================================================
// useLeadTime — the real "when will this arrive?" for a product
// ============================================================
// Combines the product's own build time (CONFIG.LEAD_TIMES.WEEKS, via
// src/lib/leadTime.js) with the live queue buffer from the /lead-time
// Function, and re-renders once the queue lands.
//
// The queue is fetched once per page and cached for the session: it
// moves when an order is placed or ships, and a few minutes of
// staleness cannot shift a multi-week quote by more than a day. On any
// failure the buffer stays 0 and the customer still sees the product's
// own timing, never a broken or missing promise.
// ============================================================
import { useEffect, useState } from "react";
import { db } from "./db.js";
import { getLeadTime, weeksFor, weeksLabel } from "./leadTime.js";

let cachedQueueDays: number | null = null;
let inFlight: Promise<number> | null = null;

async function loadQueueDays(): Promise<number> {
  if (cachedQueueDays !== null) return cachedQueueDays;
  if (!inFlight) {
    // db.call() returns a union (payload or an {error} envelope), so read
    // the field defensively rather than asserting a shape.
    inFlight = db
      .getLeadTime()
      .then((r: unknown) => {
        const d = Number((r as { queueDays?: unknown } | null)?.queueDays);
        cachedQueueDays = Number.isFinite(d) && d > 0 ? Math.floor(d) : 0;
        return cachedQueueDays;
      })
      .catch(() => {
        cachedQueueDays = 0;
        return 0;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

export interface LeadTimeView {
  weeks: [number, number];
  /** "about 4 to 6 weeks" — safe to render on the server; never goes stale. */
  weeksText: string;
  /** False during the server render and the first client render. */
  ready: boolean;
  queueDays: number;
  startBy: string;
  shipBy: string;
  arrives: string;
}

export function useLeadTime(productKey: string): LeadTimeView {
  // Start with the queue we already know about (0 on a cold page) so the
  // server render and the first client render agree.
  const [queueDays, setQueueDays] = useState<number>(cachedQueueDays ?? 0);
  // Concrete dates are CLIENT-ONLY on purpose. Product pages are prerendered
  // at build time (generateStaticParams, no revalidate), so a date computed
  // during that pass would be frozen at deploy and would disagree with the
  // visitor's own clock on hydration. Until mount we render the weeks range,
  // which is timeless and is exactly what the printed brochure says.
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    setToday(new Date());
    void loadQueueDays().then((d) => { if (alive && d !== queueDays) setQueueDays(d); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weeksText = weeksLabel(productKey);
  if (!today) {
    return {
      weeks: weeksFor(productKey) as [number, number],
      weeksText, ready: false, queueDays: 0,
      startBy: "", shipBy: "", arrives: "",
    };
  }
  const dated = getLeadTime(productKey, { queueDays, today });
  return { ...dated, weeks: dated.weeks as [number, number], weeksText, ready: true };
}
