// ============================================================
// Video block — the privacy-facade upgrade script (pure strings)
// ============================================================
// A YouTube/Vimeo block renders as a plain ANCHOR to the video
// (zero JS, zero third-party requests — works everywhere, even in
// a no-JS static export). This snippet, inlined with the block
// (the sectionJumper pattern), upgrades the click: instead of
// leaving the site, the facade swaps itself for an inline
// privacy-respecting embed (youtube-nocookie / player.vimeo with
// dnt) — so the third-party request happens ONLY after the
// visitor explicitly chose to play.
//
// Interpolation safety: block ids are schema-regex-gated and the
// video id is schema-regex-gated per provider ([A-Za-z0-9_-]{6,15}
// / digits), then JSON.stringified into the embed URL.
// ============================================================

export function videoDomId(blockId: string): string {
  return `vf_${blockId}`;
}

export function videoEmbedUrl(kind: "youtube" | "vimeo", videoId: string): string {
  return kind === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`
    : `https://player.vimeo.com/video/${videoId}?autoplay=1&dnt=1`;
}

export function videoWatchUrl(kind: "youtube" | "vimeo", videoId: string): string {
  return kind === "youtube"
    ? `https://www.youtube.com/watch?v=${videoId}`
    : `https://vimeo.com/${videoId}`;
}

export function videoFacadeScript(blockId: string, kind: "youtube" | "vimeo", videoId: string): string {
  const id = videoDomId(blockId);
  const embed = videoEmbedUrl(kind, videoId);
  return `(function(){
var a=document.getElementById(${JSON.stringify(id)});
if(!a||a.dataset.vfInit)return;
a.dataset.vfInit="1";
a.addEventListener("click",function(e){
e.preventDefault();
var f=document.createElement("iframe");
f.src=${JSON.stringify(embed)};
f.allow="autoplay; fullscreen; picture-in-picture";
f.allowFullscreen=true;
f.title=a.getAttribute("aria-label")||"Video";
f.style.cssText="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:inherit;";
a.parentElement.appendChild(f);
a.remove();
},{once:true});
})();`;
}
