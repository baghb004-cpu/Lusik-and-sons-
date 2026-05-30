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

import type { ComponentType, SVGProps } from "react";
import {
  Instagram, Facebook, TikTok, Youtube, Pinterest, Threads, Etsy,
  XLogo, Snapchat, LinkedIn, Reddit, Tumblr,
  Discord, Twitch, Kick, Xbox, Playstation, PicsArt, Teams,
} from "../components/icons.jsx";

// One social-link entry. `Icon` is a lucide-style SVG component;
// the icon set is loosely typed (icons.jsx is still JS), so we
// accept any SVG-ish component here.
export interface SocialPlatform {
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;
  label: string;
  handle: string;
  href: string;
}

export interface SocialPlatformTiers {
  tier1: SocialPlatform[];
  tier2: SocialPlatform[];
}

export const SOCIAL_PLATFORMS: SocialPlatformTiers = {
  tier1: [
    { Icon: Instagram, label: "Instagram", handle: "@lusikandsons",     href: "https://www.instagram.com/lusikandsons/" },
    { Icon: Facebook,  label: "Facebook",  handle: "Lusik & Sons",      href: "https://www.facebook.com/profile.php?id=61590162116561" },
    { Icon: TikTok,    label: "TikTok",    handle: "@lusikandsons",     href: "https://www.tiktok.com/@lusikandsons" },
    { Icon: Youtube,   label: "YouTube",   handle: "Lusik & Sons",      href: "https://youtube.com" },
    { Icon: Pinterest, label: "Pinterest", handle: "@lusikandsons",     href: "https://pinterest.com" },
    { Icon: Threads,   label: "Threads",   handle: "@lusikandsons",     href: "https://threads.net" },
    { Icon: Etsy,      label: "Etsy",      handle: "lusikandsons",      href: "https://www.etsy.com/shop/lusikandsons" },
  ],
  tier2: [
    { Icon: XLogo,      label: "X",          handle: "@lusikandsons",   href: "https://x.com/lusikandsons" },
    { Icon: Snapchat,   label: "Snapchat",   handle: "@lusikandsons",   href: "https://www.snapchat.com/add/lusikandsons" },
    { Icon: LinkedIn,   label: "LinkedIn",   handle: "Lusik & Sons",    href: "https://linkedin.com" },
    { Icon: Reddit,     label: "Reddit",     handle: "u/lusikandsons",  href: "https://www.reddit.com/user/lusikandsons" },
    { Icon: Tumblr,     label: "Tumblr",     handle: "lusikandsons",    href: "https://lusikandsons.tumblr.com" },
    { Icon: Discord,    label: "Discord",    handle: "Join the server", href: "https://discord.com" },
    { Icon: Twitch,     label: "Twitch",     handle: "lusikandsons",    href: "https://twitch.tv" },
    { Icon: Kick,       label: "Kick",       handle: "lusikandsons",    href: "https://kick.com" },
    { Icon: Xbox,       label: "Xbox",       handle: "Lusik & Sons",    href: "https://xbox.com" },
    { Icon: Playstation,label: "PlayStation",handle: "Lusik & Sons",    href: "https://playstation.com" },
    { Icon: PicsArt,    label: "PicsArt",    handle: "@lusikandsons",   href: "https://picsart.com" },
    { Icon: Teams,      label: "Teams",      handle: "Reach us",        href: "https://teams.microsoft.com" },
  ],
};
