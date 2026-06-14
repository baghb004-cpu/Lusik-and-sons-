// ============================================================
// Tax Assistant — OPTIONAL, local-only OCR import (plan §25)
// ============================================================
// Reads numbers off a photo of a tax document (a W-2, a 1099) so the
// user doesn't have to squint. Three hard rules, by design:
//   1. OPTIONAL — the tool works fully without it; OCR only ever
//      pre-fills a SUGGESTION the user must read and confirm.
//   2. LOCAL ONLY — the OCR engine is loaded from a vendor file on
//      the drive (no CDN, no upload). If it isn't staged, we say so
//      plainly and the user just types the figure in.
//   3. NEVER AUTO-TRUST — extracted text is never written into a tax
//      number on its own. The engine still refuses to compute from
//      anything the user hasn't confirmed.
// We deliberately do NOT bundle a multi-megabyte OCR engine into the
// app; it's an add-on component (same posture as the FFmpeg sidecar).
// ============================================================

// Where the optional engine + language data live on the drive when staged.
const VENDOR_SCRIPT = "/vendor/tesseract/tesseract.min.js";
const VENDOR_PATHS = {
  workerPath: "/vendor/tesseract/worker.min.js",
  corePath: "/vendor/tesseract/tesseract-core.wasm.js",
  langPath: "/vendor/tesseract/lang",
};

interface TesseractGlobal {
  recognize: (image: Blob | string, lang: string, opts?: Record<string, unknown>) => Promise<{ data: { text: string } }>;
}
declare global {
  interface Window { Tesseract?: TesseractGlobal }
}

let loadAttempted = false;

/** True only if the optional local OCR engine is staged on the drive. */
export async function ocrAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Tesseract) return true;
  if (loadAttempted) return !!window.Tesseract;
  loadAttempted = true;
  return new Promise<boolean>((resolve) => {
    // Probe the vendor file with a script tag — no bundler import (keeps the
    // app's first-load JS unchanged) and no network (local path on the drive).
    const s = document.createElement("script");
    s.src = VENDOR_SCRIPT;
    s.async = true;
    s.onload = () => resolve(!!window.Tesseract);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export interface OcrResult {
  text: string;
  /** Dollar-amount-looking candidates pulled from the text, for quick pick. */
  amounts: string[];
}

/** Pull plausible money amounts out of OCR'd text (for the confirm step). */
export function extractAmounts(text: string): string[] {
  const out = new Set<string>();
  const re = /\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[1].replace(/,/g, ""));
  return Array.from(out).slice(0, 12);
}

/** Run OCR on an image file. Throws a friendly error if the optional engine
 *  isn't installed. The caller MUST present the result for manual confirmation
 *  — this never writes a tax figure on its own. */
export async function runOcr(file: File): Promise<OcrResult> {
  if (!(await ocrAvailable()) || !window.Tesseract) {
    throw new Error(
      "The optional offline OCR pack isn't installed on this drive. You can still type the figures in by hand — it's just as accurate, and every value is confirmed by you anyway."
    );
  }
  const { data } = await window.Tesseract.recognize(file, "eng", VENDOR_PATHS);
  const text = (data?.text ?? "").trim();
  return { text, amounts: extractAmounts(text) };
}
