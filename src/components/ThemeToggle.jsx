"use client";

import React from "react";
import { Sun, Moon, Monitor } from "./icons.jsx";
import { useTheme } from "../lib/useTheme.js";

export function ThemeToggle({ compact = false }) {
  const [pref, setTheme] = useTheme();
  const options = [
    { value: "light",  Icon: Sun,     label: "Light" },
    { value: "system", Icon: Monitor, label: "Auto" },
    { value: "dark",   Icon: Moon,    label: "Dark" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center"
      style={{ border: "1px solid var(--border-strong)", padding: 2 }}
    >
      {options.map((o) => {
        const active = pref === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className="flex items-center gap-1.5 transition"
            style={{
              padding: compact ? "4px 8px" : "5px 10px",
              background: active ? "var(--ink)" : "transparent",
              color:      active ? "var(--text-on-ink)" : "var(--text-secondary)",
              fontSize: "0.6rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
            title={`${o.label} theme${o.value === "system" ? " (follow system)" : ""}`}
          >
            <o.Icon size={12} strokeWidth={1.75} />
            {!compact && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
