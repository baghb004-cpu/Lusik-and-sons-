"use client";

// ============================================================
// /design/<encoded> — a design somebody sent you
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 11 asks for "a public design page for
// saved designs: the poster of the design, 'Made by Lusik for …', a
// share sheet with copy link".
//
// **The design travels in the URL, not in the database.** The saved
// designs a customer keeps live on their profile behind their own
// login, and their ids are short — a timestamp and five random
// characters — so a public endpoint that looked designs up by id would
// be an enumerable read of other people's children's names. There is no
// endpoint here. The link carries the whole design, the same compact
// blob the configurator's share button has always produced, so the only
// person who can open a design is somebody the owner sent it to.
//
// That also means this page renders on the server with no fetch, no
// auth and no database, and an old link keeps working forever.
//
// It is READ-ONLY on purpose. Someone who has just been sent a blanket
// wants to see it, not to be dropped into a seven-step configurator; the
// way through to the configurator is a button, and it carries the design
// with it.
// ============================================================

import React, { useState } from "react";
import { useT, useLang } from "../i18n/LangContext.jsx";
import { loc } from "../i18n/localize.js";
import { PRODUCT } from "../data/product.js";
import { CONFIG } from "../data/config.js";
import { BlanketLayoutPreview } from "./BlanketLayoutPreview.jsx";
import { ArrowRight, Check, Copy, Mail, Phone } from "./icons.jsx";

/** The product page this design belongs to, carrying the design with it. */
export function configuratorHref(encoded) {
  return `/shop/blankets/armenian-alphabet-blanket?d=${encodeURIComponent(encoded)}`;
}

function CopyButton({ value, label, copiedLabel }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard denied (an insecure origin, or a browser that asks).
      // The link is on the page in a selectable field, so there is
      // still a way to get it — no toast needed for something the
      // customer can see.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 px-4 py-2.5 text-[0.7rem] tracking-[0.2em] uppercase transition"
      style={{
        background: copied ? "transparent" : "var(--ink)",
        color: copied ? "var(--accent-text)" : "var(--text-on-ink)",
        border: `1px solid ${copied ? "var(--border-strong)" : "var(--ink)"}`,
      }}
    >
      {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
      {copied ? copiedLabel : label}
    </button>
  );
}

/**
 * @param {object} props
 * @param {string} props.encoded  the design blob, exactly as it arrived
 * @param {import("../lib/designUrl").ResolvedDesign | null} props.design
 * @param {(href: string) => void} [props.onOpen]
 */
export function DesignShareView({ encoded, design, onOpen }) {
  const t = useT();
  const { lang } = useLang();

  // A link that did not decode. Not an error page: somebody followed a
  // link a friend sent them, and the useful thing is the shop.
  if (!design) {
    return (
      <div className="fade-in max-w-3xl mx-auto px-6 lg:px-12 py-16 text-center">
        <h1 className="font-display text-3xl lg:text-4xl mb-4 leading-tight" style={{ fontWeight: 400 }}>
          {t("designShare.brokenTitle")}
        </h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
          {t("designShare.brokenBody")}
        </p>
        <button
          type="button"
          onClick={() => onOpen?.("/shop/blankets/armenian-alphabet-blanket")}
          className="inline-flex items-center gap-2 px-6 py-3 text-[0.7rem] tracking-[0.2em] uppercase"
          style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
        >
          {t("designShare.brokenCta")}
          <ArrowRight size={14} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  const name = (design.customLine1 || "").trim();
  // Two different things. The preview needs SOMETHING for every slot or
  // it cannot draw, so unset slots fall back to the shop's defaults. The
  // summary list beside it only names what the sender actually chose:
  // listing a default thread colour as though it were picked tells the
  // recipient the sender made a decision they did not make.
  const alphabet = design.alphabet ?? PRODUCT.alphabets?.[0] ?? null;
  const layout = design.layout ?? PRODUCT.layouts?.find((l) => l.enabled !== false) ?? PRODUCT.layouts?.[0] ?? null;
  const blockColor = design.blockColor ?? PRODUCT.threadColors?.[0] ?? null;
  const letterColor = design.letterColor ?? PRODUCT.threadColors?.[1] ?? blockColor;
  const chose = {
    alphabet: Boolean(design.alphabet),
    layout: Boolean(design.layout),
    threads: Boolean(design.blockColor || design.letterColor || design.letterColorList),
  };

  // Rendered on the server too, so the page is complete before any
  // JavaScript arrives — the 2D preview is plain SVG. The 3D stage is
  // deliberately NOT mounted here: this page is often opened from a
  // message on a phone, and the piece reads perfectly at this size.
  const href = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="fade-in max-w-5xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
        {t("designShare.eyebrow")}
      </p>
      <h1 className="font-display text-3xl lg:text-5xl mb-6 leading-[1.08]" style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>
        {name ? t("designShare.titleFor", { name }) : t("designShare.title")}
      </h1>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        <div
          className="p-6 lg:p-8 flex items-center justify-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="w-full max-w-[420px]">
            {alphabet && layout && blockColor && letterColor && (
              <BlanketLayoutPreview
                letters={alphabet.letters}
                layout={layout}
                darkMode={false}
                size={420}
                blockColor={blockColor.hex}
                letterColor={letterColor.hex}
                letterColors={design.letterColorList ? design.letterColorList.map((c) => c.hex) : null}
                customLine1={design.customLine1}
                customLine2={design.customLine2}
              />
            )}
          </div>
        </div>

        <div>
          <p className="text-base leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            {t("designShare.lede")}
          </p>

          <dl className="text-sm mb-8">
            {chose.alphabet && alphabet && (
              <div className="flex justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <dt style={{ color: "var(--text-muted)" }}>{t("designShare.alphabet")}</dt>
                <dd>{alphabet.label ?? alphabet.key}</dd>
              </div>
            )}
            {chose.layout && layout && (
              <div className="flex justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <dt style={{ color: "var(--text-muted)" }}>{t("designShare.layout")}</dt>
                <dd>{layout.shortLabel ?? layout.label ?? layout.key}</dd>
              </div>
            )}
            {chose.threads && blockColor && letterColor && (
              <div className="flex justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <dt style={{ color: "var(--text-muted)" }}>{t("designShare.threads")}</dt>
                <dd className="text-right">
                  {design.letterColorList
                    ? design.letterColorList.map((c) => c.name).join(", ")
                    : `${blockColor.name}, ${letterColor.name}`}
                </dd>
              </div>
            )}
            {design.customLine2?.trim() && (
              <div className="flex justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <dt style={{ color: "var(--text-muted)" }}>{t("designShare.year")}</dt>
                <dd>{design.customLine2.trim()}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-3 mb-8">
            <button
              type="button"
              onClick={() => onOpen?.(configuratorHref(encoded))}
              className="inline-flex items-center gap-2 px-5 py-3 text-[0.7rem] tracking-[0.2em] uppercase"
              style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
            >
              {t("designShare.openCta")}
              <ArrowRight size={14} strokeWidth={1.5} />
            </button>
            <CopyButton value={href} label={t("designShare.copyLink")} copiedLabel={t("designShare.copied")} />
          </div>

          {/* The registry ask. A copy-link button and a sentence, not a
              third-party script: the universal registries all take a
              pasted URL, and adding somebody else's JavaScript to a page
              that shows a child's name is a trade this shop should not
              make. */}
          <div className="p-5 mb-6" style={{ border: "1px dashed var(--border-strong)" }}>
            <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent-text)" }}>
              {t("designShare.registryEyebrow")}
            </p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              {t("designShare.registryBody")}
            </p>
            <CopyButton value={href} label={t("designShare.registryCopy")} copiedLabel={t("designShare.copied")} />
          </div>

          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
            {t("designShare.questions")}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <a href={`tel:${CONFIG.TEXT_US.phone_e164}`} className="inline-flex items-center gap-2" style={{ color: "var(--accent-text)" }}>
              <Phone size={15} strokeWidth={1.5} />
              {CONFIG.TEXT_US.phone_display}
            </a>
            <a
              href={`mailto:hello@lusikandsons.com?subject=${encodeURIComponent(t("designShare.mailSubject"))}`}
              className="inline-flex items-center gap-2"
              style={{ color: "var(--accent-text)" }}
            >
              <Mail size={15} strokeWidth={1.5} />
              hello@lusikandsons.com
            </a>
          </div>

          <p className="text-xs mt-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {t("designShare.colorsNote", { product: loc(PRODUCT, "name", lang) })}
          </p>
        </div>
      </div>
    </div>
  );
}
