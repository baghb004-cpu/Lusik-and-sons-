"use client";

// ============================================================
// OrderFollowRoute — /order/<token>?id=<order id>
// ============================================================
// The page a guest reaches from the link in their confirmation email.
// Most people who order here never make an account, and they still want
// to know how the piece is coming along.
//
// The token is an HMAC of the order id, checked server-side by the
// /order-milestones Function, which returns the timeline and nothing
// else: no address, no email, no payment detail, and no way to write.
// A bad or stale link gets the same friendly "we couldn't find it"
// screen as an unknown id, with the phone number.
// ============================================================
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "../lib/db.js";
import { CONFIG } from "../data/config.js";
import { OrderTimeline } from "../components/OrderTimeline.jsx";

export function OrderFollowRoute() {
  const params = useParams();
  const search = useSearchParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const orderId = search?.get("id") || "";

  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let alive = true;
    if (!token || !orderId) { setState({ loading: false, data: null }); return; }
    db.getOrderMilestones(orderId, token)
      .then((data) => { if (alive) setState({ loading: false, data }); })
      .catch(() => { if (alive) setState({ loading: false, data: null }); });
    return () => { alive = false; };
  }, [token, orderId]);

  const phone = CONFIG.TEXT_US?.phone_display || "";
  const phoneHref = CONFIG.TEXT_US?.phone_e164 || "";

  return (
    <main className="max-w-2xl mx-auto px-6 lg:px-12 py-16 lg:py-24 fade-in">
      <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent)" }}>
        Lusik &amp; Sons
      </p>

      {state.loading && (
        <p className="text-sm opacity-70">Loading your order…</p>
      )}

      {!state.loading && !state.data && (
        <>
          <h1 className="font-display text-3xl lg:text-4xl mb-4" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            We couldn&apos;t find that order.
          </h1>
          <p className="text-sm leading-relaxed opacity-80 mb-6">
            The link may have been cut short by an email app, or it may belong to an order that has since been removed.
            Open it again from your confirmation email, or call and we will look it up for you.
          </p>
          {phone && (
            <a href={`tel:${phoneHref}`} className="underline text-sm" style={{ fontWeight: 500 }}>{phone}</a>
          )}
        </>
      )}

      {!state.loading && state.data && (
        <>
          <h1 className="font-display text-3xl lg:text-4xl mb-2" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            Your piece, step by step.
          </h1>
          <p className="text-sm opacity-70 mb-8">
            Order {state.data.orderNumber}
          </p>
          <OrderTimeline rows={state.data.milestones} />
          <p className="text-xs opacity-60 leading-relaxed mt-8">
            This page updates as Lusik works. Keep the link from your email to come back to it.
            {phone && <> Questions? Call or text <a href={`tel:${phoneHref}`} className="underline">{phone}</a>.</>}
          </p>
        </>
      )}
    </main>
  );
}
