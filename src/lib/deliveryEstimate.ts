// Delivery estimate — concrete ship-by / arrives-by date range
// rendered on the PDP under the Add-to-cart button. Production
// lead time matches the FAQ (5–10 business days); transit time
// is the typical USPS/UPS/FedEx ground range. We skip weekends;
// federal holidays aren't modeled — the range is wide enough
// that one-day shifts around Thanksgiving / Christmas wash out.

const PRODUCTION_MIN_BIZ_DAYS = 5;
const PRODUCTION_MAX_BIZ_DAYS = 10;
const TRANSIT_MIN_BIZ_DAYS = 3;
const TRANSIT_MAX_BIZ_DAYS = 5;

function addBusinessDays(date: Date, n: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

function fmtMonthDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface DeliveryEstimate {
  shipBy: string;
  arrives: string;
}

export function getDeliveryEstimate(today: Date = new Date()): DeliveryEstimate {
  const shipMin = addBusinessDays(today, PRODUCTION_MIN_BIZ_DAYS);
  const shipMax = addBusinessDays(today, PRODUCTION_MAX_BIZ_DAYS);
  const arriveMin = addBusinessDays(shipMin, TRANSIT_MIN_BIZ_DAYS);
  const arriveMax = addBusinessDays(shipMax, TRANSIT_MAX_BIZ_DAYS);
  return {
    shipBy: `${fmtMonthDay(shipMin)} – ${fmtMonthDay(shipMax)}`,
    arrives: `${fmtMonthDay(arriveMin)} – ${fmtMonthDay(arriveMax)}`,
  };
}
