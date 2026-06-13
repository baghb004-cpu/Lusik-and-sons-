"use client";

// ============================================================
// Communication Coach — optional speech-to-text hook
// ============================================================
// Wraps the browser's built-in SpeechRecognition (Web Speech API)
// IF the device has it. Honest about its limits:
//  - It is OPTIONAL; typing always works and is the offline core.
//  - On some browsers (notably Chrome) the built-in recognition can
//    use an ONLINE service — the UI says so and it's off by default.
//  - It listens to ROOM audio (speakerphone), never the call itself,
//    and never records: only a live transcript, kept in memory.
// Degrades cleanly to `supported: false` when no engine exists.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";

interface SRAlternative {
  transcript: string;
}
interface SRResult {
  0: SRAlternative;
  isFinal: boolean;
  length: number;
}
interface SRResultList {
  length: number;
  [index: number]: SRResult;
}
interface SREvent {
  resultIndex: number;
  results: SRResultList;
}
interface SRErrorEvent {
  error: string;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRConstructor = new () => SpeechRecognitionInstance;

function getCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechState {
  supported: boolean;
  listening: boolean;
  finalText: string;
  interimText: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): SpeechState {
  const [supported] = useState<boolean>(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SpeechRecognitionInstance | null>(null);
  const wantOn = useRef(false);

  const stop = useCallback(() => {
    wantOn.current = false;
    setListening(false);
    try {
      ref.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("This device's browser has no built-in speech recognition. Use “Type what they said” instead.");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: SREvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) setFinalText((prev) => (prev ? `${prev} ${text}`.trim() : text.trim()));
        else interim += text;
      }
      setInterimText(interim);
    };
    rec.onerror = (e: SRErrorEvent) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone permission was denied. You can still use “Type what they said”."
          : e.error === "network"
            ? "Speech recognition needs a connection on this browser, and it looks offline. Use “Type what they said” instead."
            : `Speech recognition stopped (${e.error}). You can use typing instead.`
      );
    };
    rec.onend = () => {
      // Auto-restart while the user still wants it on (continuous mode ends itself).
      if (wantOn.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };
    ref.current = rec;
    wantOn.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone. Use “Type what they said” instead.");
      setListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterimText("");
  }, []);

  // Stop cleanly on unmount.
  useEffect(() => () => {
    wantOn.current = false;
    try {
      ref.current?.abort();
    } catch {
      /* ignore */
    }
  }, []);

  return { supported, listening, finalText, interimText, error, start, stop, reset };
}
