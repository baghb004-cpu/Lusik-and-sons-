// ============================================================
// App — the shell (Chunk 0): four kept-alive tab surfaces + the
// Liquid Glass island. The web sibling of ios/LusikSons/Views/
// RootTabView.swift + GlassTabBar.swift — same tabs, same clearance
// rule (content scrolls UNDER the glass), same gliding lens, same
// haptic on switch.
// ============================================================

import React, { useState } from "react";
import { haptics } from "./lib/haptics.js";
import { ForYou } from "./tabs/ForYou.jsx";
import { Shop } from "./tabs/Shop.jsx";
import { Journal } from "./tabs/Journal.jsx";
import { Bag } from "./tabs/Bag.jsx";

const TABS = [
  { id: "forYou", label: "For You", icon: HouseIcon, surface: ForYou },
  { id: "products", label: "Products", icon: TagIcon, surface: Shop },
  { id: "journal", label: "Journal", icon: BookIcon, surface: Journal },
  { id: "bag", label: "Bag", icon: BagIcon, surface: Bag },
];

export function App() {
  const [active, setActive] = useState("forYou");
  // The real store arrives with Chunk 4; the badge plumbing is live now.
  const [bagCount] = useState(0);

  const activeIndex = TABS.findIndex((t) => t.id === active);

  return (
    <div className="app">
      {TABS.map(({ id, surface: Surface }) => (
        // Every tab stays MOUNTED (RootTabView ZStack parity) so each
        // one's scroll/nav state survives switching.
        <section key={id} className="tab-surface" hidden={id !== active}>
          <Surface />
        </section>
      ))}

      <nav className="island-wrap" aria-label="Main">
        <div className="island" role="tablist">
          <div
            className="lens"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
            aria-hidden="true"
          />
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={id === active}
              aria-label={id === "bag" && bagCount > 0 ? `Bag, ${bagCount} items` : label}
              onClick={() => {
                if (id === active) return;
                setActive(id);
                haptics.tap();
              }}
            >
              <Icon />
              {id === "bag" && bagCount > 0 && <span className="bag-bubble">{bagCount}</span>}
              <span className="tab-label">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* ── icons (SF-symbol-adjacent strokes, 20×20) ── */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13v-9.5" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 4h7l9 9-7 7-9-9z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 6c-1.8-1.6-4.4-2-8-2v14c3.6 0 6.2.4 8 2 1.8-1.6 4.4-2 8-2V4c-3.6 0-6.2.4-8 2z" />
      <path d="M12 6v14" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
