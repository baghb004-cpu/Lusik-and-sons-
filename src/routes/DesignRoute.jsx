"use client";

// ============================================================
// DesignRoute — the /design/<encoded> shell
// ============================================================
// Decodes the design out of the path segment and hands it to the view.
// Nothing is fetched: the whole design travels in the link, which is
// what keeps this page from being an enumerable read of other people's
// saved designs. See the header of DesignShareView.jsx.
// ============================================================

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { DesignShareView } from "../components/DesignShareView.jsx";
import { decodeDesignFromUrl, fromUrlSafe, resolveDesign } from "../lib/designUrl";
import { PRODUCT } from "../data/product.js";
import { useSiteNav } from "../state/useSiteNav.js";

export function DesignRoute() {
  const nav = useSiteNav();
  const params = useParams();
  const segment = typeof params?.design === "string" ? params.design : "";

  const { encoded, design } = useMemo(() => {
    const standard = fromUrlSafe(segment);
    // A malformed segment decodes to null and the view says so, rather
    // than throwing: this URL arrives by being pasted into a message
    // app, which is a place links routinely lose their last character.
    return { encoded: standard, design: resolveDesign(decodeDesignFromUrl(standard), PRODUCT) };
  }, [segment]);

  return <DesignShareView encoded={encoded} design={design} onOpen={nav.go} />;
}

export default DesignRoute;
