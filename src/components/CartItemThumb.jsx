"use client";

// ============================================================
// CartItemThumb — optimized cart/checkout line-item thumbnail
// ============================================================
// Product photos (/img/*) go through next/image so Netlify's CDN
// serves a resized AVIF/WebP at thumbnail size. Custom-upload
// previews can be base64 `data:` URLs, which next/image can't
// optimize (and would error on) — those fall back to a plain
// <img>. One guard, used by both the cart drawer and checkout.
// ============================================================

import React from "react";
import Image from "next/image";

export function CartItemThumb({ src, alt = "", width, height, className = "", style }) {
  if (typeof src !== "string" || src.startsWith("data:")) {
    return (
      <img src={src} alt={alt} className={className} style={style} loading="lazy" decoding="async" />
    );
  }
  return (
    <Image src={src} alt={alt} width={width} height={height} className={className} style={style} />
  );
}
