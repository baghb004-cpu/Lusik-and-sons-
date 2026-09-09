// ============================================================
// OrderTimeline — the six steps of a piece being made
// ============================================================
// Rendered on a customer's order card and on the guest order page. Every
// step is listed, done or not, so someone waiting can see what is still
// ahead instead of only what has happened.
//
// Steps Lusik has marked carry her note and, where she added one, the
// photo she took. Nothing here is interactive; it is a status read.
// ============================================================
import React from "react";
import { buildTimeline } from "../lib/milestones.js";

function fmt(at) {
  if (!at) return "";
  try {
    return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function OrderTimeline({ rows, className = "" }) {
  const steps = buildTimeline(rows);
  const lastDone = steps.reduce((acc, s, i) => (s.done ? i : acc), -1);

  return (
    <ol className={`flex flex-col ${className}`} style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {steps.map((step, i) => {
        const isNext = !step.done && i === lastDone + 1;
        return (
          <li key={step.key} className="flex gap-3" style={{ opacity: step.done ? 1 : isNext ? 0.75 : 0.45 }}>
            {/* rail: a filled dot for what is done, a hollow one for what is coming */}
            <div className="flex flex-col items-center" style={{ width: 14, flexShrink: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 10, height: 10, borderRadius: "50%", marginTop: 5,
                  background: step.done ? "var(--accent)" : "transparent",
                  border: `1.5px solid ${step.done ? "var(--accent)" : "var(--border-strong, #b9b0a3)"}`,
                }}
              />
              {i < steps.length - 1 && (
                <span aria-hidden="true" style={{ flex: 1, width: 1.5, minHeight: 22, background: "var(--border-soft, #e3dbcb)" }} />
              )}
            </div>

            <div className="pb-4" style={{ flex: 1 }}>
              <p className="text-sm leading-tight" style={{ fontWeight: step.done ? 600 : 500, color: "var(--text-primary)" }}>
                {step.label}
                {step.at && <span className="ml-2 text-xs" style={{ fontWeight: 400, opacity: 0.6 }}>{fmt(step.at)}</span>}
              </p>
              <p className="text-xs leading-relaxed mt-0.5" style={{ opacity: 0.75 }}>
                {step.note || step.blurb}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
