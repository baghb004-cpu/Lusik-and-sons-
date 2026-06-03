// ============================================================
// Icons — inline SVG components matching lucide style
// ============================================================
// `Icon` is the wrapper (takes children = SVG path elements,
// + size / strokeWidth / className / style props). Every named
// icon below is a `(p) => <Icon {...p}>...paths...</Icon>` for
// tree-shakable per-icon imports:
//
//   import { Instagram, Cart, Heart } from "@/components/icons.jsx";
//
// file + the `Icon` wrapper itself = 59 exports.
//
// React-only — no other deps.
// ============================================================

import React from "react";

export const Icon = ({ children, size = 20, strokeWidth = 1.5, className = "", style = {} }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {children}
  </svg>
);
export const ShoppingBag = (p) => <Icon {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></Icon>;
export const X = (p) => <Icon {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>;
export const Mail = (p) => <Icon {...p}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></Icon>;
export const Instagram = (p) => <Icon {...p}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></Icon>;
export const Menu = (p) => <Icon {...p}><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></Icon>;
export const Plus = (p) => <Icon {...p}><path d="M5 12h14"/><path d="M12 5v14"/></Icon>;
export const Minus = (p) => <Icon {...p}><path d="M5 12h14"/></Icon>;
export const ArrowRight = (p) => <Icon {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Icon>;
export const Check = (p) => <Icon {...p}><path d="M20 6 9 17l-5-5"/></Icon>;
export const MessageCircle = (p) => <Icon {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></Icon>;
export const Copy = (p) => <Icon {...p}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></Icon>;
export const ChevronLeft = (p) => <Icon {...p}><path d="m15 18-6-6 6-6"/></Icon>;
export const ChevronRight = (p) => <Icon {...p}><path d="m9 18 6-6-6-6"/></Icon>;
export const ChevronDown = (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>;
export const Mic = (p) => <Icon {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></Icon>;
export const ChevronUp = (p) => <Icon {...p}><path d="m18 15-6-6-6 6"/></Icon>;
export const Pause = (p) => <Icon {...p}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></Icon>;
export const Play = (p) => <Icon {...p}><polygon points="6 3 20 12 6 21 6 3"/></Icon>;
export const ZoomIn = (p) => <Icon {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></Icon>;
export const Heart = (p) => <Icon {...p}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></Icon>;
export const Shield = (p) => <Icon {...p}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></Icon>;
export const Truck = (p) => <Icon {...p}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></Icon>;
export const Phone = (p) => <Icon {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></Icon>;
export const MapPin = (p) => <Icon {...p}><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></Icon>;
export const Send = (p) => <Icon {...p}><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></Icon>;
export const Sparkles = (p) => <Icon {...p}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></Icon>;
export const Share2   = (p) => <Icon {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></Icon>;
export const Bookmark = (p) => <Icon {...p}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></Icon>;
export const Trash2   = (p) => <Icon {...p}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></Icon>;
export const User = (p) => <Icon {...p}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>;
export const Home = (p) => <Icon {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Icon>;
export const Store = (p) => <Icon {...p}><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><line x1="2" x2="22" y1="9" y2="9"/><path d="M20 9v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"/><path d="M2 7v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V7"/><path d="M6 9a2 2 0 0 0 2 2 2 2 0 0 0 2-2V7"/><path d="M10 7v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V7"/><path d="M14 7v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V7"/><path d="M18 7v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V7"/></Icon>;
export const LogOut = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></Icon>;
export const Camera = (p) => <Icon {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></Icon>;
export const Eye = (p) => <Icon {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></Icon>;
export const Sun = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></Icon>;
export const Moon = (p) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>;
export const Monitor = (p) => <Icon {...p}><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></Icon>;
export const EyeOff = (p) => <Icon {...p}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></Icon>;
export const AtSign = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></Icon>;
export const XLogo = (p) => <Icon {...p}><path d="M4 4l16 16"/><path d="M20 4 4 20"/></Icon>;
export const Facebook = (p) => <Icon {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></Icon>;
export const Reddit = (p) => <Icon {...p}><circle cx="12" cy="13" r="9"/><circle cx="18" cy="5" r="2"/><path d="M16.6 6.4 13.5 11"/><circle cx="9" cy="13" r="0.8" fill="currentColor"/><circle cx="15" cy="13" r="0.8" fill="currentColor"/><path d="M8.5 16c1 1 2.2 1.4 3.5 1.4s2.5-.4 3.5-1.4"/></Icon>;
export const Discord = (p) => <Icon {...p}><path d="M7.5 5.5C9 5 10.5 4.7 12 4.7s3 .3 4.5.8L18 5c1.5 1.7 2.5 4.2 2.5 7.7 0 .5-.2 1-.5 1.3-1.5 1.5-3 2.2-5 2.5l-1-1.5"/><path d="M7.5 5.5 6 5C4.5 6.7 3.5 9.2 3.5 12.7c0 .5.2 1 .5 1.3 1.5 1.5 3 2.2 5 2.5l1-1.5"/><circle cx="9.5" cy="12" r="1" fill="currentColor"/><circle cx="14.5" cy="12" r="1" fill="currentColor"/></Icon>;
export const Telegram = (p) => <Icon {...p}><path d="M22 3 2 11l7 2 2 7 4-5 5 5z"/><path d="m9 13 6-4"/></Icon>;
export const Signal = (p) => <Icon {...p}><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z"/></Icon>;
// New platform icons. Line-art glyphs — intentionally suggestive rather than
// trademark-accurate, to fit the site's existing icon style. The platform name
// label below each icon does the identification work.
export const Snapchat = (p) => <Icon {...p}><path d="M12 3c3 0 5 2 5 5v3c0 2 1 3 3 4-1 1-2.5 1.5-4 1.5-.5 1.5-2 2.5-4 2.5s-3.5-1-4-2.5c-1.5 0-3-.5-4-1.5 2-1 3-2 3-4V8c0-3 2-5 5-5z"/></Icon>;
export const Xbox = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5c2 2.5 4 4.5 6.5 6.5 2.5-2 4.5-4 6.5-6.5"/><path d="M5.5 18.5c2-2.5 4-4.5 6.5-6.5 2.5 2 4.5 4 6.5 6.5"/></Icon>;
export const Playstation = (p) => <Icon {...p}><path d="M8 4v15l4-1V8.5c0-1 .5-1.5 1.5-1.5s2 .5 2 2-.5 2-1.5 2"/><path d="M5 16l5 2v-3l-5-2z"/><path d="M14 18l5-2v-2l-5 1z"/></Icon>;
export const Youtube = (p) => <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="3"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></Icon>;
export const WhatsApp = (p) => <Icon {...p}><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z"/><path d="M8.5 9c-.5 1 0 2.5 1.5 4s3 2 4 1.5c.5-.5.5-1 0-1.5L13 12.5l-1 .5c-.5-.5-1-1-1.5-1.5l.5-1L9.5 9.5c-.5-.5-1-.5-1 0z"/></Icon>;
export const TikTok = (p) => <Icon {...p}><path d="M16 4v8a4 4 0 1 1-4-4"/><path d="M16 4c.5 2 2 3 4 3"/></Icon>;
export const LinkedIn = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 11v6"/></Icon>;
export const Pinterest = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M11 8c2 0 4 1 4 3.5S13.5 15 12 14c-.5 2 0 4-1.5 7"/></Icon>;
export const Threads = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9 9c1-1.5 3-2 4.5-1.5S16 9 16 11s-1.5 3.5-4 3.5-4-1-4-3"/></Icon>;
export const Twitch = (p) => <Icon {...p}><path d="M4 4v14h4v3l3-3h4l5-5V4z"/><path d="M11 9v4M15 9v4"/></Icon>;
export const Kick = (p) => <Icon {...p}><path d="M5 4v16M5 12l5-5h4l-3 5 3 5h-4l-5-5"/></Icon>;
export const Messenger = (p) => <Icon {...p}><path d="M12 3c5 0 9 3.5 9 8s-4 8-9 8c-1.2 0-2.3-.2-3.3-.5L5 21l1-3.5C4 16 3 14 3 11c0-4.5 4-8 9-8z"/><path d="m7 12 3 3 3-2 3 3"/></Icon>;
export const Viber = (p) => <Icon {...p}><path d="M5 3h14c1 0 2 1 2 2v10c0 1-1 2-2 2h-3l-4 4v-4H5c-1 0-2-1-2-2V5c0-1 1-2 2-2z"/><path d="M8 9c0 3 2 5 5 5"/></Icon>;
export const PicsArt = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><path d="m3 17 5-5 4 4 3-3 6 6"/></Icon>;
export const Vevo = (p) => <Icon {...p}><path d="M3 7l4 10 4-10M13 7l4 10 4-10"/></Icon>;
export const Tumblr = (p) => <Icon {...p}><path d="M12 3v6h5M12 9v8c0 2 1 3 3 3h2v-3h-1c-1 0-1-1-1-2v-6"/><path d="M8 6c2 0 4-1 4-3"/></Icon>;
export const Teams = (p) => <Icon {...p}><rect x="3" y="7" width="11" height="11" rx="1"/><path d="M5 10h7M8.5 10v6"/><circle cx="18" cy="9" r="2.5"/><path d="M15.5 13c0-1 1-2 2.5-2s2.5 1 2.5 2v3a2 2 0 0 1-2 2h-1"/></Icon>;
export const Etsy = (p) => <Icon {...p}><path d="M7 4h11v3M7 4v16h11v-3M7 12h6M7 4v8M7 20v-8"/></Icon>;
export const BookOpen = (p) => <Icon {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></Icon>;
export const Search = (p) => <Icon {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></Icon>;
