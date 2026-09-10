"use client";

// ============================================================
// /review/<token> — how is it holding up?
// ============================================================
// The page the post-delivery email links to. Stars, a sentence, an
// optional photograph, and a consent checkbox that is off until somebody
// turns it on.
//
// Two things are deliberate and worth keeping.
//
// The photograph field only appears AFTER consent is given. A file
// picker that takes a picture of somebody's child and then asks
// permission has already taken the picture; asking first means the
// browser never reads the file unless the answer is yes.
//
// Nothing here promises the review will appear. Lusik reads every one
// before it goes anywhere, and saying so up front is both true and the
// reason a small shop can have public reviews at all.
// ============================================================

import React, { useEffect, useState } from "react";
import { db } from "../lib/db.js";
import { CONFIG } from "../data/config.js";
import { ArrowRight, Check } from "./icons.jsx";

const MAX_BODY = 1200;
const MAX_NAME = 60;
// Resized in the browser before it is sent: a modern phone photograph is
// several megabytes and none of that survives being shown at 600px.
const PHOTO_EDGE = 1400;
const PHOTO_QUALITY = 0.82;

function Stars({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="How many stars" className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            onClick={() => onChange(n)}
            className="text-3xl leading-none transition"
            style={{ color: on ? "var(--accent-text)" : "var(--border-strong)", background: "none", padding: "0 2px" }}
          >
            {on ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}

/** Down-scale in the browser so a 6 MB phone photo does not travel. */
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  // JPEG rather than WebP: this one is going to a store Lusik may open
  // on any device, and every device reads a JPEG.
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

export function ReviewForm({ orderId, token }) {
  const [state, setState] = useState({ loading: true, invite: null });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!orderId || !token) { setState({ loading: false, invite: null }); return; }
    db.getReviewInvite(orderId, token)
      .then((invite) => {
        if (!alive) return;
        setState({ loading: false, invite });
        // Someone coming back to change their mind sees what they said.
        if (invite?.review) {
          setRating(invite.review.rating || 0);
          setBody(invite.review.body || "");
          setName(invite.review.displayName || "");
          setConsent(invite.review.photoConsent === true);
        }
      })
      .catch(() => { if (alive) setState({ loading: false, invite: null }); });
    return () => { alive = false; };
  }, [orderId, token]);

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { setPhoto(null); return; }
    try {
      setPhoto(await shrink(file));
    } catch {
      setError("That photo could not be read. A JPEG or PNG works best.");
      setPhoto(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) { setError("Pick a number of stars first."); return; }
    setBusy(true);
    setError("");
    try {
      await db.submitReview({
        id: orderId,
        t: token,
        rating,
        body: body.trim(),
        displayName: name.trim(),
        photoConsent: consent,
        // Only ever sent with consent, and the server checks again.
        photo: consent ? photo : null,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || "That did not save. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const phone = CONFIG.TEXT_US?.phone_display || "";
  const phoneHref = CONFIG.TEXT_US?.phone_e164 || "";

  if (state.loading) {
    return <div className="max-w-2xl mx-auto px-6 lg:px-12 py-16"><p className="text-sm opacity-70">Loading…</p></div>;
  }

  if (!state.invite) {
    return (
      <div className="max-w-2xl mx-auto px-6 lg:px-12 py-16 fade-in">
        <h1 className="font-display text-3xl lg:text-4xl mb-4" style={{ fontWeight: 400 }}>
          We couldn&rsquo;t find that order.
        </h1>
        <p className="text-sm leading-relaxed opacity-80 mb-6">
          The link may have been cut short by an email app. Open it again from the email, or call and Lusik will look it up.
        </p>
        {phone && <a href={`tel:${phoneHref}`} className="underline text-sm" style={{ fontWeight: 500 }}>{phone}</a>}
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-6 lg:px-12 py-16 fade-in" data-review-done>
        <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>Thank you</p>
        <h1 className="font-display text-3xl lg:text-4xl mb-4" style={{ fontWeight: 400 }}>
          She has it.
        </h1>
        <p className="text-sm leading-relaxed opacity-80">
          Lusik reads every one herself before it goes anywhere on the site. If you would like to change what you wrote,
          open this link again and it will be waiting.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-12 py-12 lg:py-16 fade-in" data-review-form>
      <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
        Order {state.invite.orderNumber}
      </p>
      <h1 className="font-display text-3xl lg:text-4xl mb-4 leading-tight" style={{ fontWeight: 400 }}>
        How is it holding up?
      </h1>
      <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
        {state.invite.items?.length
          ? `You have ${state.invite.items.map((i) => i.name).join(" and ")}. A sentence is plenty.`
          : "A sentence is plenty."}
      </p>

      <form onSubmit={submit}>
        <div className="mb-6">
          <span className="text-[0.6rem] tracking-[0.25em] uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
            Stars
          </span>
          <Stars value={rating} onChange={setRating} />
        </div>

        <label className="block mb-6">
          <span className="text-[0.6rem] tracking-[0.25em] uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
            In your words <span className="normal-case tracking-normal">(optional)</span>
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            rows={5}
            className="w-full px-3 py-2.5 text-sm"
            style={{ border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
            aria-label="Your review"
          />
          <span className="text-[0.6rem] opacity-55 mt-1 block tabular-nums">{body.length}/{MAX_BODY}</span>
        </label>

        <label className="block mb-6">
          <span className="text-[0.6rem] tracking-[0.25em] uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
            What to call you <span className="normal-case tracking-normal">(optional)</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
            maxLength={MAX_NAME}
            placeholder="Ani G."
            className="w-full px-3 py-2.5 text-sm"
            style={{ border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
            aria-label="What to call you"
          />
          <span className="text-[0.65rem] opacity-70 mt-1.5 block">
            Leave it blank and the review appears without a name.
          </span>
        </label>

        {/* Consent BEFORE the file picker, on purpose. A picker that
            takes a photograph of somebody's child and then asks
            permission has already taken it. */}
        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => { setConsent(e.target.checked); if (!e.target.checked) setPhoto(null); }}
            className="mt-0.5 w-4 h-4 shrink-0"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="text-sm leading-snug">
            I&rsquo;m happy for a photo of the piece to appear on the site.
            <span className="block text-xs opacity-70 mt-1 leading-relaxed">
              Only if you tick this. Your words and your photo are separate: Lusik can publish one without the other,
              and either can be taken down whenever you ask.
            </span>
          </span>
        </label>

        {consent && (
          <label className="block mb-6">
            <span className="text-[0.6rem] tracking-[0.25em] uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
              A photo <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhoto} className="text-sm" />
            {photo && (
              <img src={photo} alt="" aria-hidden="true" className="mt-3 max-h-48 w-auto" style={{ border: "1px solid var(--border-default)" }} />
            )}
          </label>
        )}

        {error && (
          <p className="text-sm mb-4" style={{ color: "var(--error)" }} role="alert">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || rating < 1}
          className="inline-flex items-center gap-2 px-6 py-3 text-[0.7rem] tracking-[0.2em] uppercase"
          style={{
            background: rating < 1 ? "transparent" : "var(--ink)",
            color: rating < 1 ? "var(--text-muted)" : "var(--text-on-ink)",
            border: `1px solid ${rating < 1 ? "var(--border-strong)" : "var(--ink)"}`,
            cursor: busy || rating < 1 ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Sending…" : "Send it to Lusik"}
          {busy ? <Check size={14} strokeWidth={1.75} /> : <ArrowRight size={14} strokeWidth={1.5} />}
        </button>

        <p className="text-xs mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Lusik reads every review herself before any of it appears on the site.
        </p>
      </form>
    </div>
  );
}
