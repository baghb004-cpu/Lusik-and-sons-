// ============================================================
// SOCIAL_PLATFORMS — drawer + footer social-links data
// ============================================================
// Two tiers: tier1 is the primary set rendered in the footer
// and the social drawer at first reveal; tier2 is the longer
// list shown when the customer hits "More platforms".
//
// Each entry's `Icon` is a React component reference (not a
// string), so this file imports them from ../components/icons.jsx.
// MIRRORED FROM index.html (~line 1879).
// ============================================================

import {
  Instagram, Facebook, TikTok, Youtube, Pinterest, WhatsApp, Threads, Etsy,
  XLogo, Snapchat, LinkedIn, Messenger, Reddit, Tumblr, Telegram, Signal,
  Viber, Discord, Twitch, Kick, Xbox, Playstation, PicsArt, Vevo, Teams,
} from "../components/icons.jsx";

export const SOCIAL_PLATFORMS = {
  tier1: [
    { Icon: Instagram, label: "Instagram", handle: "@lusikandsons",     href: "https://instagram.com" },
    { Icon: Facebook,  label: "Facebook",  handle: "Lusik & Sons",      href: "https://facebook.com" },
    { Icon: TikTok,    label: "TikTok",    handle: "@lusikandsons",     href: "https://tiktok.com" },
    { Icon: Youtube,   label: "YouTube",   handle: "Lusik & Sons",      href: "https://youtube.com" },
    { Icon: Pinterest, label: "Pinterest", handle: "@lusikandsons",     href: "https://pinterest.com" },
    { Icon: WhatsApp,  label: "WhatsApp",  handle: "Message us",        href: "https://wa.me/17608742333" },
    { Icon: Threads,   label: "Threads",   handle: "@lusikandsons",     href: "https://threads.net" },
    { Icon: Etsy,      label: "Etsy",      handle: "lusikandsons",      href: "https://etsy.com" },
  ],
  tier2: [
    { Icon: XLogo,      label: "X",          handle: "@lusikandsons",   href: "https://x.com" },
    { Icon: Snapchat,   label: "Snapchat",   handle: "@lusikandsons",   href: "https://snapchat.com" },
    { Icon: LinkedIn,   label: "LinkedIn",   handle: "Lusik & Sons",    href: "https://linkedin.com" },
    { Icon: Messenger,  label: "Messenger",  handle: "Message us",      href: "https://m.me" },
    { Icon: Reddit,     label: "Reddit",     handle: "u/lusikandsons",  href: "https://reddit.com" },
    { Icon: Tumblr,     label: "Tumblr",     handle: "lusikandsons",    href: "https://tumblr.com" },
    { Icon: Telegram,   label: "Telegram",   handle: "@lusikandsons",   href: "https://telegram.org" },
    { Icon: Signal,     label: "Signal",     handle: "Message us",      href: "https://signal.org" },
    { Icon: Viber,      label: "Viber",      handle: "Message us",      href: "https://viber.com" },
    { Icon: Discord,    label: "Discord",    handle: "Join the server", href: "https://discord.com" },
    { Icon: Twitch,     label: "Twitch",     handle: "lusikandsons",    href: "https://twitch.tv" },
    { Icon: Kick,       label: "Kick",       handle: "lusikandsons",    href: "https://kick.com" },
    { Icon: Xbox,       label: "Xbox",       handle: "Lusik & Sons",    href: "https://xbox.com" },
    { Icon: Playstation,label: "PlayStation",handle: "Lusik & Sons",    href: "https://playstation.com" },
    { Icon: PicsArt,    label: "PicsArt",    handle: "@lusikandsons",   href: "https://picsart.com" },
    { Icon: Vevo,       label: "Vevo",       handle: "Lusik & Sons",    href: "https://vevo.com" },
    { Icon: Teams,      label: "Teams",      handle: "Reach us",        href: "https://teams.microsoft.com" },
  ],
};
