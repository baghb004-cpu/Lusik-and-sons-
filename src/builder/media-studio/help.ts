// ============================================================
// Media Studio — built-in offline help (plan §26 §32)
// ============================================================
// Plain-language answers so the app never needs the internet to
// explain a file type or a how-to. Pure data; the help drawer
// renders it.
// ============================================================

export interface HelpEntry { id: string; q: string; a: string }

export const HELP: HelpEntry[] = [
  { id: "jpg", q: "What is JPG?", a: "The everyday photo format — small files, great for photos, but no see-through background. Best for product shots and web images." },
  { id: "png", q: "What is PNG?", a: "A photo/graphic format that CAN have a see-through (transparent) background. Bigger files. Best for logos and cutouts." },
  { id: "webp", q: "What is WebP?", a: "A modern web image — looks like JPG/PNG but much smaller. Great for fast websites. Can be transparent too." },
  { id: "avif", q: "What is AVIF?", a: "The newest, smallest web image. Best quality-for-size, but very old browsers may not show it." },
  { id: "heic", q: "What is HEIC?", a: "What iPhones save photos as. It's efficient but not universal — convert it to JPG or WebP when sharing." },
  { id: "tiff", q: "What is TIFF?", a: "A big, lossless image for printing and archiving. Use it for print, not the web." },
  { id: "mp4", q: "What is MP4?", a: "The most common video file — plays almost everywhere. Good default for sharing videos." },
  { id: "webm", q: "What is WebM?", a: "An open video format that's perfect for websites and fully free to use. The studio's safe default for web video." },
  { id: "mov", q: "What is MOV?", a: "Apple's video container (from iPhones/Macs). Works like MP4; convert to MP4/WebM for wide sharing." },
  { id: "codec", q: "What is a codec?", a: "The 'language' a video or audio is squeezed into. The file (like .mp4) is the box; the codec (like H.264) is how it's packed inside." },
  { id: "h264", q: "What is H.264 / H.265 / AV1?", a: "Video codecs. H.264 plays everywhere; H.265 (HEVC) is smaller but patent-licensed; AV1 is the modern, free, very-small option." },
  { id: "bitrate", q: "What is bitrate?", a: "How much data per second a video/audio uses. Higher = better quality but bigger files. Lower it to shrink a file." },
  { id: "resolution", q: "What is resolution?", a: "How many dots wide and tall (like 1920×1080). Bigger = sharper but heavier. Match it to where it'll be shown." },
  { id: "framerate", q: "What is frame rate?", a: "How many pictures per second a video shows (like 30fps). Higher feels smoother." },
  { id: "colorspace", q: "What is color space?", a: "The range of colors a file can show (sRGB for web, wider ones for print/pro). Use sRGB for websites." },
  { id: "alpha", q: "What is transparency (alpha)?", a: "A see-through background. PNG and WebP can keep it; JPG cannot. Use it for product cutouts and logos." },
  { id: "raw", q: "What is RAW?", a: "The untouched data straight off a camera sensor — maximum quality to edit, but big and needs 'developing' before sharing." },
  { id: "voicememo", q: "What is an iPhone Voice Memo?", a: "A recording from the iPhone Voice Memos app, usually a .m4a file. Import it like any audio and trim it before adding to a video." },
  { id: "android-audio", q: "What about Android recordings?", a: "Google/Samsung recorders save .m4a, .mp3, .amr, or .3gp. All can be imported; some get converted to a friendlier format on the way in." },
  { id: "import-voice", q: "How do I import a phone voice recording?", a: "Copy the file to the drive, click Import in the Media Studio, pick it, and confirm — then trim with the grab handles and place it on the timeline." },
  { id: "trim", q: "How do I trim a clip?", a: "Drag the LEFT handle to cut the start, the RIGHT handle to cut the end. Drag the middle to move it. A time tooltip shows where you are." },
  { id: "save-clip", q: "How do I save a selected range as a new clip?", a: "Set the handles, then 'Save as New Media Clip'. It makes a NEW file and keeps your original untouched." },
  { id: "narration", q: "How do I add narration to a video?", a: "Import your voice recording, drop it on an audio track under the video, and slide it to line up. Export to mix it in." },
  { id: "export-web", q: "How do I export for a website?", a: "Pick a Website preset (hero/product/thumbnail). It resizes and compresses to WebP automatically, then 'Send to Website Builder Assets'." },
  { id: "export-app", q: "How do I export for a mobile app?", a: "Pick a Mobile App preset (icon/splash). It makes the exact sizes the app builder expects." },
  { id: "export-social", q: "How do I export for social media?", a: "Pick a Social preset (square post, vertical story/reel, video thumbnail). It uses the right shape and size for that platform." },
  { id: "originals", q: "How do I keep my originals safe?", a: "You don't have to do anything — the studio never overwrites originals. Every edit becomes a new file unless you explicitly choose 'overwrite'." },
  { id: "shrink", q: "How do I reduce file size?", a: "Lower the resolution, choose WebP/AVIF for images or WebM for video, and pick a 'small file' preset. The page-weight check will confirm it's lighter." },
  { id: "proxy", q: "What is proxy editing?", a: "For big/heavy videos, the studio makes a small stand-in copy to edit smoothly, then applies your edits to the full-quality file at export." },
];

export function helpById(id: string): HelpEntry | null {
  return HELP.find((h) => h.id === id) ?? null;
}
