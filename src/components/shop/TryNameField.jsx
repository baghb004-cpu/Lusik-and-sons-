"use client";

// ============================================================
// TRY A NAME — a doorway, not a second configurator
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 7: a "Try a name" field on the two products
// a customer configures, carrying what they typed into the product page.
//
// What it is NOT: a live 3D preview on a grid card. The same plan rules
// that out in as many words ("No engine load on grids"), and it would be
// the wrong trade anyway — four cards on a category page, each one able
// to pull in the engine, to show a piece at thumbnail size that the
// product page shows properly a tap later.
//
// What it removes is the step in between: you land on the product page
// with the name already in the box and the stage already stitching it.
//
// The rules live in src/lib/tryName.js — plain JavaScript, unit tested —
// because what this field lets through is what someone sees stitched.
// ============================================================

import React, { useId, useState } from "react";
import { useT } from "../../i18n/LangContext.jsx";
import { TRY_NAME_MAX, sanitizeTryName, tryNameHref } from "../../lib/tryName.js";
import { ArrowRight } from "../icons.jsx";

/**
 * @param {object}   props
 * @param {string}   props.name      the product's name, for the labels
 * @param {string}   props.path      the product page, e.g. /shop/bibs/baby-bib
 * @param {(href: string) => void} [props.onOpen]     navigate (SPA)
 * @param {(href: string) => void} [props.onPrefetch] warm the route
 */
export function TryNameField({ name, path, onOpen, onPrefetch }) {
  const t = useT();
  const [value, setValue] = useState("");
  // The category grid renders several cards, and the shop page renders
  // its columns twice — once for mobile, once for desktop, both in the
  // DOM. A hardcoded id would appear many times over, which is invalid
  // and leaves every label pointing at whichever copy the browser picked.
  const inputId = useId();

  const clean = value.trim();
  const href = tryNameHref(path, clean);

  const open = (event) => {
    event.preventDefault();
    onOpen?.(href);
  };

  return (
    // A real <form>, so Enter submits — someone who has just typed a name
    // into a one-field box expects Enter to be the whole interaction, and
    // on a phone the keyboard shows a Go key for it.
    <form
      onSubmit={open}
      className="px-5 py-4"
      // The card above is a <button>. This has to sit outside it: an
      // input inside a button is invalid, and a browser will not let you
      // type into one.
      data-try-name={path}
    >
      <label
        htmlFor={inputId}
        className="text-[0.6rem] tracking-[0.3em] uppercase block mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {t("tryName.label")}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => setValue(sanitizeTryName(e.target.value))}
          onFocus={() => onPrefetch?.(path)}
          maxLength={TRY_NAME_MAX}
          autoComplete="given-name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("tryName.placeholder")}
          aria-label={t("tryName.inputAria", { name })}
          aria-describedby={`${inputId}-hint`}
          className="min-w-0 flex-1 px-3 py-2 text-sm"
          style={{
            border: "1px solid var(--border-strong)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
          }}
        />
        <button
          type="submit"
          disabled={clean.length === 0}
          aria-label={t("tryName.goAria", { name, value: clean })}
          className="shrink-0 px-3 py-2 text-[0.65rem] tracking-[0.2em] uppercase inline-flex items-center gap-1.5 transition"
          style={{
            background: clean ? "var(--ink)" : "transparent",
            color: clean ? "var(--text-on-ink)" : "var(--text-muted)",
            border: `1px solid ${clean ? "var(--ink)" : "var(--border-strong)"}`,
            cursor: clean ? "pointer" : "not-allowed",
          }}
        >
          {t("tryName.go")}
          <ArrowRight size={12} strokeWidth={1.75} />
        </button>
      </div>
      <p id={`${inputId}-hint`} className="text-[0.6rem] mt-1.5" style={{ color: "var(--text-muted)" }}>
        {t("tryName.hint", { n: TRY_NAME_MAX })}
      </p>
    </form>
  );
}
