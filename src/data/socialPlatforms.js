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
  Instagram, Facebook, TikTok, Youtube, Pinterest, Threads, Etsy,
  XLogo, Snapchat, LinkedIn, Reddit, Tumblr,
  Discord, Twitch, Kick, Xbox, Playstation, PicsArt, Teams,
} from "../components/icons.jsx";

export const SOCIAL_PLATFORMS = {
  tier1: [
    { Icon: Instagram, label: "Instagram", handle: "@lusikandsons",     href: "https://www.instagram.com/lusikandsons/" },
    { Icon: Facebook,  label: "Facebook",  handle: "Lusik & Sons",      href: "https://www.facebook.com/profile.php?id=61590162116561" },
    { Icon: TikTok,    label: "TikTok",    handle: "@lusikandsons",     href: "https://tiktok.com" },
    { Icon: Youtube,   label: "YouTube",   handle: "Lusik & Sons",      href: "https://youtube.com" },
    { Icon: Pinterest, label: "Pinterest", handle: "@lusikandsons",     href: "https://pinterest.com" },
    { Icon: Threads,   label: "Threads",   handle: "@lusikandsons",     href: "https://threads.net" },
    { Icon: Etsy,      label: "Etsy",      handle: "lusikandsons",      href: "https://etsy.com" },
  ],
  tier2: [
    { Icon: XLogo,      label: "X",          handle: "@lusikandsons",   href: "https://x.com" },
    { Icon: Snapchat,   label: "Snapchat",   handle: "@lusikandsons",   href: "https://snapchat.com" },
    { Icon: LinkedIn,   label: "LinkedIn",   handle: "Lusik & Sons",    href: "https://linkedin.com" },
    { Icon: Reddit,     label: "Reddit",     handle: "u/lusikandsons",  href: "https://reddit.com" },
    { Icon: Tumblr,     label: "Tumblr",     handle: "lusikandsons",    href: "https://tumblr.com" },
    { Icon: Discord,    label: "Discord",    handle: "Join the server", href: "https://discord.com" },
    { Icon: Twitch,     label: "Twitch",     handle: "lusikandsons",    href: "https://twitch.tv" },
    { Icon: Kick,       label: "Kick",       handle: "lusikandsons",    href: "https://kick.com" },
    { Icon: Xbox,       label: "Xbox",       handle: "Lusik & Sons",    href: "https://xbox.com" },
    { Icon: Playstation,label: "PlayStation",handle: "Lusik & Sons",    href: "https://playstation.com" },
    { Icon: PicsArt,    label: "PicsArt",    handle: "@lusikandsons",   href: "https://picsart.com" },
    { Icon: Teams,      label: "Teams",      handle: "Reach us",        href: "https://teams.microsoft.com" },
  ],
};
