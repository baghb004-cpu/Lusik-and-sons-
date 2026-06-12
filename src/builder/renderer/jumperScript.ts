// ============================================================
// Section jumper — the inline enhancement script (pure strings)
// ============================================================
// The sectionJumper block (the floating ▲/▼ buttons that hop a
// page section-by-section, like the events-site recording Baghdo
// shared) is the one block that needs a few lines of JavaScript:
// "scroll to the NEXT section from wherever I am" cannot be
// expressed in CSS. This module builds that script — and the
// block's scoped highlight CSS — as plain strings, so:
//
//   - it ships INLINE with the block's markup (static export,
//     PWA export and the SSR'd live site all carry it with zero
//     extra files or network requests),
//   - it stays a PROGRESSIVE enhancement: the nav renders with
//     `hidden` and the script's first act is to un-hide it, so a
//     no-JS visitor simply never sees buttons that wouldn't work,
//   - it is unit-testable in Node (no DOM needed to assert the
//     contract: reduced-motion honored, id-scoped, no eval).
//
// Interpolation safety: the only dynamic values are the block id
// (schema-regex-gated: ^[a-z]+_[A-Za-z0-9]{8,}$), a stops KEY
// resolved through the fixed map below, and an accent that is
// either a schema-gated hex or our own var() literal. Nothing
// user-typed reaches the script body.
// ============================================================

/** What counts as a "stop" the buttons hop between. Keys are the
 *  schema enum; values are the querySelector the script runs. */
export const JUMPER_STOP_SELECTORS: Record<string, string> = {
  sections: "main section",
  headings: "main h1, main h2",
};

/** DOM id for a jumper nav (block ids are regex-gated, so this is safe). */
export function jumperDomId(blockId: string): string {
  return `sj_${blockId}`;
}

/**
 * The enhancement script for one jumper nav.
 *  - un-hides the nav (no-JS visitors never see dead buttons)
 *  - ▼ scrolls to the first stop below the current scroll, else page end
 *  - ▲ scrolls to the last stop above, else page top
 *  - honors prefers-reduced-motion (instant jump instead of smooth)
 *  - keeps data-pos="top|mid|bottom" fresh so the CSS can highlight
 *    the useful direction and dim the dead one (the recording's
 *    orange-vs-glass treatment)
 */
export function sectionJumperScript(blockId: string): string {
  const id = jumperDomId(blockId);
  return `(function(){
var nav=document.getElementById(${JSON.stringify(id)});
if(!nav||nav.dataset.sjInit)return;
nav.dataset.sjInit="1";
nav.hidden=false;
var sel=nav.getAttribute("data-stops")||"main section";
function stops(){var out=[],all=document.querySelectorAll(sel),i;for(i=0;i<all.length;i++){if(!nav.contains(all[i])&&all[i].offsetHeight>0)out.push(all[i]);}return out;}
function maxY(){return Math.max(0,document.documentElement.scrollHeight-window.innerHeight);}
function jump(dir){
var y=window.scrollY,pad=12,t=null,list=stops(),i,top;
if(dir>0){for(i=0;i<list.length;i++){top=list[i].getBoundingClientRect().top+y;if(top>y+pad){t=top;break;}}if(t===null)t=maxY();}
else{for(i=list.length-1;i>=0;i--){top=list[i].getBoundingClientRect().top+y;if(top<y-pad){t=top;break;}}if(t===null)t=0;}
var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
window.scrollTo({top:Math.min(t,maxY()),left:0,behavior:rm?"auto":"smooth"});
}
nav.addEventListener("click",function(e){var el=e.target,b=el&&el.closest?el.closest("[data-jump]"):null;if(!b)return;e.preventDefault();jump(b.getAttribute("data-jump")==="next"?1:-1);});
function pos(){var y=window.scrollY;nav.setAttribute("data-pos",y<8?"top":(y>=maxY()-8?"bottom":"mid"));}
window.addEventListener("scroll",pos,{passive:true});
window.addEventListener("resize",pos);
pos();
})();`;
}

/**
 * Scoped CSS for the highlight states. The "useful" direction gets the
 * accent fill (▼ until the page bottom, ▲ once you're there); the dead
 * direction at an edge dims. `accent` is a schema-gated hex or, when
 * omitted, the theme's accent variable.
 */
export function sectionJumperCss(blockId: string, accent?: string): string {
  const id = jumperDomId(blockId);
  const fill = accent ?? "var(--bt-color-accent, #B08842)";
  // The [hidden] guard is load-bearing: the nav carries display:flex
  // classes, which would beat the UA's [hidden]{display:none} rule —
  // without this line, a no-JS visitor sees buttons that do nothing.
  return `#${id}[hidden]{display:none !important;}
#${id} [data-jump]{transition:background .25s ease,color .25s ease,opacity .25s ease;}
#${id}[data-pos="top"] [data-jump="prev"],#${id}[data-pos="bottom"] [data-jump="next"]{opacity:.45;}
#${id}[data-pos="top"] [data-jump="next"],#${id}[data-pos="mid"] [data-jump="next"],#${id}[data-pos="bottom"] [data-jump="prev"]{background:${fill};color:#fff;border-color:transparent;}
@media (prefers-reduced-motion: reduce){#${id} [data-jump]{transition:none;}}`;
}
