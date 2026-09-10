"use client";

// ============================================================
// ReviewRoute — the /review/<token> shell
// ============================================================
// Same shape as the order-follow route: the token is the path segment,
// the order id is the query, and the Function checks both. Nothing here
// decides anything.
// ============================================================

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ReviewForm } from "../components/ReviewForm.jsx";

export function ReviewRoute() {
  const params = useParams();
  const search = useSearchParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const orderId = search?.get("id") || "";
  return <ReviewForm orderId={orderId} token={token} />;
}

export default ReviewRoute;
