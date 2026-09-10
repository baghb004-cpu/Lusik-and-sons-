// ============================================================
// milestones — the shape of "while she stitches"
// ============================================================
// The six steps a piece goes through, in the order Lusik works them,
// with the words the customer reads. The timeline renders every step,
// including ones that have not happened yet, so someone waiting can see
// what is still ahead rather than just what is done.
//
// Plain JS so the Node unit test can import it and check that this list
// and the server's CHECK constraint never drift apart.
// ============================================================

export const MILESTONE_STEPS = Object.freeze([
  { key: "received",  label: "Order received",  blurb: "Your order is in Lusik's book." },
  { key: "cloth_cut", label: "Cloth cut",       blurb: "The fabric is measured and cut." },
  { key: "stitching", label: "Stitching",       blurb: "The thread is going in, one stitch at a time." },
  { key: "backing",   label: "Backing",         blurb: "The satin backing and the edging go on." },
  { key: "finished",  label: "Finished",        blurb: "Lusik checks the piece and photographs it." },
  { key: "shipped",   label: "Shipped",         blurb: "On its way to you." },
]);

export const MILESTONE_KEYS = Object.freeze(MILESTONE_STEPS.map((s) => s.key));

/**
 * Fold the rows from /order-milestones into the fixed step list.
 * Later rows win, so a corrected milestone (appended, never edited)
 * shows its newest note and photo.
 *
 * @returns {Array<{key,label,blurb,done:boolean,at:string|null,note:string|null,photoKey:string|null}>}
 */
export function buildTimeline(rows) {
  const latest = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !MILESTONE_KEYS.includes(r.milestone)) continue;
    latest.set(r.milestone, r);
  }
  return MILESTONE_STEPS.map((step) => {
    const hit = latest.get(step.key);
    return {
      ...step,
      done: !!hit,
      at: hit?.at ?? null,
      note: hit?.note ?? null,
      photoKey: hit?.photoKey ?? null,
    };
  });
}

/** The furthest step reached, or null when nothing has happened yet. */
export function currentStep(rows) {
  const timeline = buildTimeline(rows);
  let found = null;
  for (const step of timeline) if (step.done) found = step;
  return found;
}
