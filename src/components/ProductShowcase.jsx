"use client";

// ============================================================
// ProductShowcase — the main PDP for the Armenian Alphabet Blanket
// ============================================================
// The biggest component in the codebase (~1240 lines). Manages
// the picker state for alphabet / layout / colors / preset /
// custom name lines, the photo gallery + zoom lightbox, the
// sticky CTA on mobile, save-design + share-design flows, and
// the deep-link `?d=<base64>` URL hydration.
//
// fan out broadly because this is the PDP — almost everything
// in src/components/ shows up somewhere on the page.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { CONFIG } from "../data/config.js";
import { db } from "../lib/db.js";
import { track } from "../lib/analytics.js";
import { encodeDesignToUrl, decodeDesignFromUrl, resolveDesign } from "../lib/designUrl";
import { galleryRotationStyle } from "../lib/galleryRotation";
import { useIsMobile } from "../lib/useIsMobile";
import { useSwipe } from "../lib/useSwipe.js";
import { useGlideCarousel } from "../lib/useGlideCarousel.js";
import { PHOTO_DATE_DETAIL } from "../images/photos.js";
import { getDeliveryEstimate } from "../lib/deliveryEstimate";
import { BlanketLayoutPreview } from "./BlanketLayoutPreview.jsx";
import { CollapsibleSection } from "./CollapsibleSection.jsx";
import { ProductVariationNote } from "./ProductVariationNote.jsx";
import { SoldOutPanel } from "./shop/SoldOutPanel.jsx";
import { useToast } from "./ToastProvider.jsx";
import { useT, useLang } from "../i18n/LangContext.jsx";
import { loc } from "../i18n/localize.js";
import {
  ArrowRight, Bookmark, ChevronLeft, ChevronRight,
  Instagram, Mail, Minus, Phone, Plus, Share2, X, ZoomIn,
} from "./icons.jsx";

export function ProductShowcase({ product, onAdd, onBuyNow, onCartFeedback, user, onRequireSignIn, onStickyCtaShown, soldOut = false, notifyKey }) {
  const toast = useToast();
  const t = useT();
  const { lang } = useLang();
  // --- STICKY MOBILE ADD-TO-CART ---
  // Ref on the primary Add-to-cart button. An IntersectionObserver
  // watches it; when it scrolls out of view on mobile we slide a
  // sticky CTA bar up from the bottom of the viewport so the
  // customer can convert without scrolling back. The observer
  // also runs on desktop but the sticky bar JSX uses Tailwind's
  // `lg:hidden`, so desktop never sees it. The threshold is 0 so
  // the bar appears as soon as the main button leaves view, and
  // disappears as soon as any pixel of it returns.
  const addCtaRef = useRef(null);
  const [isAddCtaVisible, setIsAddCtaVisible] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const el = addCtaRef.current;
    if (!el) return;
    // The sticky mobile bar should only appear AFTER the customer has
    // scrolled past the main CTA — not before they've reached it. So
    // "visible" here means either truly intersecting OR still below the
    // viewport (i.e. hasn't been scrolled to yet). That keeps the bar
    // from appearing during the hero / above-the-fold reading flow.
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const stillBelowFold = entry.boundingClientRect.top > window.innerHeight;
        const visible = entry.isIntersecting || stillBelowFold;
        setIsAddCtaVisible(visible);
        // Lift the inverse signal to the parent so the global
        // mobile bottom-nav can hide while the sticky CTA bar
        // is occupying the same screen real estate.
        onStickyCtaShown?.(!visible);
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      // Tell the parent the sticky CTA is no longer relevant when
      // we unmount (e.g. customer navigated away from the PDP).
      onStickyCtaShown?.(false);
    };
  }, [onStickyCtaShown]);

  // Shared add-to-cart for the primary CTA AND the mobile sticky
  // bar. Both pass the rect of whichever button was clicked so the
  // heart-burst animation originates from the right spot.
  //
  // Double-tap guard: at $65/blanket, a frustrated tap-tap on a
  // sluggish phone would stack qty=2 (the SKU id collapses identical
  // selections, see App.addToCart). The ref check rejects any second
  // call within 600ms; the `adding` state additionally disables both
  // buttons during the window so the user sees the tap registered.
  const lastAddTsRef = useRef(0);
  const [adding, setAdding] = useState(false);
  const addItemToCart = (originRect) => {
    const now = Date.now();
    if (adding || now - lastAddTsRef.current < 600) return;
    lastAddTsRef.current = now;
    setAdding(true);
    if (originRect) {
      onCartFeedback?.(
        originRect.left + originRect.width / 2,
        originRect.top + originRect.height / 2
      );
    }
    onAdd(color, qty, alphabet, layout, {
      block: blockColor,
      letter: letterColor,
      letterColors: letterColorList,  // null for single-color, array of threadColor entries for multi-color
      presetKey: activePresetKey,
      customLine1: customLine1.trim(),  // optional name/initials, "" if blank
      customLine2: customLine2.trim(),  // optional year/date, "" if blank
    });
    // Re-enable after the cart-drawer auto-open + heart-burst land.
    // 600ms matches the throttle so the visual debounce ends in sync.
    window.setTimeout(() => setAdding(false), 600);
  };

  // Express "Buy it now" — builds the exact same configured item as
  // addItemToCart but routes straight to checkout (App holds it as a
  // transient item; the saved bag is never touched). Shares the same
  // double-tap throttle so a frantic tap can't fire both paths. No
  // heart-burst here — we navigate away immediately.
  const buyItemNow = () => {
    const now = Date.now();
    if (adding || now - lastAddTsRef.current < 600) return;
    lastAddTsRef.current = now;
    onBuyNow?.(color, qty, alphabet, layout, {
      block: blockColor,
      letter: letterColor,
      letterColors: letterColorList,
      presetKey: activePresetKey,
      customLine1: customLine1.trim(),
      customLine2: customLine2.trim(),
    });
  };

  const [activeImg, setActiveImg] = useState(0);
  // Lightbox state — tap the main gallery image to zoom into a full-
  // viewport overlay. Escape, the X button, and clicking the backdrop
  // all close it; pinch-zoom on mobile is enabled by the browser
  // default since the overlay sets touch-action: pinch-zoom.
  const [zoomOpen, setZoomOpen] = useState(false);
  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setZoomOpen(false); };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the lightbox is open so swipe / scroll
    // gestures on the zoomed image don't also scroll the page underneath.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zoomOpen]);

  const [color, setColor] = useState(product.colors[0]);
  const [alphabet, setAlphabet] = useState(product.alphabets[0]);
  // Pick the first enabled layout as default. Customer changes via the picker.
  const enabledLayouts = product.layouts.filter(l => l.enabled);
  const [layout, setLayout] = useState(enabledLayouts[0]);
  const [qty, setQty] = useState(1);

  // Optional personalization: customer can add a short name + year (or any
  // two short bits of text up to 6 characters each) that Lusik will embroider
  // onto a free square of the waffle weave. Both fields are OPTIONAL — empty
  // strings mean "skip the personalization" and the blanket ships with just
  // the alphabet diagonals. Lusik decides placement per order based on what
  // looks best for the specific text the customer provided.
  const [customLine1, setCustomLine1] = useState("");
  const [customLine2, setCustomLine2] = useState("");

  // Left pane mode — controls whether the left column shows the photo gallery
  // (real product photos) or the live SVG preview (a schematic showing the
  // customer's current configuration).
  // "preview" is the default: customer immediately sees their design rendered.
  // "photos" lets them toggle to real product photos for material/quality reference.
  // The toggle sits at the top of the left column.
  const [leftPaneMode, setLeftPaneMode] = useState("preview");

  // Color state — block (cube outline) + letter color. Default to Lusik's
  // Boys preset (baby blue cube, semi-dark navy letter) since "Boys" is the
  // first preset in her list. Customer can change via presets or custom.
  const defaultPreset = product.colorPresets[0]; // lusik_boys
  const defaultBlock = product.threadColors.find(c => c.dmc === defaultPreset.block) ?? product.threadColors[0];
  const defaultLetter = product.threadColors.find(c => c.dmc === defaultPreset.letter) ?? product.threadColors[0];
  const [blockColor, setBlockColor] = useState(defaultBlock);
  const [letterColor, setLetterColor] = useState(defaultLetter);
  // letterColorList = array of threadColor entries when a multi-color preset
  // (Armenian Flag) is active, otherwise null. The renderer cycles through
  // this list per letter index. When null, the single letterColor is used.
  const [letterColorList, setLetterColorList] = useState(
    defaultPreset.letterColors
      ? defaultPreset.letterColors.map((d) => product.threadColors.find(c => c.dmc === d)).filter(Boolean)
      : null
  );
  const [colorMode, setColorMode] = useState("preset");  // "preset" | "custom"
  // The currently-selected preset, if customer chose one. Helps the UI
  // show which preset card is highlighted; null when in custom mode.
  const [activePresetKey, setActivePresetKey] = useState(defaultPreset.key);

  // ============================================================
  // SHAREABLE DESIGN URL — hydration + share handler
  // ============================================================
  // On mount, check for ?d=<base64> in the URL. If present, decode
  // and hydrate the picker so the recipient sees the same design
  // the sender configured. We strip the param from the URL after
  // hydrating so the customer can keep tweaking without a stale
  // share-link in their address bar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("d");
    if (!encoded) return;
    const compact  = decodeDesignFromUrl(encoded);
    const resolved = resolveDesign(compact, product);
    if (!resolved) return;
    if (resolved.alphabet)           setAlphabet(resolved.alphabet);
    if (resolved.layout)             setLayout(resolved.layout);
    if (resolved.blockColor)         setBlockColor(resolved.blockColor);
    if (resolved.letterColor)        setLetterColor(resolved.letterColor);
    if (resolved.letterColorList)    setLetterColorList(resolved.letterColorList);
    setActivePresetKey(resolved.activePresetKey);
    setColorMode(resolved.activePresetKey ? "preset" : "custom");
    if (resolved.customLine1) setCustomLine1(resolved.customLine1);
    if (resolved.customLine2) setCustomLine2(resolved.customLine2);
    // Strip the param so the URL bar stays clean.
    params.delete("d");
    const newQs   = params.toString();
    const newPath = window.location.pathname + (newQs ? `?${newQs}` : "") + window.location.hash;
    window.history.replaceState({}, "", newPath);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the current design to the customer's account. Requires
  // sign-in — guests are nudged into the auth drawer with a toast
  // explaining why. The compact design payload re-uses the
  // encoder above so saved designs round-trip identically to
  // shared links.
  const [savingDesign, setSavingDesign] = useState(false);
  // Brief "Saved ✓" celebration on the Save button after a successful
  // save — clears after 2.4s. Gives the customer in-place feedback
  // beyond the toast, which they might miss if they're focused on
  // the preview itself. The timer handle is captured in a ref so an
  // unmount mid-celebration (user navigates away) clears it cleanly
  // — without this, React logs a "state update on unmounted component"
  // warning and the no-op work runs anyway.
  const [justSavedDesign, setJustSavedDesign] = useState(false);
  const justSavedTimerRef = useRef(null);
  useEffect(() => () => { if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current); }, []);
  const handleSaveDesign = async () => {
    if (!user) {
      toast({
        kind: "info",
        message: "Sign in to save designs to your account.",
        action: { label: "Sign in", onClick: () => onRequireSignIn?.() },
      });
      return;
    }
    const compactJson = encodeDesignToUrl({
      alphabet, layout, blockColor, letterColor, letterColorList,
      activePresetKey, customLine1, customLine2,
    });
    const compact = decodeDesignFromUrl(compactJson);
    if (!compact) {
      toast({ kind: "error", message: "Couldn't save that design — please try again." });
      return;
    }
    // Build a friendly label from the variant data so the design
    // list in the account view is scannable without thumbnails.
    const customBits = [customLine1.trim(), customLine2.trim()].filter(Boolean).join(" / ");
    const labelParts = [alphabet?.label, blockColor?.name];
    if (customBits) labelParts.push(`"${customBits}"`);
    const label = labelParts.filter(Boolean).join(" · ").slice(0, 48);
    setSavingDesign(true);
    const { error } = await db.saveDesign({ label, design: compact });
    setSavingDesign(false);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't save — please try again." });
      return;
    }
    track("save-design", { alphabet: alphabet?.key, layout: layout?.key });
    toast({ kind: "success", message: "Design saved to your account." });
    setJustSavedDesign(true);
    if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
    justSavedTimerRef.current = setTimeout(() => setJustSavedDesign(false), 2400);
  };

  // Build a shareable URL containing the current design and either
  // open the native share sheet (mobile / supporting desktops) or
  // copy to clipboard with a toast confirmation.
  const handleShareDesign = async () => {
    track("share-design", { alphabet: alphabet?.key, layout: layout?.key });
    const encoded = encodeDesignToUrl({
      alphabet, layout, blockColor, letterColor, letterColorList,
      activePresetKey, customLine1, customLine2,
    });
    if (!encoded) {
      toast({ kind: "error", message: "Couldn't build a share link — please try again." });
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("d", encoded);
    url.hash = "blanket";
    const shareUrl = url.toString();

    // Try the native share sheet first — better UX on mobile.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "My blanket design — Lusik & Sons",
          text:  "Here's the blanket I'm thinking about — what do you think?",
          url:   shareUrl,
        });
        return;
      } catch (err) {
        // AbortError means the user dismissed the sheet; don't toast.
        if (err?.name === "AbortError") return;
        // Anything else, fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ kind: "success", message: "Link copied — paste it anywhere you'd like a second opinion." });
    } catch {
      toast({ kind: "info", message: `Copy this link: ${shareUrl}`, duration: 12000 });
    }
  };

  // Helper: apply a preset by key. Sets block + letter + optionally per-letter
  // color list (Armenian Flag).
  const applyPreset = (preset) => {
    const block = product.threadColors.find(c => c.dmc === preset.block);
    const letter = product.threadColors.find(c => c.dmc === preset.letter);
    if (block) setBlockColor(block);
    if (letter) setLetterColor(letter);
    // Multi-color presets: resolve each DMC to a full threadColor entry so
    // we have access to both name and hex for display + cart metadata.
    if (Array.isArray(preset.letterColors)) {
      const resolved = preset.letterColors
        .map((d) => product.threadColors.find(c => c.dmc === d))
        .filter(Boolean);
      setLetterColorList(resolved);
    } else {
      setLetterColorList(null);
    }
    setActivePresetKey(preset.key);
    setColorMode("preset");
  };

  // When the customer manually changes either block or letter color in the
  // custom palette, we drop the "preset" selection AND any multi-color list
  // — custom mode is always single-color per role.
  const setCustomBlock = (c) => { setBlockColor(c); setLetterColorList(null); setActivePresetKey(null); setColorMode("custom"); };
  const setCustomLetter = (c) => { setLetterColor(c); setLetterColorList(null); setActivePresetKey(null); setColorMode("custom"); };

  // ============================================================
  // MOBILE COLLAPSIBLE PICKERS
  // ============================================================
  // On mobile (<1024px), each picker step collapses to a single-row summary
  // after the customer makes a selection, so the live preview sits closer
  // to the top of the screen and fewer scrolls separate selection from
  // Add to Cart. On desktop, all sections stay expanded — desktop already
  // has the sticky photo on the left and plenty of horizontal real estate.
  //
  // Initial state: all sections OPEN. The customer needs to see the choices
  // first before they can make one; collapsing pre-emptively would hide UI
  // and confuse them. Sections only collapse AFTER a tap that registers a
  // selection — see the `onClick` handlers on each picker button.
  const isMobile = useIsMobile();
  const [openSection, setOpenSection] = useState("alphabet"); // "alphabet" | "layout" | "colors" | null
  // null = all sections collapsed (after all selections made)
  // Default opens alphabet first since it's step 1.

  // Helper: when a selection is made in a section, advance to the next one
  // on mobile. On desktop this is a no-op (all sections stay visible).
  // Flow: alphabet → layout → colors → custom (optional personalization) → done
  const advanceSection = (current) => {
    if (!isMobile) return;
    if (current === "alphabet") setOpenSection("layout");
    else if (current === "layout") setOpenSection("colors");
    else if (current === "colors") setOpenSection("custom");
    else if (current === "custom") setOpenSection(null);  // all done
  };

  // Determine if a section should render its full picker body or just its
  // collapsed summary header. On desktop, always full. On mobile, only full
  // when this section is the openSection.
  const isOpen = (section) => !isMobile || openSection === section;

  const next = () => setActiveImg((i) => (i + 1) % product.gallery.length);
  const prev = () => setActiveImg((i) => (i - 1 + product.gallery.length) % product.gallery.length);

  // Main gallery: finger-following glide carousel (drag to slide the
  // next photo in, release to snap). Lightbox keeps the lighter
  // swipe-detect. Both guard tap-to-zoom via their `swiped` ref.
  const glide = useGlideCarousel({ count: product.gallery.length, index: activeImg, setIndex: setActiveImg });
  const zoomSwipe = useSwipe({ onSwipeLeft: next, onSwipeRight: prev });

  return (
    // The outer #blanket id was the legacy home-page-anchor target.
    // With the /shop/blankets/armenian-alphabet-blanket route in
    // place, breadcrumbs are rendered by <ProductView> above and
    // the anchor is no longer used for navigation. Kept as an id
    // so any external link with #blanket on the product URL still
    // lands at the configurator section.
    <section id="blanket" className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Left column — either the live SVG preview (default) OR the photo
            gallery, toggleable via a small button at the top. The live preview
            is the default because the customer is building a custom blanket
            and seeing their choices rendered in real-time is the most useful
            visual feedback. Photos are kept one tap away for customers who
            want to see real product details (fabric, texture, fringe). On
            large screens both views stick in place as the customer scrolls
            through the configurator on the right. On mobile, the sticky
            behavior turns off — left and right columns stack naturally.

            `top-24` (~96px) clears the sticky nav (~80px) with breathing
            room. `max-h-[calc(100vh-7rem)]` + `overflow-y-auto` is a safety
            net for short laptop screens. */}
        <div className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {/* View toggle — "Your design" (live SVG preview) | "Real photos" */}
          <div className="flex gap-2 mb-4 text-xs">
            <button
              onClick={() => setLeftPaneMode("preview")}
              className="px-3 py-1.5 transition flex-1"
              style={{
                background: leftPaneMode === "preview" ? "var(--ink)" : "transparent",
                color: leftPaneMode === "preview" ? "var(--text-on-ink)" : "var(--text-primary)",
                border: "1px solid rgba(26,22,18,0.2)",
              }}
              aria-pressed={leftPaneMode === "preview"}
            >
              {t("pdp.yourDesign")}
            </button>
            <button
              onClick={() => setLeftPaneMode("photos")}
              className="px-3 py-1.5 transition flex-1"
              style={{
                background: leftPaneMode === "photos" ? "var(--ink)" : "transparent",
                color: leftPaneMode === "photos" ? "var(--text-on-ink)" : "var(--text-primary)",
                border: "1px solid rgba(26,22,18,0.2)",
              }}
              aria-pressed={leftPaneMode === "photos"}
            >
              {t("pdp.realPhotos")}
            </button>
          </div>

          {leftPaneMode === "preview" ? (
            <>
              {/* LIVE PREVIEW MODE — large schematic showing the customer's
                  current configuration: alphabet, layout, colors, optional text.
                  Wrapped in a square frame matching the photo gallery's
                  aspect-ratio so the layout doesn't jump when toggling modes. */}
              <div className="aspect-[4/5] overflow-hidden mb-4 flex items-center justify-center p-6 lg:p-8" style={{ background: "rgba(26,22,18,0.04)", border: "1px solid rgba(26,22,18,0.08)" }}>
                <div className="w-full max-w-[420px]">
                  <BlanketLayoutPreview
                    letters={alphabet.letters}
                    layout={layout}
                    darkMode={false}
                    size={420}
                    blockColor={blockColor.hex}
                    letterColor={letterColor.hex}
                    letterColors={letterColorList ? letterColorList.map(c => c.hex) : null}
                    customLine1={customLine1}
                    customLine2={customLine2}
                    showCustomTextHints
                  />
                </div>
              </div>
              <p className="text-[0.65rem] opacity-60 italic text-center leading-relaxed">
                {t("pdp.livePreviewCaption")}
              </p>
            </>
          ) : (
            <>
              {/* PHOTO GALLERY MODE — real product photos with thumbnail navigation.
                  Tap the main image to open a fullscreen lightbox (zoom + pan).
                  The next/prev arrow buttons stop click propagation so they don't
                  also trigger the zoom open. */}
              <div
                className="relative aspect-[4/5] overflow-hidden mb-4"
                style={{ background: "rgba(26,22,18,0.04)", cursor: "zoom-in", touchAction: "pan-y" }}
                role="button"
                aria-label={t("pdp.zoomPhotoAria", { n: activeImg + 1, m: product.gallery.length })}
                onClick={() => { if (!glide.swiped.current) setZoomOpen(true); }}
                {...glide.handlers}
              >
                {/* Sliding track — drag follows the finger, neighbour
                    photo slides in, release snaps. Only ±2 of the
                    active photo get a real src so the full gallery
                    doesn't decode at once. */}
                <div style={glide.trackStyle}>
                  {product.gallery.map((src, i) => {
                    const near = Math.abs(i - activeImg) <= 2;
                    return (
                      <div key={i} className="min-w-full h-full flex items-center justify-center relative">
                        {near && (
                          <Image
                            src={src}
                            alt={product.name}
                            fill
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-cover pointer-events-none"
                            style={galleryRotationStyle(i)}
                            priority={i === activeImg}
                            draggable={false}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center backdrop-blur-sm z-10" style={{ background: "rgba(245,239,227,0.6)" }} aria-label={t("pdp.prevPhoto")}>
                  <ChevronLeft size={18} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center backdrop-blur-sm z-10" style={{ background: "rgba(245,239,227,0.6)" }} aria-label={t("pdp.nextPhoto")}>
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-3 right-3 px-3 py-1 text-xs tracking-wide pointer-events-none" style={{ background: "rgba(26,22,18,0.7)", color: "#F5EFE3" }}>
                  {activeImg + 1} / {product.gallery.length}
                </div>
                <div className="absolute bottom-3 left-3 px-2.5 py-1 text-[0.6rem] tracking-[0.15em] uppercase pointer-events-none flex items-center gap-1.5" style={{ background: "rgba(26,22,18,0.6)", color: "#F5EFE3" }}>
                  <ZoomIn size={11} strokeWidth={2} /> {t("pdp.tapToZoom")}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {product.gallery.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={`relative aspect-square overflow-hidden ${activeImg === i ? "" : "opacity-50 hover:opacity-100"}`} style={{ outline: activeImg === i ? "1.5px solid #1A1612" : "none", outlineOffset: "1px" }}>
                    {/* next/image fill + tiny sizes → the CDN serves a
                        thumbnail-sized derivative instead of the full source. */}
                    <Image src={src} alt="" fill sizes="(max-width: 1024px) 16vw, 8vw" className="object-cover" style={galleryRotationStyle(i, "square")} draggable={false} />
                  </button>
                ))}
              </div>

              {/* Stitching video. Renders only when product.video.src is
                  a real URL — until Lusik provides one, this section is
                  hidden entirely. Muted + playsInline so iOS Safari
                  allows autoplay; loop so it cycles forever; preload
                  metadata only so the customer's bandwidth isn't burned
                  on a video they may not watch. */}
              {product.video?.src && (
                <div className="mt-4">
                  <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2 opacity-60" style={{ color: "var(--accent)" }}>
                    Watch Lusik stitch
                  </p>
                  <div className="relative aspect-video overflow-hidden" style={{ background: "rgba(26,22,18,0.04)" }}>
                    <video
                      src={product.video.src}
                      poster={product.video.poster || undefined}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      controls
                      className="w-full h-full object-cover"
                      aria-label={product.video.caption || "Lusik stitching the blanket"}
                    />
                  </div>
                  {product.video.caption && (
                    <p className="text-[0.65rem] opacity-60 italic mt-2 leading-relaxed">
                      {product.video.caption}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)" }}>{t("pdp.madeToOrderEyebrow")}</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-3 leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>{loc(product, "name", lang)}</h2>
          <p className="text-base opacity-70 mb-6">{loc(product, "subtitle", lang)}</p>

          <div className="flex items-baseline gap-3 mb-2">
            <p className="text-3xl" style={{ fontWeight: 500 }}>${(layout.priceCents / 100).toFixed(0)}</p>
          </div>
          <p className="text-xs opacity-60 mb-8">
            {layout.letterCount === 6 ? t("pdp.premiumNote") : t("pdp.standardNote")}
          </p>

          <p className="text-base leading-relaxed mb-8 opacity-85">{product.description}</p>

          {/* Photos shown are examples of past work — each handmade piece may
              vary a little from the samples. */}
          <ProductVariationNote className="mb-8" />

          <CollapsibleSection
            title={t("pdp.step1")}
            open={isOpen("alphabet")}
            onExpand={() => setOpenSection("alphabet")}
            summary={
              <span className="flex items-center gap-3">
                <span style={{ fontFamily: "Fraunces, serif", fontSize: "1.5rem", lineHeight: 1, letterSpacing: "0.05em" }}>
                  {alphabet.letters.join(" ")}
                </span>
                <span className="opacity-60">{alphabet.label}</span>
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              {product.alphabets.map((a) => {
                const selected = alphabet.key === a.key;
                return (
                  <button
                    key={a.key}
                    onClick={() => { setAlphabet(a); advanceSection("alphabet"); }}
                    className="text-center px-4 py-7 transition flex flex-col items-center justify-center gap-2"
                    style={{
                      background: selected ? "var(--ink)" : "transparent",
                      color: selected ? "var(--text-on-ink)" : "var(--text-primary)",
                      border: `1px solid ${selected ? "var(--ink)" : "var(--border-strong)"}`,
                      minHeight: "140px",
                    }}
                  >
                    <p className="text-[0.65rem] tracking-[0.3em] uppercase opacity-70">{a.label}</p>
                    <p style={{
                      fontFamily: "Fraunces, serif",
                      fontSize: "2.75rem",
                      fontWeight: 400,
                      lineHeight: 1,
                      letterSpacing: "0.05em",
                    }}>
                      {a.letters.join(" ")}
                    </p>
                    <p className="text-[0.7rem] opacity-60">{a.transliteration}</p>
                  </button>
                );
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title={t("pdp.step2")}
            open={isOpen("layout")}
            onExpand={() => setOpenSection("layout")}
            mb="mb-8"
            summary={
              <span className="flex items-center gap-3">
                <div style={{ width: "44px", flexShrink: 0 }}>
                  <BlanketLayoutPreview letters={alphabet.letters} layout={layout} darkMode={false} size={44} />
                </div>
                <span className="leading-tight">
                  <span className="block">{layout.shortLabel}</span>
                  <span className="text-[0.65rem] opacity-60">{t("pdp.letters", { n: layout.letterCount })} · ${(layout.priceCents / 100).toFixed(0)}</span>
                </span>
              </span>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {enabledLayouts.map((l) => {
                const selected = layout.key === l.key;
                const priceLabel = `$${(l.priceCents / 100).toFixed(0)}`;
                return (
                  <button
                    key={l.key}
                    onClick={() => { setLayout(l); advanceSection("layout"); }}
                    className="text-left p-3 transition"
                    style={{
                      background: selected ? "var(--ink)" : "transparent",
                      color: selected ? "var(--text-on-ink)" : "var(--text-primary)",
                      border: `1px solid ${selected ? "var(--ink)" : "var(--border-strong)"}`,
                    }}
                  >
                    {/* Inline mini-preview using the alphabet's letters */}
                    <div className="mb-2 mx-auto" style={{ width: "60px" }}>
                      <BlanketLayoutPreview
                        letters={alphabet.letters}
                        layout={l}
                        darkMode={selected}
                        size={60}
                      />
                    </div>
                    <p className="text-[0.65rem] leading-tight mb-1" style={{ fontWeight: 500 }}>
                      {l.shortLabel}
                    </p>
                    <div className="flex items-center justify-between text-[0.6rem] opacity-70">
                      <span>{t("pdp.letters", { n: l.letterCount })}</span>
                      <span style={{ fontWeight: 500 }}>{priceLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs opacity-60 mt-3 leading-relaxed">
              {layout.description}{t("pdp.forDifferentLetterPre")}<a href="mailto:hello@lusikandsons.com?subject=Custom letter request" className="underline">{t("pdp.writeLusikDirectly")}</a>{t("pdp.forDifferentLetterPost")}
            </p>
          </CollapsibleSection>

          {/* STEP 3 — COLOR PICKER
              Two-part choice: the color of the 3D square (block) and the
              color of the letter inside it. Customer can choose a preset
              (one-tap pairing) or build a custom combination. */}
          <CollapsibleSection
            title={t("pdp.step3")}
            open={isOpen("colors")}
            onExpand={() => setOpenSection("colors")}
            summary={
              <span className="flex items-center gap-3">
                {/* Two-color swatch preview */}
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span style={{ width: "16px", height: "16px", background: blockColor.hex, border: "1px solid rgba(26,22,18,0.15)" }} />
                  <span style={{ width: "16px", height: "16px", background: letterColor.hex, border: "1px solid rgba(26,22,18,0.15)" }} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[0.7rem]">{blockColor.name} {t("pdp.cube")} · {letterColor.name} {t("pdp.letter")}</span>
                  <span className="text-[0.6rem] opacity-60">{blockColor.name} & {letterColor.name}</span>
                </span>
              </span>
            }
          >
            <p className="text-[0.65rem] opacity-50 italic mb-4">
              {t("pdp.colorIntro")}
            </p>

            {/* Mode toggle: Presets vs Custom */}
            <div className="flex gap-2 mb-4 text-xs">
              <button
                onClick={() => setColorMode("preset")}
                className="px-3 py-1.5 transition"
                style={{
                  background: colorMode === "preset" ? "var(--ink)" : "transparent",
                  color: colorMode === "preset" ? "var(--text-on-ink)" : "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                {t("pdp.presets")}
              </button>
              <button
                onClick={() => setColorMode("custom")}
                className="px-3 py-1.5 transition"
                style={{
                  background: colorMode === "custom" ? "var(--ink)" : "transparent",
                  color: colorMode === "custom" ? "var(--text-on-ink)" : "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                {t("pdp.pickYourOwn")}
              </button>
            </div>

            {/* PRESETS MODE — Lusik's actual color combinations. Flat list,
                no grouping — there are only five, they don't need categories. */}
            {colorMode === "preset" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {product.colorPresets.map((preset) => {
                  const block = product.threadColors.find(c => c.dmc === preset.block);
                  // For multi-color presets, resolve the array of letter color
                  // entries so we can render a striped swatch. For single-color
                  // presets, fall back to the single `letter` color.
                  const letterList = Array.isArray(preset.letterColors)
                    ? preset.letterColors.map((d) => product.threadColors.find(c => c.dmc === d)).filter(Boolean)
                    : null;
                  const singleLetter = product.threadColors.find(c => c.dmc === preset.letter);
                  if (!block || !singleLetter) return null;
                  const selected = activePresetKey === preset.key;
                  // Sample glyph shown inside the swatch — use the alphabet's
                  // first letter so the customer sees what an "A" / "Ա" would
                  // look like in their chosen colors.
                  const sampleGlyph = alphabet.letters[0];
                  // For the multi-color swatch we cycle through letters, but
                  // we have one swatch — we'll pick the first color of the list
                  // for the sample letter, since that's letter index 0.
                  const sampleLetterColor = letterList ? letterList[0].hex : singleLetter.hex;
                  return (
                    <button
                      key={preset.key}
                      onClick={() => { applyPreset(preset); advanceSection("colors"); }}
                      className="text-left p-3 transition flex items-center gap-3"
                      style={{
                        background: selected ? "var(--ink)" : "transparent",
                        color: selected ? "var(--text-on-ink)" : "var(--text-primary)",
                        border: `1px solid ${selected ? "var(--ink)" : "var(--border-strong)"}`,
                      }}
                      title={preset.description}
                    >
                      {/* Tiny block-with-letter preview swatch — outline + depth */}
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: "32px", height: "32px",
                          background: "#FFFFFF",
                          border: `2px solid ${block.hex}`,
                          boxShadow: `2px 2px 0 0 ${block.hex}66`,
                          fontFamily: "Fraunces, serif",
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: sampleLetterColor,
                          lineHeight: 1,
                        }}
                      >
                        {sampleGlyph}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8rem] leading-tight" style={{ fontWeight: 500 }}>
                          {preset.label}
                        </p>
                        {/* For multi-color presets, show the color stripe in miniature
                            so the customer sees that the letters use multiple colors. */}
                        {letterList && (
                          <div className="flex gap-0.5 mt-1">
                            {letterList.map((c) => (
                              <span
                                key={c.dmc}
                                style={{
                                  width: "8px", height: "8px",
                                  background: c.hex,
                                  display: "inline-block",
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* CUSTOM MODE — two side-by-side palettes, one for block, one for letter */}
            {colorMode === "custom" && (
              <div className="space-y-5">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-wider opacity-70 mb-2">{t("pdp.blockColorLabel")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.threadColors.map((c) => {
                      const selected = blockColor.dmc === c.dmc;
                      return (
                        <button
                          key={c.dmc}
                          onClick={() => setCustomBlock(c)}
                          className="transition relative"
                          style={{
                            width: "28px", height: "28px",
                            background: c.hex,
                            border: selected ? "2px solid #1A1612" : "1px solid rgba(26,22,18,0.2)",
                            outline: selected ? "1px solid #F5EFE3" : "none",
                            outlineOffset: "-3px",
                          }}
                          aria-label={c.name}
                          title={c.name}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[0.65rem] opacity-50 mt-1.5">
                    {t("pdp.selected")} <span style={{ fontWeight: 500 }}>{blockColor.name}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[0.7rem] uppercase tracking-wider opacity-70 mb-2">{t("pdp.letterColorLabel")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.threadColors.map((c) => {
                      const selected = letterColor.dmc === c.dmc;
                      return (
                        <button
                          key={c.dmc}
                          onClick={() => setCustomLetter(c)}
                          className="transition relative"
                          style={{
                            width: "28px", height: "28px",
                            background: c.hex,
                            border: selected ? "2px solid #1A1612" : "1px solid rgba(26,22,18,0.2)",
                            outline: selected ? "1px solid #F5EFE3" : "none",
                            outlineOffset: "-3px",
                          }}
                          aria-label={c.name}
                          title={c.name}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[0.65rem] opacity-50 mt-1.5">
                    {t("pdp.selected")} <span style={{ fontWeight: 500 }}>{letterColor.name}</span>
                  </p>
                </div>

                {/* Mobile-only Done button in custom mode — custom requires TWO
                    selections (block + letter), so we can't auto-collapse after
                    a single tap like presets do. Done is an explicit confirm.
                    Hidden on desktop since desktop never collapses anyway. */}
                {isMobile && (
                  <button
                    onClick={() => advanceSection("colors")}
                    className="w-full py-3 text-sm tracking-wide"
                    style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
                  >
                    {t("pdp.doneCollapse")}
                  </button>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* STEP 4 — OPTIONAL PERSONALIZATION
              Two short text fields (up to 6 characters each) that Lusik will
              embroider onto a free square of the waffle weave. Common uses:
              first line = nickname or initials, second line = birth year or
              date. Both fields are OPTIONAL — leaving them blank ships the
              blanket with just the alphabet diagonals, no extra charge either
              way. Lusik decides actual placement when she stitches the
              blanket based on what looks best for the specific text. */}
          <CollapsibleSection
            title={t("pdp.step4")}
            open={isOpen("custom")}
            onExpand={() => setOpenSection("custom")}
            summary={
              <span className="leading-tight">
                {(customLine1.trim().length > 0 || customLine2.trim().length > 0) ? (
                  <>
                    <span className="block text-[0.75rem]" style={{ fontFamily: "Fraunces, serif", fontWeight: 500 }}>
                      {[customLine1.trim(), customLine2.trim()].filter(Boolean).join("  ·  ")}
                    </span>
                    <span className="text-[0.6rem] opacity-60">{t("pdp.willEmbroider")}</span>
                  </>
                ) : (
                  <>
                    <span className="block text-[0.75rem] opacity-70">{t("pdp.noOptionalText")}</span>
                    <span className="text-[0.6rem] opacity-50">{t("pdp.shipsAlphabet")}</span>
                  </>
                )}
              </span>
            }
          >
            <p className="text-[0.65rem] opacity-60 italic mb-4 leading-relaxed">
              {t("pdp.personalizationIntro")}
            </p>

            <div className="space-y-4">
              {/* Line 1 — typically a short name, nickname, or initials */}
              <div>
                <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-1.5">
                  {t("pdp.line1Label")}
                </label>
                <input
                  type="text"
                  value={customLine1}
                  onChange={(e) => setCustomLine1(e.target.value)}
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t("pdp.line1Placeholder")}
                  className="w-full px-3 py-2.5 text-sm"
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontFamily: "Fraunces, serif",
                  }}
                  aria-label={t("pdp.line1Aria")}
                />
                <p className="text-[0.6rem] opacity-50 mt-1">
                  {t("pdp.upToChars", { n: customLine1.trim().length })}
                </p>
              </div>

              {/* Line 2 — typically birth year or date */}
              <div>
                <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-1.5">
                  {t("pdp.line2Label")}
                </label>
                <input
                  type="text"
                  value={customLine2}
                  onChange={(e) => setCustomLine2(e.target.value)}
                  maxLength={6}
                  autoComplete="off"
                  inputMode="numeric"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t("pdp.line2Placeholder")}
                  className="w-full px-3 py-2.5 text-sm"
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontFamily: "Fraunces, serif",
                  }}
                  aria-label={t("pdp.line2Aria")}
                />
                <p className="text-[0.6rem] opacity-50 mt-1">
                  {t("pdp.upToChars", { n: customLine2.trim().length })}
                </p>
              </div>
            </div>

            {/* Real-blanket reference — the OLEN / 2026 photo proves the
                placement the caption describes: the name sits in the
                geometric center of the blanket, with the year on the
                empty waffle square diagonally above and to the left.
                Both squares lie on the line that runs equidistant
                between Lusik's two alphabet diagonals, so the
                personalization rhythms with the rest of the design.
                Keeping the image small (96px wide) keeps the focus on
                the inputs above rather than dominating the section. */}
            <div className="mt-4 flex items-start gap-3 p-3" style={{ background: "rgba(176,136,66,0.06)", border: "1px solid rgba(176,136,66,0.18)" }}>
              <div className="w-24 h-24 lg:w-28 lg:h-28 flex-shrink-0 overflow-hidden" style={{ border: "1px solid rgba(26,22,18,0.08)" }}>
                <Image
                  src={PHOTO_DATE_DETAIL}
                  width={112}
                  height={112}
                  alt="Real example — OLEN stitched at the center of the blanket with 2026 on the empty waffle square diagonally above, on the middle line between the two alphabet diagonals"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.6rem] tracking-[0.25em] uppercase mb-1" style={{ color: "var(--accent)" }}>{t("pdp.realExample")}</p>
                <p className="text-[0.7rem] opacity-75 leading-snug italic">
                  Lusik stitches the name in the center of the blanket and the year on the empty square diagonally above — on the line that runs between the two alphabet diagonals — like the <span style={{ fontStyle: "normal", fontFamily: "Fraunces, serif", fontWeight: 500 }}>OLEN / 2026</span> blanket shown here. Final placement may shift slightly depending on the specific text length.
                </p>
              </div>
            </div>

            {/* Mobile-only Done button — optional step, but customer should be
                able to explicitly collapse it once they're satisfied. Hidden on
                desktop since desktop never collapses anyway. */}
            {isMobile && (
              <button
                onClick={() => advanceSection("custom")}
                className="w-full py-3 text-sm tracking-wide mt-4"
                style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
              >
                {(customLine1.trim().length > 0 || customLine2.trim().length > 0)
                  ? t("pdp.doneCollapse")
                  : t("pdp.skipNoText")}
              </button>
            )}
          </CollapsibleSection>

          {/* LIVE PREVIEW — sits right after color picker so the customer
              sees their final choice rendered, before any other content.
              The "Share this design" link in the header encodes the current
              picker state into a URL and either invokes the native share
              sheet or copies to clipboard — see handleShareDesign above. */}
          <div className="mb-6 p-5 lg:p-6" style={{ background: "rgba(26,22,18,0.04)", border: "1px solid rgba(26,22,18,0.1)" }}>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <p className="text-[0.6rem] tracking-[0.3em] uppercase opacity-60" style={{ color: "var(--accent)" }}>{t("pdp.yourBlanket")}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSaveDesign}
                  disabled={savingDesign}
                  className="text-xs tracking-[0.15em] uppercase transition flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-40"
                  style={{
                    border: `1px solid ${justSavedDesign ? "var(--accent)" : "rgba(26,22,18,0.18)"}`,
                    background: justSavedDesign ? "rgba(176,136,66,0.08)" : "transparent",
                    color: justSavedDesign ? "var(--accent)" : "var(--text-primary)",
                    fontWeight: 500,
                  }}
                  aria-label={t("pdp.saveAria")}
                  title={user ? t("pdp.saveTitleUser") : t("pdp.saveTitleGuest")}
                >
                  <Bookmark size={12} strokeWidth={1.75} />
                  {savingDesign ? t("pdp.saving") : justSavedDesign ? t("pdp.saved") : t("pdp.saveDesign")}
                </button>
                <button
                  onClick={handleShareDesign}
                  className="text-xs tracking-[0.15em] uppercase opacity-70 hover:opacity-100 transition flex items-center gap-1.5 px-3 py-1.5"
                  style={{ border: "1px solid rgba(26,22,18,0.18)", fontWeight: 500 }}
                  aria-label={t("pdp.shareAria")}
                  title={t("pdp.shareTitle")}
                >
                  <Share2 size={12} strokeWidth={1.75} /> {t("pdp.share")}
                </button>
              </div>
            </div>
            {/* Promotion hint — guests see a soft sign-in nudge; signed-in
                customers see a pointer to their account library so they
                know the saved design will be retrievable later. */}
            <p className="text-[0.65rem] opacity-55 italic mb-3 leading-snug">
              {user ? t("pdp.saveHintUser") : t("pdp.saveHintGuest")}
            </p>
            <div className="flex items-center gap-5">
              <div style={{ width: "140px", flexShrink: 0 }}>
                <BlanketLayoutPreview
                  letters={alphabet.letters}
                  layout={layout}
                  darkMode={false}
                  size={140}
                  blockColor={blockColor.hex}
                  letterColor={letterColor.hex}
                  letterColors={letterColorList ? letterColorList.map(c => c.hex) : null}
                  customLine1={customLine1}
                  customLine2={customLine2}
                  showCustomTextHints
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base lg:text-lg leading-tight" style={{ fontWeight: 500 }}>
                  {t("pdp.alphabetLabel", { label: alphabet.label, translit: alphabet.transliteration })}
                </p>
                <p className="text-xs opacity-70 mt-1.5 leading-snug">
                  {layout.shortLabel}
                </p>
                <p className="text-xs opacity-70 mt-1 leading-snug">
                  <span style={{ color: blockColor.hex, fontWeight: 600 }}>■</span> {t("pdp.cubeOutline", { name: blockColor.name })}
                </p>
                {letterColorList ? (
                  <p className="text-xs opacity-70 mt-0.5 leading-snug">
                    {letterColorList.map((c, idx) => (
                      <span key={c.dmc}>
                        <span style={{ color: c.hex, fontWeight: 600 }}>■</span> {c.name}
                        {idx < letterColorList.length - 1 ? " · " : ""}
                      </span>
                    ))}
                    <span className="opacity-70"> {t("pdp.lettersWord")}</span>
                  </p>
                ) : (
                  <p className="text-xs opacity-70 mt-0.5 leading-snug">
                    <span style={{ color: letterColor.hex, fontWeight: 600 }}>■</span> {t("pdp.letterInside", { name: letterColor.name })}
                  </p>
                )}
                <p className="text-xs opacity-60 mt-2">
                  {t("pdp.letters", { n: layout.letterCount })} · ${(layout.priceCents / 100).toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          {/* DETAILS — collapsible accordion. Uses native <details>/<summary>
              so behavior is rock-solid across browsers, no React state needed.
              Matches the FAQ accordion pattern used elsewhere on the site. */}
          <details className="border-t border-b mb-8 group" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
            <summary className="py-5 flex items-center justify-between cursor-pointer list-none">
              <span className="text-xs tracking-[0.2em] uppercase opacity-70">{t("product.details")}</span>
              <Plus size={16} strokeWidth={1.5} className="open-icon opacity-60" />
            </summary>
            <ul className="space-y-2 text-sm pb-5 -mt-1">
              {product.specs.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span style={{ color: "var(--accent)" }}>—</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </details>

          {/* Final-sale reminder — sits right above Add to Cart so the
              customer cannot miss it at the decision point. Subtle gold-tinted
              callout, not alarming; links to the full Final Sale Policy
              modal so anyone who wants the detail can read it. */}
          <div className="mb-3 p-3 text-xs leading-snug flex items-start gap-2.5" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-strong)" }}>
            <span style={{ color: "var(--accent)", fontWeight: 600, letterSpacing: "0.05em" }}>{t("pdp.finalSale")}</span>
            <span className="opacity-80">
              {t("pdp.finalSaleBody")}{" "}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("openPolicy", { detail: "finalSale" }))}
                className="underline hover:opacity-60"
                style={{ color: "var(--accent)" }}
              >
                {t("pdp.readPolicy")}
              </button>.
            </span>
          </div>

          {soldOut ? (
            <SoldOutPanel name={product.name} productKey={notifyKey ?? "blanket-double_diag_br"} className="mb-4" />
          ) : (<>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center border" style={{ borderColor: "var(--border-strong)" }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-3"><Minus size={14} /></button>
              <span className="px-5 text-base">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-4 py-3"><Plus size={14} /></button>
            </div>
            {/* Primary Add-to-cart. The ref drives the IntersectionObserver
                above so the mobile sticky bar knows when this button is
                off-screen; the shared `addItemToCart` helper is also called
                from the sticky bar so they stay in lockstep. */}
            <button
              ref={addCtaRef}
              onClick={(e) => addItemToCart(e.currentTarget.getBoundingClientRect())}
              disabled={adding}
              aria-busy={adding}
              className="flex-1 py-4 text-sm tracking-wide flex items-center justify-center gap-2 transition-opacity"
              style={{
                background: "var(--ink)",
                color: "var(--text-on-ink)",
                opacity: adding ? 0.6 : 1,
                cursor: adding ? "wait" : "pointer",
              }}
            >
              {t("common.addToCart")} — ${((layout.priceCents / 100) * qty).toFixed(0)} <ArrowRight size={16} />
            </button>
          </div>
          {/* Express checkout — skips the bag and goes straight to Stripe with
              this exact configuration. Secondary (outlined) so the ink-filled
              Add to Bag stays the visual primary. Works for guests and
              signed-in customers alike. */}
          <button
            onClick={buyItemNow}
            disabled={adding}
            aria-busy={adding}
            className="w-full py-4 mb-4 text-sm tracking-wide flex items-center justify-center gap-2 transition-opacity"
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "1px solid var(--ink)",
              opacity: adding ? 0.6 : 1,
              cursor: adding ? "wait" : "pointer",
            }}
          >
            {t("pdp.buyNow")}
          </button>
          </>)}
          {/* Estimated delivery — concrete ship-by / arrives-by range
              instead of a vague "5–10 days" line. Computed on every
              render from today's date so it stays current; ranges
              are wide enough that a one-day shift around a federal
              holiday doesn't make it lie. */}
          <p className="text-xs opacity-70 leading-relaxed mb-4">
            {(() => {
              const est = getDeliveryEstimate();
              return (
                <>
                  <span style={{ fontWeight: 500 }}>{t("pdp.ships", { date: est.shipBy })}</span>
                  <span className="opacity-70">{t("pdp.arrives", { date: est.arrives })}</span>
                  <span className="block opacity-60 mt-0.5 text-[0.65rem]">{t("pdp.deliveryNote")}</span>
                </>
              );
            })()}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => window.open("tel:+17608742333")} className="py-3 text-xs tracking-wide flex items-center justify-center gap-2 border hover:bg-[rgba(26,22,18,0.04)]" style={{ borderColor: "var(--border-strong)" }}>
              <Phone size={14} /> {t("common.call")}
            </button>
            <button onClick={() => window.open("https://instagram.com", "_blank", "noopener,noreferrer")} className="py-3 text-xs tracking-wide flex items-center justify-center gap-2 border hover:bg-[rgba(26,22,18,0.04)]" style={{ borderColor: "var(--border-strong)" }}>
              <Instagram size={14} /> {t("common.dm")}
            </button>
            <button onClick={() => window.open("mailto:hello@lusikandsons.com?subject=Custom order inquiry")} className="py-3 text-xs tracking-wide flex items-center justify-center gap-2 border hover:bg-[rgba(26,22,18,0.04)]" style={{ borderColor: "var(--border-strong)" }}>
              <Mail size={14} /> {t("common.email")}
            </button>
          </div>
        </div>
      </div>


      {/* ============================================================
          GALLERY LIGHTBOX
          ============================================================
          Fullscreen overlay rendered above everything else when the
          customer taps the main gallery image. Shows the current photo
          at fit-to-viewport size with arrow + thumbnail navigation,
          escape / X / backdrop-click to close, pinch-zoom enabled on
          touch devices.
          ============================================================ */}
      {zoomOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(15,12,10,0.92)", zIndex: 9999 }}
          onClick={() => setZoomOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${activeImg + 1} of ${product.gallery.length}, zoomed`}
          {...zoomSwipe.handlers}
        >
          {/* Image — object-contain so the whole photo fits, regardless
              of aspect ratio. touchAction: pinch-zoom lets iOS users
              pinch-to-zoom for more detail. Click stops propagation
              so tapping the image itself doesn't close the lightbox. */}
          <img
            src={product.gallery[activeImg]}
            alt={product.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[88vh] object-contain"
            style={{ ...galleryRotationStyle(activeImg), touchAction: "pinch-zoom", cursor: "zoom-out" }}
          />

          {/* Close button — top-right, picks up the cream theme so it's
              visible against the dark backdrop. */}
          <button
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            aria-label={t("pdp.closeZoom")}
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center backdrop-blur-sm"
            style={{ background: "rgba(245,239,227,0.15)", color: "#F5EFE3" }}
          >
            <X size={22} />
          </button>

          {/* Prev / next arrows. Only render when there's more than one
              photo (a single-photo gallery doesn't need them). */}
          {product.gallery.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label={t("pdp.prevPhoto")}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center backdrop-blur-sm"
                style={{ background: "rgba(245,239,227,0.15)", color: "#F5EFE3" }}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label={t("pdp.nextPhoto")}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center backdrop-blur-sm"
                style={{ background: "rgba(245,239,227,0.15)", color: "#F5EFE3" }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Photo counter at the bottom. */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 text-xs tracking-[0.15em] uppercase pointer-events-none"
            style={{ background: "rgba(245,239,227,0.15)", color: "#F5EFE3" }}
          >
            {activeImg + 1} / {product.gallery.length}
          </div>
        </div>
      )}
    </section>
  );
}
