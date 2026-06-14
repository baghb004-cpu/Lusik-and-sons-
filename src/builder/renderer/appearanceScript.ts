// ============================================================
// Appearance — the inline scripts (pure strings, plan §19)
// ============================================================
// Two generated snippets, both built from one CORE so the logic
// can't fork:
//
//   appearanceBootstrap(candle)  — goes in <head> of every
//     exported page when appearance is enabled. Applies the
//     visitor's saved Day/Night choice and the candle state
//     (schedule, "until morning" expiry) BEFORE first paint, so
//     there is no wrong-mode flash. Pages work fine without it:
//     auto dark mode is pure CSS (prefers-color-scheme).
//
//   appearanceSwitcherScript(blockId, candle) — ships inline with
//     an appearanceSwitcher block. Embeds the same core (guarded
//     by window.__btA, so bootstrap-plus-block never double-runs),
//     un-hides the control, and wires the buttons + warmth slider.
//
// Candle semantics (the Night Shift homage with our twist):
//   - site schedule (optional): candle lights itself after dark
//   - visitor tap ON  → candle until MORNING (the schedule's end
//     time, next occurrence) — iOS's "until tomorrow"
//   - visitor tap OFF → snoozed until morning, then the schedule
//     resumes — symmetric, no stuck states
//   - warmth slider → one CSS variable (--bt-candle-a)
//
// Interpolation safety: block ids are schema-regex-gated; the
// schedule numbers come from schema-gated config (HH:MM regex,
// bounded numbers) and are serialized with JSON.stringify.
// ============================================================

import { APPEARANCE_STORAGE_KEY } from "../theme/appearance.ts";
import type { Candlelight } from "../schema/index.ts";

export function appearanceDomId(blockId: string): string {
  return `ap_${blockId}`;
}

function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Default candle config when the theme has none (manual-only candle). */
export const CANDLE_DEFAULTS: Candlelight = { warmth: 45, dim: 8, scheduled: false, start: "21:00", end: "07:00" };

// The shared core: state load/save, schedule math, apply(). Defines
// window.__btA exactly once, then applies immediately.
function coreSnippet(candle: Candlelight): string {
  const sched = JSON.stringify({
    on: candle.scheduled,
    start: hhmmToMinutes(candle.start),
    end: hhmmToMinutes(candle.end),
    warm: candle.warmth,
  });
  return `(function(){
if(window.__btA)return;
var K=${JSON.stringify(APPEARANCE_STORAGE_KEY)},S=${sched};
function load(){try{var v=JSON.parse(localStorage.getItem(K)||"{}");return v&&typeof v==="object"?v:{};}catch(e){return{};}}
function save(st){try{localStorage.setItem(K,JSON.stringify(st));}catch(e){}}
function inWin(m){return S.start<=S.end?(m>=S.start&&m<S.end):(m>=S.start||m<S.end);}
function nextEnd(){var d=new Date();d.setHours(Math.floor(S.end/60),S.end%60,0,0);if(d.getTime()<=Date.now())d.setDate(d.getDate()+1);return d.getTime();}
function warmth(st){return typeof st.warmth==="number"?Math.max(0,Math.min(100,st.warmth)):S.warm;}
function apply(){
var st=load(),root=document.documentElement,now=Date.now();
if(st.mode==="light"||st.mode==="dark")root.setAttribute("data-bt-mode",st.mode);
else root.removeAttribute("data-bt-mode");
var candle;
if(st.candleOn&&now<st.candleOn)candle=true;
else if(st.candleOff&&now<st.candleOff)candle=false;
else{var d=new Date();candle=S.on&&inWin(d.getHours()*60+d.getMinutes());}
if(candle)root.setAttribute("data-bt-candle","1");else root.removeAttribute("data-bt-candle");
root.style.setProperty("--bt-candle-a",(warmth(st)/100*0.45).toFixed(3));
}
window.__btA={load:load,save:save,apply:apply,nextEnd:nextEnd,warmth:warmth};
apply();
})();`;
}

/** The <head> anti-flash bootstrap for exported pages. */
export function appearanceBootstrap(candle: Candlelight = CANDLE_DEFAULTS): string {
  return coreSnippet(candle);
}

/** The per-block script: core (idempotent) + UI wiring. */
export function appearanceSwitcherScript(blockId: string, candle: Candlelight = CANDLE_DEFAULTS): string {
  const id = appearanceDomId(blockId);
  return `${coreSnippet(candle)}
(function(){
var el=document.getElementById(${JSON.stringify(id)}),A=window.__btA;
if(!el||!A||el.dataset.apInit)return;
el.dataset.apInit="1";
el.hidden=false;
function refresh(){
var st=A.load(),root=document.documentElement,i;
var mode=root.getAttribute("data-bt-mode")||"auto";
var btns=el.querySelectorAll("[data-ap-mode]");
for(i=0;i<btns.length;i++)btns[i].setAttribute("aria-pressed",btns[i].getAttribute("data-ap-mode")===mode?"true":"false");
var candle=root.hasAttribute("data-bt-candle");
var cb=el.querySelector("[data-ap-candle]");
if(cb)cb.setAttribute("aria-pressed",candle?"true":"false");
var row=el.querySelector("[data-ap-warmthrow]");
if(row)row.hidden=!candle;
var sl=el.querySelector("[data-ap-warmth]");
if(sl)sl.value=String(A.warmth(st));
}
el.addEventListener("click",function(e){
var t=e.target,m=t&&t.closest?t.closest("[data-ap-mode]"):null;
if(m){var st=A.load(),v=m.getAttribute("data-ap-mode");if(v==="auto")delete st.mode;else st.mode=v;A.save(st);A.apply();refresh();return;}
var c=t&&t.closest?t.closest("[data-ap-candle]"):null;
if(c){var s2=A.load();
if(document.documentElement.hasAttribute("data-bt-candle")){s2.candleOff=A.nextEnd();delete s2.candleOn;}
else{s2.candleOn=A.nextEnd();delete s2.candleOff;}
A.save(s2);A.apply();refresh();}
});
el.addEventListener("input",function(e){
var t=e.target;
if(t&&t.matches&&t.matches("[data-ap-warmth]")){var st=A.load();st.warmth=+t.value;A.save(st);document.documentElement.style.setProperty("--bt-candle-a",(st.warmth/100*0.45).toFixed(3));}
});
refresh();
})();`;
}

/**
 * Scoped CSS for one switcher: the no-JS [hidden] guard (same
 * load-bearing trick as the section jumper) and the pressed state.
 */
export function appearanceSwitcherCss(blockId: string, accent?: string): string {
  const id = appearanceDomId(blockId);
  const fill = accent ?? "var(--bt-color-accent, #B08842)";
  return `#${id}[hidden]{display:none !important;}
#${id} [data-ap-warmthrow][hidden]{display:none !important;}
#${id} [aria-pressed]{transition:background .25s ease,color .25s ease;}
#${id} [aria-pressed="true"]{background:${fill};color:#fff;border-color:transparent;}
@media (prefers-reduced-motion: reduce){#${id} [aria-pressed]{transition:none;}}`;
}
