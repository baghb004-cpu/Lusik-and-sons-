// ============================================================
// Communication Coach — Client Outreach content pack (§28)
// ============================================================
// The local "brain" for offering website services to local
// businesses: scenarios, objections + honest multi-style replies,
// call/voicemail scripts, follow-ups, service packages, and the
// avoid/prefer phrase lists. Calm, respectful, non-pushy by design.
// Pure data — validated by schemas, exercised by tests.
// ============================================================

import type { Objection, Scenario, Script, ServicePackage, FollowUpTemplate, PhraseGuard, RoleplayScenario } from "../schemas.ts";

export const BUSINESS_TYPES = [
  "Restaurant", "Cafe", "Barbershop", "Church", "Community organization", "Dentist", "Doctor",
  "Auto repair shop", "Plumber", "Electrician", "Cleaning service", "Small retail shop",
  "Local handmade business", "Contractor", "Gym", "Tutor", "Professional office", "Local service business",
];

export const OUTREACH_SCENARIOS: Scenario[] = [
  {
    id: "no-website",
    title: "Business with no website",
    situation: "They don't appear to have a website at all.",
    openingScript:
      "Hi, my name is [USER_NAME]. I help local businesses set up clean, simple websites. I couldn't find one for [BUSINESS_NAME], so I wanted to ask — would the owner or manager be the best person to talk to about that? I'll keep it quick.",
    tips: ["Lead with helping, not selling.", "Ask for the right person early.", "Keep the first sentence short."],
    relatedObjections: ["who-are-you", "how-much", "ask-owner", "not-interested"],
  },
  {
    id: "outdated",
    title: "Business with an outdated website",
    situation: "They have a site, but it looks dated.",
    openingScript:
      "Hi, my name is [USER_NAME]. I help local businesses freshen up their websites. I came across [BUSINESS_NAME]'s site and wanted to ask if you've thought about modernizing it — no pressure, I can show a quick example of what I mean.",
    tips: ["Never insult their current site.", "Offer to show, not to lecture.", "Frame it as 'modernize', not 'fix'."],
    relatedObjections: ["site-fine", "have-someone", "how-much", "see-examples", "update-instead"],
  },
  {
    id: "slow",
    title: "Business with a slow website",
    situation: "Their site loads slowly.",
    openingScript:
      "Hi, I'm [USER_NAME] — I help local businesses with their websites. I noticed [BUSINESS_NAME]'s site takes a little while to load, which can lose visitors. I'd be glad to help speed it up. Is the owner or manager around?",
    tips: ["Tie speed to a real benefit (not losing visitors).", "Stay factual and kind."],
    relatedObjections: ["site-fine", "how-much", "update-instead"],
  },
  {
    id: "not-mobile",
    title: "Site that doesn't work well on phones",
    situation: "Their site is hard to use on mobile.",
    openingScript:
      "Hi, my name is [USER_NAME]. I help local businesses make their websites easier to use on phones. Most people look you up on a phone these days, so I wanted to ask if you'd like a quick mobile-friendly cleanup for [BUSINESS_NAME].",
    tips: ["Most customers are on phones — that's the honest hook.", "Offer a 'cleanup', which sounds small and doable."],
    relatedObjections: ["site-fine", "how-much", "update-instead"],
  },
  {
    id: "referred",
    title: "Calling after a referral",
    situation: "Someone referred you to this business.",
    openingScript:
      "Hi, my name is [USER_NAME]. [CONTACT_NAME] suggested I reach out — I help local businesses with their websites. Is this a good moment, or should I call back at a better time?",
    tips: ["Name the referrer right away — it earns trust.", "Offer to call back; respect their time."],
    relatedObjections: ["how-much", "send-info", "call-back"],
  },
  {
    id: "after-email",
    title: "Following up after an email",
    situation: "You emailed earlier and are following up.",
    openingScript:
      "Hi, this is [USER_NAME] — I sent over a short email about helping with [BUSINESS_NAME]'s website. I just wanted to check it reached you and answer any questions. No pressure at all.",
    tips: ["Reference the email so it's not a cold call.", "Make it easy to say 'not now'."],
    relatedObjections: ["send-info", "not-interested", "call-back"],
  },
  {
    id: "voicemail",
    title: "Leaving a voicemail",
    situation: "No one answered.",
    openingScript:
      "Hi, my name is [USER_NAME], and I help local businesses with clean, modern websites. I was calling about [BUSINESS_NAME] — no rush at all. If it's useful, you can reach me at [USER_PHONE]. Thanks, and have a great day.",
    tips: ["Keep it under 20 seconds.", "Say your number slowly, twice if you can.", "End warm, never pushy."],
    relatedObjections: [],
  },
  {
    id: "receptionist",
    title: "Talking to a receptionist",
    situation: "A receptionist or staff member answered.",
    openingScript:
      "Hi, my name is [USER_NAME]. I help local businesses with their websites. I don't want to take much of your time — would the owner or manager be the right person to ask about that, and is now an okay time?",
    tips: ["Be just as polite to the gatekeeper.", "Ask for the right person, don't pitch the receptionist."],
    relatedObjections: ["ask-owner", "who-are-you", "call-back"],
  },
];

export const OUTREACH_OBJECTIONS: Objection[] = [
  {
    id: "have-website",
    says: "We already have a website.",
    tags: ["common"],
    replies: [
      { style: "friendly", text: "That makes sense. I'm not calling to replace anything you already like. I was mainly reaching out to see if you ever need help modernizing it, making it more mobile-friendly, updating photos, or cleaning up the layout. Would it be okay if I sent you a quick example of what I can help with?" },
      { style: "short", text: "Got it — I'm not trying to replace it. If you ever want it modernized or made more mobile-friendly, I'd be glad to help. Okay if I send a quick example?" },
      { style: "professional", text: "Understood. Many businesses keep their site and just want it updated — mobile cleanup, fresh photos, a faster layout. If that's ever useful, I can send a short example for you to keep on file." },
    ],
  },
  {
    id: "have-someone",
    says: "We already have someone who handles that.",
    tags: ["common"],
    replies: [
      { style: "friendly", text: "Totally understandable. I'm not trying to replace anyone you're happy with. I was just reaching out in case you ever need help with updates, mobile cleanup, new pages, or a simple refresh. Would it be okay if I sent over my information in case you need help later?" },
      { style: "less-pushy", text: "That's great that you've got someone. No need to change anything — I'll just leave my info in case you ever want a second set of hands. Have a great day." },
      { style: "short", text: "Makes sense. Mind if I leave my info in case you ever need backup help with updates?" },
    ],
  },
  {
    id: "not-interested",
    says: "We are not interested.",
    tags: ["common"],
    replies: [
      { style: "less-pushy", text: "No problem at all. I appreciate your time. If you ever need help updating your website or making it more mobile-friendly, I'd be happy to help in the future. Have a great day." },
      { style: "short", text: "No problem — thanks for your time, and have a great day." },
    ],
  },
  {
    id: "how-much",
    says: "How much does it cost?",
    tags: ["pricing", "common"],
    replies: [
      { style: "friendly", text: "It depends on what you need, but I can keep it simple. A small website or refresh would usually start with a basic package, and then I can give a clearer quote after I understand the number of pages, photos, and features you want." },
      { style: "professional", text: "Pricing depends on scope, so I'd rather quote honestly than guess. A simple site or refresh starts at a basic package; once I know your pages, photos, and features, I'll give you a clear number with no surprises." },
      { style: "beginner", text: "Good question. It changes based on what you need. Small projects start small. If you tell me roughly what you're after, I can give you a fair starting range and a real quote later." },
    ],
  },
  {
    id: "send-info",
    says: "Send me information.",
    tags: ["common"],
    replies: [
      { style: "friendly", text: "Absolutely. What's the best email or phone number to send it to? I'll keep it short and include what I do, a few package options, and how I can help." },
      { style: "short", text: "Happy to. What's the best email for that? I'll keep it brief." },
    ],
  },
  {
    id: "no-budget",
    says: "We do not have the budget.",
    tags: ["pricing"],
    replies: [
      { style: "friendly", text: "Completely understandable. There are smaller options too — even a simple cleanup or a mobile fix can help without a big budget. If it's ever useful, I can share a low-cost starting option. No pressure." },
      { style: "less-pushy", text: "No worries at all. If your budget changes down the road, I'd be glad to help with something small. I'll leave my info." },
    ],
  },
  {
    id: "call-back",
    says: "Call back later.",
    tags: ["common"],
    replies: [
      { style: "friendly", text: "Of course — when's usually a better time to reach you? I'll make a note and keep it quick when I call back." },
      { style: "short", text: "Sure thing. What day or time works best for a quick callback?" },
    ],
  },
  {
    id: "who-are-you",
    says: "Who are you?",
    tags: [],
    replies: [
      { style: "simple", text: "My name is [USER_NAME]. I help local businesses with clean, modern websites — new sites, refreshes, and mobile-friendly cleanups. I was reaching out to see if that's ever useful for [BUSINESS_NAME]." },
      { style: "short", text: "I'm [USER_NAME] — I build and update websites for local businesses. Just checking if that's useful for you." },
    ],
  },
  {
    id: "see-examples",
    says: "Can I see examples?",
    tags: [],
    replies: [
      { style: "friendly", text: "Definitely. What's the best email or text number, and I'll send a couple of examples plus a short note on what I'd suggest for [BUSINESS_NAME]?" },
      { style: "short", text: "Of course — where should I send a couple of examples? Email or text works." },
    ],
  },
  {
    id: "ask-owner",
    says: "I need to ask the owner.",
    tags: [],
    replies: [
      { style: "friendly", text: "Makes sense — they should have the final say. Would it help if I sent a short summary you could pass along, or is there a better time to reach the owner directly?" },
      { style: "short", text: "Totally fair. Want me to send a short note you can pass to the owner?" },
    ],
  },
  {
    id: "too-busy",
    says: "We are too busy right now.",
    tags: [],
    replies: [
      { style: "less-pushy", text: "I hear you — I'll keep this off your plate. Is it better if I send a short note you can read whenever, or call back at a quieter time?" },
      { style: "short", text: "No problem — want me to text a short note instead so it's there when you have a sec?" },
    ],
  },
  {
    id: "social-only",
    says: "We only use Facebook or Instagram.",
    tags: [],
    replies: [
      { style: "friendly", text: "That's a great start, and a lot of customers find businesses there. A simple website can sit alongside it — somewhere people can see your hours, menu, or contact form even if they're not on social. Happy to show a quick example if that's ever useful." },
      { style: "professional", text: "Social is valuable. A small site complements it: a permanent home for hours, services, and a contact or order link that you fully own, plus it helps you show up in search. I can share an example for reference." },
    ],
  },
  {
    id: "site-fine",
    says: "Our website is fine.",
    tags: [],
    replies: [
      { style: "less-pushy", text: "That's good to hear — if it's working for you, that's what matters. If you ever want a quick second look at the mobile view or load speed, I'm glad to help. No pressure at all." },
      { style: "short", text: "Glad it's working well. I'll leave my info in case you ever want a quick mobile or speed check." },
    ],
  },
  {
    id: "tried-before",
    says: "We tried that before and it did not work.",
    tags: [],
    replies: [
      { style: "friendly", text: "I understand — that's frustrating, and I'm sorry it went that way. I try to keep things clear and honest: simple scope, a real quote, and I show you progress along the way. If you ever want to try again carefully, I'd be glad to help." },
      { style: "professional", text: "That happens more than it should. I work differently — clear scope up front, an honest quote, and regular check-ins so there are no surprises. No pressure, but I'd welcome the chance to do it right." },
    ],
  },
  {
    id: "guarantee",
    says: "Can you guarantee more customers?",
    tags: ["honesty"],
    replies: [
      { style: "professional", text: "I want to be honest with you — I can't guarantee customers, and I'd be cautious of anyone who does. What I can do is build a clean, fast, mobile-friendly site that makes it easy for people to find you and reach out. That's the part I can control and do well." },
      { style: "simple", text: "Honestly, no one can promise customers. What I can promise is a clear, modern site that makes it easy for people to find and contact you." },
    ],
  },
  {
    id: "monthly-fee",
    says: "Is this a monthly fee?",
    tags: ["pricing"],
    replies: [
      { style: "friendly", text: "Only if you want it to be. The website itself can be a one-time project. Some people add a small monthly maintenance option for updates and backups, but that's totally optional — I'll lay both out so you can choose." },
      { style: "short", text: "It can be one-time. Monthly maintenance is optional — your choice. I'll show both." },
    ],
  },
  {
    id: "how-long",
    says: "How long would it take?",
    tags: [],
    replies: [
      { style: "friendly", text: "It depends on the size, but a simple site or refresh often comes together in a couple of weeks once I have your photos and details. I'll give you a realistic timeline before we start so you know what to expect." },
      { style: "short", text: "Usually a couple of weeks for a simple site once I have your details — I'll confirm a real timeline up front." },
    ],
  },
  {
    id: "provide-photos",
    says: "Do I have to provide photos?",
    tags: [],
    replies: [
      { style: "friendly", text: "Your own photos are great when you have them since they show the real you, but it's not required. I can use clean stock images or help you take simple phone photos. We'll work with whatever you've got." },
      { style: "short", text: "Not required — your photos help, but I can use tasteful stock images or help you take a few. Whatever's easiest." },
    ],
  },
  {
    id: "update-instead",
    says: "Can you update our current website instead of making a new one?",
    tags: [],
    replies: [
      { style: "friendly", text: "Yes, often I can. If the current site is built on something I can work with, updating it is usually faster and cheaper than starting over. I'd take a quick look first and tell you honestly which option makes more sense for you." },
      { style: "professional", text: "Frequently, yes. I'd review what it's built on and recommend honestly — update vs. rebuild — based on what saves you time and money, not what's bigger for me." },
    ],
  },
];

// What NOT to say (shown as gentle warnings) and the honest alternative.
export const AVOID_PHRASES: PhraseGuard[] = [
  { match: "i guarantee more customers", why: "You can't honestly guarantee customers.", insteadTry: "I can build a clean, modern site that makes it easy for people to find and contact you." },
  { match: "your website is terrible", why: "Insulting their site is disrespectful and pushy.", insteadTry: "I noticed a few things that could be modernized — happy to show you." },
  { match: "you need this", why: "Telling someone they 'need' it is pushy.", insteadTry: "This might help — no pressure at all." },
  { match: "this will make you rich", why: "That's a false promise.", insteadTry: "I can help your business look more professional online." },
  { match: "number one on google instantly", why: "No one can honestly promise instant #1 rankings.", insteadTry: "I can set up the basics so you're easier to find; rankings take time." },
  { match: "everyone else is doing it", why: "Pressure by comparison.", insteadTry: "I'd focus on what would actually help your business." },
  { match: "you have to decide today", why: "False urgency is manipulative.", insteadTry: "Take all the time you need — no rush." },
];

// Honest phrases to encourage (shown as a quick reference).
export const PREFER_PHRASES = [
  "I can help create a clean, modern website.",
  "I can help update your current site.",
  "I can help make the site easier to use on phones.",
  "I can show you a simple example.",
  "I can give you a basic quote after I understand what you need.",
  "I do not want to waste your time.",
  "No pressure at all.",
  "Would it be okay if I sent over a short example?",
];

export const OUTREACH_SCRIPTS: Script[] = [
  {
    id: "call-open",
    kind: "call",
    title: "Opening a cold call",
    body: "Hi, my name is [USER_NAME]. I help local businesses with clean, modern websites. I was reaching out about [BUSINESS_NAME] — would the owner or manager be the best person to ask, and is now an okay time? I'll keep it quick.",
  },
  {
    id: "voicemail",
    kind: "voicemail",
    title: "Voicemail (under 20 seconds)",
    body: "Hi, this is [USER_NAME]. I help local businesses with clean, modern websites, and I was calling about [BUSINESS_NAME] — no rush at all. If it's useful, you can reach me at [USER_PHONE]. Again that's [USER_PHONE]. Thanks, and have a great day.",
  },
  {
    id: "end-polite",
    kind: "call",
    title: "Ending politely (not interested)",
    body: "No problem at all — I appreciate your time. If you ever want help updating your site or making it more mobile-friendly, I'd be glad to help down the road. Have a great day.",
  },
];

export const FOLLOW_UPS: FollowUpTemplate[] = [
  {
    id: "text-after-call",
    channel: "text",
    title: "Text after a call",
    body: "Hi [CONTACT_NAME], this is [USER_NAME] — thanks for the quick chat about [BUSINESS_NAME]'s website. Here's my info; no rush at all. Whenever you'd like a clean, mobile-friendly refresh, I'm glad to help. — [USER_PHONE]",
  },
  {
    id: "email-after-call",
    channel: "email",
    title: "Email after a call",
    subject: "A quick note about [BUSINESS_NAME]'s website",
    body: "Hi [CONTACT_NAME],\n\nThanks for taking my call. As mentioned, I help local businesses with clean, modern, mobile-friendly websites — new builds, refreshes, and simple updates.\n\nIf it's ever useful, I'd be happy to send a couple of examples and a basic quote once I understand what you need. No pressure at all.\n\nThank you for your time,\n[USER_NAME]\n[USER_PHONE]\n[USER_EMAIL]",
  },
  {
    id: "dm-intro",
    channel: "dm",
    title: "Instagram / Facebook DM",
    body: "Hi! I'm [USER_NAME] — I help local businesses with clean, mobile-friendly websites. Love what you do at [BUSINESS_NAME]. If you ever want a simple site or a refresh, I'd be glad to share an example. No pressure either way!",
  },
  {
    id: "no-response",
    channel: "email",
    title: "Gentle follow-up (no response)",
    subject: "Following up — [BUSINESS_NAME]",
    body: "Hi [CONTACT_NAME],\n\nJust floating this back to the top in case it's helpful. No worries if now isn't the time — I'm happy to be a resource whenever you'd like to freshen up [BUSINESS_NAME]'s website.\n\nThanks,\n[USER_NAME]\n[USER_PHONE]",
  },
];

export const SERVICE_PACKAGES: ServicePackage[] = [
  { id: "starter", name: "Starter Website Package", summary: "A clean, simple site to get a business online.", includes: ["Up to 3 pages (Home, About, Contact)", "Mobile-friendly layout", "Contact form", "Map + hours", "Basic on-page SEO"], startingNote: "A simple starting package — I'll give a clear quote after we talk about your pages and photos." },
  { id: "refresh", name: "Website Refresh Package", summary: "Modernize and clean up an existing site.", includes: ["New modern layout", "Updated colors + fonts", "Refreshed photos/content", "Mobile cleanup", "Speed tune-up"], startingNote: "Refreshes are often faster and cheaper than a rebuild — I'll confirm after a quick look." },
  { id: "mobile-cleanup", name: "Mobile-Friendly Cleanup", summary: "Make an existing site work well on phones.", includes: ["Responsive layout fixes", "Tap-friendly buttons", "Readable text on phones", "Faster mobile loading"], startingNote: "A small, focused project — quote after I see the current site." },
  { id: "restaurant", name: "Restaurant Website Package", summary: "Menu-forward site for cafes and restaurants.", includes: ["Menu page (easy to update)", "Hours + location + map", "Photos of food/space", "Order/reservation links", "Mobile-friendly"], startingNote: "Priced after we talk about your menu and any ordering links." },
  { id: "community", name: "Church / Community Package", summary: "Welcoming site for a church or community group.", includes: ["Events / service times", "About + contact", "Photo gallery", "Map + directions", "Mobile-friendly"], startingNote: "Often eligible for a simpler scope — I'll keep it honest and affordable." },
  { id: "small-business", name: "Small Business Package", summary: "A solid 4–6 page presence for a local business.", includes: ["4–6 pages", "Services + gallery", "Contact form + map", "Basic SEO", "Mobile-friendly"], startingNote: "Quote after we list out your pages and features." },
  { id: "ecommerce-basic", name: "Basic Online Setup", summary: "Simple way to sell or take orders/appointments.", includes: ["A few products or services", "Order or appointment links", "Mobile-friendly checkout link", "Clear contact info"], startingNote: "Scope and tools vary — I'll explain options and quote honestly." },
  { id: "maintenance", name: "Monthly Maintenance (optional)", summary: "Keep a site updated, backed up, and current.", includes: ["Small content updates", "Backups", "Plugin/security updates", "Quick fixes"], startingNote: "Completely optional and month-to-month — never required to get your site." },
  { id: "custom", name: "Custom Quote", summary: "Anything outside the standard packages.", includes: ["We discuss exactly what you need", "I scope it honestly", "You get a clear written quote"], startingNote: "No surprises — I quote after I understand the work." },
];

export const OUTREACH_ROLEPLAY: RoleplayScenario[] = [
  {
    id: "cold-call-owner",
    title: "Practice a cold call (business owner)",
    persona: "Busy business owner",
    difficulty: "beginner",
    startId: "o1",
    nodes: [
      {
        id: "o1",
        persona: "Busy business owner",
        prompt: "Hello? This is the owner. What can I do for you?",
        choices: [
          { label: "Introduce yourself politely and ask if it's an okay time.", nextId: "o2", feedback: "Great — polite, and you respected their time.", score: 3 },
          { label: "Launch straight into a long pitch about websites.", nextId: "o2", feedback: "Slow down — ask if it's a good time first.", score: 1 },
          { label: "\"Your website is really outdated, you need a new one.\"", nextId: "o2", feedback: "Too pushy and a little insulting. Lead with helping.", score: 0 },
        ],
      },
      {
        id: "o2",
        persona: "Busy business owner",
        prompt: "We already have a website, though.",
        choices: [
          { label: "\"That's great — I'm not here to replace it. I just help modernize or clean up sites if that's ever useful. Okay if I send a quick example?\"", nextId: "o3", feedback: "Perfect — calm, honest, no pressure.", score: 3 },
          { label: "\"But is it mobile-friendly? Most aren't.\"", nextId: "o3", feedback: "Okay, but softer is better — don't put them on the defensive.", score: 1 },
        ],
      },
      {
        id: "o3",
        persona: "Busy business owner",
        prompt: "Maybe. How much does something like that cost?",
        choices: [
          { label: "\"It depends on what you need, so I'd rather quote honestly. Small refreshes start small — can I learn a bit about your site and send a clear quote?\"", feedback: "Strong — honest, no made-up number.", score: 3 },
          { label: "\"I guarantee it'll pay for itself in new customers.\"", feedback: "Avoid that — you can't guarantee customers. Stay honest.", score: 0 },
          { label: "\"Whatever you can afford, really.\"", feedback: "Sounds unsure. Give an honest 'starts small, clear quote after we talk.'", score: 1 },
        ],
      },
    ],
  },
];

export const OUTREACH_FAQ = [
  { q: "What if I'm nervous?", a: "That's normal. Read the opening script once out loud, then just be polite and honest. You're offering help, not bothering anyone." },
  { q: "What if they say no?", a: "That's completely fine — thank them and leave your info. A polite 'no' today can become a 'yes' later." },
  { q: "Should I record the call?", a: "Don't record without clear permission. It's often required by law and it breaks trust. Take short notes instead." },
];
