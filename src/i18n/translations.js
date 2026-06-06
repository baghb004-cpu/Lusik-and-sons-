// ============================================================
// TRANSLATIONS — i18n string tables (en, hy, hyw)
// ============================================================
// One top-level key per language code. Missing keys fall back
// to English via the useT() resolver. Eastern Armenian (hy) is
// the only non-English language currently surfaced to users;
// Western Armenian (hyw) is staged for Lusik's review.
//
// Every Armenian string is auto-translated and marked
// TODO_LUSIK_REVIEW in the source — Lusik (or any native
// speaker she trusts) should read through and flag anything
// that's awkward or wrong. Don't silently "fix" those markers
// without her sign-off; the literal English copy may be more
// idiomatic for the audience.
//
// but pure string data — no React, no React-tree deps.
// ============================================================

export const TRANSLATIONS = {
  // ============================================================
  // ENGLISH — the canonical source. Every key the app uses lives here.
  // Other languages may have subsets; missing keys fall back to English.
  // ============================================================
  en: {
    // Navigation (desktop + mobile)
    nav: {
      blanket: "The Blanket",
      custom: "Custom Orders",
      story: "Our Story",
      faq: "FAQ",
      shipping: "Shipping",
      contact: "Contact",
      cart: "Cart",
      account: "Account",
      signIn: "Sign in",
      connect: "Connect",
    },
    announce: "Hand cross-stitched in Southern California — by Lusik, for the families who'll keep it",

    // Hero / homepage
    hero: {
      // Two-clause headline. The italic part is the "made to last"
      // positioning — heirloom framing without using that word. The
      // first clause names the maker, which is the most ownable
      // brand asset (since Lusik makes blankets, bibs, blessings,
      // hats, towels — the maker is the constant, the products vary).
      headline: "Stitched by Lusik.",
      headlineEm: "Kept by your family",
      // Body intentionally avoids any one product category. Lists
      // three of the categories Lusik actually makes (blankets,
      // bibs, blessings) without claiming exclusivity, and surfaces
      // the "& Sons" piece of the brand name. Custom-letter requests
      // are handled by the dedicated Custom Requests trust badge
      // popover below the hero, so we don't need an inline email
      // link in the body anymore.
      body: "From her home in Southern California, Lusik cross-stitches blankets, bibs, and blessings — every piece by hand, every piece made for one specific child. Her sons run the website. Mom does the stitching. We do the typing.",
      // Mobile-only variant — the hero eyebrow already names the region, so
      // the phone body drops the location clause to avoid repeating it.
      // Desktop keeps the full `body` above.
      bodyShort: "From her home, Lusik cross-stitches blankets, bibs, and blessings — every piece by hand, every piece made for one specific child. Her sons run the website. Mom does the stitching. We do the typing.",
      shopCta: "See what Lusik makes",
      storyCta: "Meet Lusik",
      callout1: "By Lusik's own hand",
      callout2: "Made to order",
      // Rotating caption — one short italic line per hero slide,
      // appears between the H1 and the body copy. Sequenced to
      // match HERO_PHOTOS in HeroSlideshow.jsx (index for index).
      // 4–6 words each so the swap feels like a quiet caption, not
      // a competing headline.
      captions: [
        "An alphabet, letter by letter.",
        "Sets for the first day home.",
        "A name on every bib.",
        "Small cloths for the smallest days.",
        "Blessings, framed in thread.",
        "For the very first head.",
      ],
    },

    // First-visit language banner
    langBanner: {
      title: "Welcome",
      body: "Would you like to view this site in Armenian?",
      western: "Հայերէն",
      westernSub: "Western",
      eastern: "Հայերեն",
      easternSub: "Eastern",
      english: "English",
      keepEnglish: "Continue in English",
      footnote: "You can change your language anytime from the footer.",
    },
    langToggle: { label: "Language" },

    // Beta translation badge — shown when non-English is active
    betaBadge: {
      label: "Beta translation",
      body: "This translation is still being reviewed. If anything looks unclear, please email us — we'll fix it right away.",
    },

    // Common buttons / shared phrases
    common: {
      addToCart: "Add to Bag",
      continueShopping: "Continue shopping",
      close: "Close",
      readMore: "Read more",
      showLess: "Show less",
      learnMore: "Learn more",
      email: "Email",
      call: "Call",
      dm: "DM",
      yes: "Yes",
      no: "No",
      cancel: "Cancel",
      save: "Save",
      remove: "Remove",
      edit: "Edit",
      loading: "Loading…",
      backHome: "← Back to home",
    },

    // Product page (blanket)
    product: {
      madeToOrder: "Made to order · Southern California",
      limited: "Limited to first {n} orders.",
      premium: "Premium variant — alphabet stitched twice (six letter squares).",
      step1: "1. Choose your alphabet",
      step2: "2. Choose the layout",
      yourBlanket: "Your blanket",
      details: "Details · size · care",
      armenianLabel: "Armenian",
      englishLabel: "English",
      transliterationArmenian: "Ayb · Ben · Gim",
      transliterationEnglish: "A · B · C",
      lettersOnly: "letters",
      letterSingular: "letter",
      emailForOther: "For other letters or special requests, ",
      emailLink: "email Lusik",
      quantity: "Quantity",
    },

    // Story section
    story: {
      eyebrow: "Our Story",
      title: "Lusik came to Los Angeles in the late 1970s.",
      p1: "She brought a cross-stitch hoop, a few skeins of red and gold thread, and a way of working her mother and grandmother had taught her in Armenia — slow, even stitches that build a letter one small X at a time.",
      p2: "She has been making these pieces, by hand, ever since. Her sons run this website. She does the stitching. Mom does the work; we do the typing.",
      p3: "Every blanket is made to order. Lusik picks up each one when it's ready, sits with it on her kitchen table, and personally checks it before it goes in the box for your family.",
      meetLusik: "Meet Lusik",
    },

    // Contact / Reach Us drawer
    contact: {
      eyebrow: "Reach Us",
      title: "However you like.",
      directLine: "Direct line",
      callLabel: "Call us",
      emailLabel: "Email",
      byPost: "By Post",
      mailPickup: "Mail pickup hours",
      online: "Find us online",
      onlineNote: "Some of these accounts are still being set up. If a link hasn't lit up yet, please write — we'll answer the email faster than the algorithm anyway.",
      moreWays: "More ways to reach us",
      tagline: "Lusik writes back herself, in her own time, in her own voice.",
    },

    // Footer
    footer: {
      brand: "Hand cross-stitched baby blankets with the Armenian alphabet — Ա Բ Գ — or English A B C. By Lusik herself, from her home in Southern California. Made to order, made to last.",
      tagline: "Mom does the stitching. We do the typing.",
      shop: "Shop",
      help: "Help & Policies",
      findUs: "Find Us",
      shippingTracking: "Shipping & Tracking",
      finalSalePolicy: "Final Sale Policy",
      privacyPolicy: "Privacy Policy",
      termsOfService: "Terms of Service",
      contactUs: "Contact Us",
      repliesNote: "Lusik writes back herself, usually within a day.",
      trustMade: "Made by Lusik in Southern California",
      trustSecure: "Secure checkout powered by Stripe",
      trustShips: "Ships within the United States",
      copyright: "© {year} Lusik & Sons™. Original designs, photographs & text — all rights reserved.",
      thanks: "Շնորհակալություն",
      thanksEn: "Thank you",
      madeWith: "Made with patience in Southern California",
    },

    // Text-us widget
    textUs: {
      directLine: "Direct line",
      headline: "Send us a text.",
      subhead: "Lusik or one of her sons writes back, usually within a day.",
      textNow: "Text us now",
      preferToCall: "Prefer to call? ",
      rates: "Standard message rates apply · We never share your number",
      proactiveQ: "Can we help you find something?",
      proactiveSub: "Lusik usually writes back within a day.",
      chatNow: "Start a conversation",
      noThanks: "No thanks",
    },

    // Cart drawer
    cart: {
      title: "Your cart",
      empty: "Your cart is empty.",
      keepShopping: "Keep shopping",
      subtotal: "Subtotal",
      taxNote: "Tax and shipping calculated at checkout.",
      checkout: "Checkout",
    },

    // Auth drawer (sign in / sign up / forgot password)
    auth: {
      signIn: "Sign in",
      signUp: "Create account",
      signOut: "Sign out",
      forgot: "Forgot password?",
      noAccount: "Don't have an account?",
      hasAccount: "Already have an account?",
      emailLabel: "Email address",
      passwordLabel: "Password",
      nameLabel: "Name",
      welcomeBack: "Welcome back",
      createAccount: "Create your account",
      resetPassword: "Reset your password",
      resetBody: "Enter your email and we'll send you a link to reset your password.",
      sendResetLink: "Send reset link",
      checkEmail: "Check your email for a reset link.",
      backToSignIn: "← Back to sign in",
      submit: "Continue",
    },

    // Account view
    account: {
      title: "Your account",
      hello: "Hello, {name}",
      orderHistory: "Order History",
      savedAddresses: "Saved Addresses",
      yourInfo: "Your Info",
      noOrders: "Nothing in your hands yet — but the first piece is waiting whenever you are.",
      shopFirstBlanket: "Choose your first blanket",
    },

    // Custom product cards (bib, towel)
    custom: {
      eyebrow: "Custom Orders",
      title: "Custom orders",
      subtitle: "Bibs and towels with your child's letter or image — Lusik will stitch the exact one you want.",
      bibTitle: "Baby Bib",
      bibSubtitle: "Embroidered with your child's name — in Armenian or English.",
      bibMachine: "Machine embroidered",
      bibMachineNote: "Type a short name (up to five or six letters). Lusik confirms the placement with you before a single stitch goes in.",
      towelTitle: "Custom Embroidered Towel",
      towelSubtitle: "Upload an image; we machine-embroider it.",
      uploadImage: "Upload image (PNG/JPEG, max 5 MB)",
      chooseFile: "Choose file",
      noFile: "No file chosen",
      pickLetter: "Pick a letter",
    },

    // Product-variation disclaimer — shown on product/bib pages, in the
    // bag, and in the FAQ. Protects the business: the photos are samples,
    // and a handmade piece (especially the bib's neck closure) may differ.
    disclaimer: {
      heading: "About these photos",
      short: "Photos show examples of past work — your handmade piece may vary a little.",
      full: "Photos shown are examples of past work. Because each piece is handmade and materials may change over time, the exact fabric, trim, closure style, colors, and details may vary from the photos shown. Each order is made with care, but it may not be an exact copy of the sample photo.",
      bibClosure: "Current bibs may use a different neck closure than the examples pictured.",
    },

    // Mobile bottom-nav tabs + the floating search orb/pill (lg:hidden).
    mobileNav: {
      forYou: "For You",
      products: "Products",
      journal: "Journal",
      bag: "Bag",
      search: "Search",
      searchPlaceholder: "What are you looking for?",
      clearSearch: "Clear search text",
      voiceSearch: "Search by voice",
      stopListening: "Stop listening",
      dismissKeyboard: "Dismiss keyboard",
      openBag: "Open bag",
      goForYou: "Go to the For You page",
      backToForYou: "Back to the For You page",
    },

    // Mobile full-screen search page.
    search: {
      title: "Search",
      recentlyViewed: "Recently Viewed",
      recentSearches: "Recent Searches",
      trySearching: "Try Searching",
      clear: "Clear",
      noResults: "No results for “{q}”",
      noResultsHint: "Try a different search, or browse the shop.",
      from: "From ${price}",
      comingSoon: "Coming soon",
      journalTag: "Journal",
      sectionTag: "Site section",
      yourAccount: "Your account",
      sections: {
        faq: "FAQ",
        shipping: "Shipping & Returns",
        contact: "Contact Us",
        story: "Our Story",
      },
      // `label` is displayed (translatable); `query` is the English search
      // term we actually run against the catalog, so matching keeps working.
      suggestions: [
        { label: "Armenian alphabet blanket", query: "Armenian alphabet blanket" },
        { label: "Baptism towel", query: "Baptism towel" },
        { label: "Bari akhorzhak", query: "Bari akhorzhak" },
        { label: "Alphabet crib blanket", query: "Alphabet crib blanket" },
        { label: "Shipping", query: "Shipping" },
        { label: "Refund policy", query: "Refund policy" },
      ],
    },

    // Bag / cart page + drawer (extends the shorter `cart` block above).
    bag: {
      title: "Bag",
      emptyPage: "Your bag is empty.",
      emptyDrawer: "Your cart is empty.",
      emptyUser: "Continue browsing Lusik & Sons or open a design you’ve previously saved.",
      emptyGuest: "Continue browsing Lusik & Sons to start your blanket.",
      shopBlanket: "Shop the blanket",
      openSaved: "Or open a saved design →",
      custom: "Custom",
      qty: "Qty:",
      removeItem: "Remove from cart",
      edit: "Edit",
      doneEditing: "Done editing cart",
      closeCart: "Close cart",
      customOrders: "Custom orders:",
      customOrdersBody: "Your uploaded designs are saved with your order. We'll email you a proof of your stitched design before running it through the embroidery machine.",
      madeToOrderNote: "Made to order — every blanket starts after Lusik receives your order.",
      checkout: "Checkout",
      orderDetails: "Order details & policies",
      dmInstagram: "DM us on Instagram",
      orderViaPre: "Or ",
      orderViaPost: " to order",
      agreePre: "By placing your order you agree to our ",
      terms: "Terms",
      privacy: "Privacy",
      finalSale: "Final Sale",
      agreePost: " policies.",
    },

    // Mobile "Need help deciding?" / "Still have questions?" contact block + FAQ.
    help: {
      stillQuestions: "Still have questions?",
      stillSubline: "Lusik or one of her sons will help.",
      needHelp: "Need help deciding?",
      stillNeedHelp: "Still need help deciding?",
      textUs: "Text us",
      callUs: "Call us",
      emailUs: "Email us",
      videoCall: "Video call",
      lede: "Have a question about a piece? Lusik or one of her sons will be with you shortly.",
      frequentlyAsked: "Frequently asked",
      faq: [
        { q: "What happens on a video call?", a: "You book a time and Lusik (or one of her sons) hops on a quick video call. She'll walk you through the blankets, show you thread colors and fabric up close, and help you decide on an alphabet, a name, and a layout. You don't have to be on camera if you'd rather not." },
        { q: "Can you help me pick colors and a name?", a: "That's exactly what these chats are for. Bring the nursery palette, a sibling's blanket, or just a feeling — Lusik will help you land on a combination that looks right and stitches well. Nothing is ordered until you're happy with it." },
        { q: "What if I'd rather just text or email?", a: "Totally fine — most people do. Tap Text us or Email us above and write in whatever's on your mind. Lusik writes back herself when she can, otherwise one of her sons does, usually within a day." },
        { q: "How long does a finished piece take?", a: "Each blanket is hand cross-stitched to order, so most take about 5–10 business days once the design is set. You'll get a photo before it ships and a tracking link when it's on its way." },
        { q: "Do you offer local pickup?", a: "Yes — if you're in the Orange County or Los Angeles area, you can pick up your order in person and skip shipping. Just message Lusik (Text us or Email us) after you order and we'll arrange a time and place. Everywhere else in the U.S. ships free." },
        { q: "Will my piece look exactly like the photos?", a: "The photos are examples of past work. Because every piece is made by hand and materials change over time, the exact fabric, trim, closure style, and colors may vary a little — current bibs may even use a different neck closure than older photos show. Each order is made with the same care, but it isn't an exact copy of the sample photo." },
      ],
    },

    // Mobile per-page large titles (MobilePageHeader, keyed by view).
    pageTitles: {
      home: "For You",
      shop: "Shop",
      journal: "Journal",
      account: "Your Account",
      gallery: "Gallery",
      checkout: "Checkout",
    },

    // Mobile "For You" home feed (the curated card + section headings).
    forYou: {
      weThink: "We think you'll love",
      selectedForYou: "Selected for you",
      featuredName: "The Armenian Alphabet Blanket",
      exploreRest: "Explore the rest",
      recentActivity: "Your recent activity",
      more: "More",
    },

    // Home "Explore" cards — the entry points to each section page.
    explore: {
      shop: { title: "Shop", blurb: "Blankets, bibs & towels" },
      story: { title: "Our Story", blurb: "Armenia → California" },
      workshop: { title: "From Lusik's Workshop", blurb: "Past blankets, real families" },
      journal: { title: "The Journal", blurb: "On Armenian craft" },
      faq: { title: "Good Questions", blurb: "How it's made & sent" },
      shipping: { title: "Shipping & Tracking", blurb: "How your piece gets home" },
      contact: { title: "Contact Lusik", blurb: "Four ways to reach us" },
      newsletter: { title: "Stay Connected", blurb: "The occasional note" },
    },

    // /shop hierarchy chrome + editorial (ShopIndexView, CategoryView).
    shop: {
      breadcrumbHome: "Home",
      browseBy: "Browse by category",
      view: "View",
      viewAria: "View {name}",
      browseAria: "Browse {label}",
      readAria: "Read {title}",
      comingSoonAria: "{name} — coming soon",
      from: "From ${price}",
      stepIn: "Step in",
      byDirectOrder: "By direct order",
      writeMe: "Write me",
      almostReady: "Almost ready",
      lusikHands: "Lusik's hands first",
      journal: "Journal",
      readMin: "Read · {min} min",
      newest: "Newest",
      discoverNew: "Discover what's new",
      featuredPieces: "Featured pieces",
      shopCollection: "Shop the collection",
      fromJournal: "From the Journal",
      theShop: "The shop",
      everythingPre: "Everything Lusik ",
      everythingEm: "makes",
      intro: "Cross-stitched blankets for the crib. Embroidered bibs for the kitchen table. Ceremonial towels for the days that count. Small fabric objects for the very first weeks. Each piece by Lusik's own hand, from her home in Southern California — made to order, made to last. Pick a category to step in.",
      availableNow: "{n} available now",
      comingSoonCount: "{n} coming soon",
      madeToOrder: "Made to order",
      byOrder: "${price} · by order",
      differenceHeading: "The Lusik & Sons difference",
      newestName: "The Bari Akhorzhak Bib & Burp Cloth Set",
      newestTagline: "Two Armenian meal blessings, one matched set.",
      featured: [
        { eyebrow: "Lusik's signature", name: "The Armenian Alphabet Blanket", tagline: "Ա Բ Գ, hand cross-stitched corner to corner.", price: "From $65" },
        { eyebrow: "The heirloom", name: "The Full Alphabet Crib Blanket", tagline: "Every letter of the Armenian alphabet, all thirty-six.", price: "By direct order · $245" },
        { eyebrow: "For every day", name: "The Custom Name Bib", tagline: "Your child's name, in Armenian or English.", price: "From $22" },
      ],
      difference: [
        { text: "Made to order, made to last. Every stitch set down by Lusik's own hand.", linkLabel: "Shop the blankets" },
        { text: "From her home in Southern California — stitched for yours.", linkLabel: "Read Lusik's journal" },
        { text: "Your child's name and birth year, woven into the cloth — in Armenian or English.", linkLabel: "Personalize a blanket" },
      ],
    },

    // Coming-soon / commission product page (ProductPlaceholderView).
    placeholder: {
      comingSoon: "Coming soon",
      comingSoonBody: "Lusik is finishing the first piece of this one on her kitchen table. Photographs will go here the moment it's ready for the world to see.",
      byDirectOrderEyebrow: "By direct order · From Lusik's home in Southern California",
      almostReadyEyebrow: "Almost ready · Southern California",
      checkoutNotOpen: "Online checkout for this piece isn't open yet — but the price is set and Lusik takes commissions directly. Write or call to start one, and she'll write back herself within a day.",
      priceComingSoon: "Price coming soon",
      unpricedBody: "Lusik is still settling on what to charge for this lineup — she likes to hold a piece in her hands before naming a price. Leave your email below and we'll write you the moment it's listed.",
      detailsHeading: "Details · size · care",
      writeToCommission: "Write Lusik to commission this",
      orCall: "Or call (760) 874-2333",
      commissionNote: "Lusik or one of her sons writes back, usually within a day. We'll talk through the colorway, the alphabet, the date you need it by, and confirm the price before stitching begins.",
      orWaitListing: "Or wait for the listing",
      waitListingBody: "We're working toward opening online checkout for this piece. If you'd rather wait, we'll write you the day it goes live.",
      addToList: "Add me to the list",
      currentlyUnavailable: "Currently unavailable",
      currentlyUnavailableAria: "Currently unavailable — see the Notify me option below",
      writeWhenReady: "Write me when it's ready",
      oneNote: "One note the day it lists — nothing else, ever.",
      orWriteLusik: "Or write to Lusik",
      customRequestBody: "If you'd rather not wait for the public listing — or you have a question Lusik should answer herself — send her a note.",
    },

    // Blanket configurator (ProductShowcase). Step labels, toggles, the color
    // picker, optional personalization, save/share, CTAs, delivery. Product
    // copy itself (description, specs, alphabet/layout/color names) is data.
    pdp: {
      madeToOrderEyebrow: "Made to order · From Lusik's home in Southern California",
      premiumNote: "The premium layout — the alphabet stitched twice, six letter-squares across the blanket.",
      standardNote: "Hand cross-stitched by Lusik · made to order, made to last.",
      step1: "1. Choose your alphabet",
      step2: "2. Choose the layout",
      step3: "3. Choose your colors",
      step4: "4. Optional personalization",
      letters: "{n} letters",
      lettersWord: "letters",
      forDifferentLetterPre: " For a different letter or a name you'd like spelled out, ",
      writeLusikDirectly: "write Lusik directly",
      forDifferentLetterPost: " — she always reads them herself.",
      cube: "cube",
      letter: "letter",
      colorIntro: "Lusik picks the thread for each blanket from whatever spools she has on hand the week she stitches yours. Small variations between blankets are how you know one woman made it.",
      presets: "Presets",
      pickYourOwn: "Pick your own",
      blockColorLabel: "Block outline color (the 3D cube)",
      letterColorLabel: "Letter color (inside the cube)",
      selected: "Selected:",
      doneCollapse: "Done — collapse this section",
      willEmbroider: "Will be embroidered on the blanket",
      noOptionalText: "No optional text",
      shipsAlphabet: "Blanket will ship with just the alphabet",
      personalizationIntro: "Two short lines Lusik can place on a free square of the blanket — your child's name, a year, a date that mattered. Both optional. Leave them blank and the blanket ships with just the alphabet, no extra charge either way.",
      line1Label: "Line 1 — name, nickname, or initials",
      line1Placeholder: "e.g. ANNA",
      line1Aria: "Optional first line of personalized text",
      line2Label: "Line 2 — birth year or date",
      line2Placeholder: "e.g. 2025",
      line2Aria: "Optional second line of personalized text",
      upToChars: "Up to 6 characters · {n}/6",
      realExample: "Real example",
      skipNoText: "Skip — no optional text",
      yourBlanket: "Your blanket",
      saveDesign: "Save design",
      saving: "Saving…",
      saved: "Saved ✓",
      saveAria: "Save this design to your account",
      saveTitleUser: "Save to your account so you can come back to it later",
      saveTitleGuest: "Sign in to save designs",
      share: "Share",
      shareAria: "Share this design",
      shareTitle: "Get a second opinion before you order",
      saveHintUser: "Saved designs live in your account — pick up where you left off any time.",
      saveHintGuest: "Sign in to save your design and pick up where you left off later.",
      alphabetLabel: "{label} alphabet — {translit}",
      cubeOutline: "{name} cube outline",
      letterInside: "{name} letter inside",
      finalSale: "FINAL SALE —",
      finalSaleBody: "This blanket is stitched specifically for you, so all sales are final. No returns, exchanges, or refunds. Please review your alphabet, colors, and any name or year before checking out.",
      readPolicy: "Read the full policy",
      buyNow: "Buy it now",
      ships: "Ships {date}",
      arrives: " · arrives {date}",
      deliveryNote: "Based on Lusik's current production time and ground shipping to a U.S. address.",
      yourDesign: "Your design",
      realPhotos: "Real photos",
      livePreviewCaption: "A live preview of how your blanket will look. The real piece has the woven pomegranate texture and the fringed edges — tap \"Real photos\" to see the cloth Lusik works on.",
      zoomPhotoAria: "Zoom photo {n} of {m}",
      prevPhoto: "Previous photo",
      nextPhoto: "Next photo",
      tapToZoom: "Tap to zoom",
      closeZoom: "Close zoomed photo",
    },

    // Bib configurator (CustomProductCard).
    bib: {
      errSize: "Please choose a size.",
      errName: "Please type a name to embroider.",
      errTooLong: "Name must be {n} letters or fewer — the bib is small.",
      previewHint: "Type your child's name to see how Lusik will stitch it",
      step1Name: "1. Personalized name",
      namePlaceholder: "e.g. Anna",
      nameAria: "Personalized name to embroider",
      upToLetters: "Up to {n} letters · {len}/{n}",
      previewOnly: "Preview only — actual embroidery font may differ slightly.",
      step2Color: "2. Thread color",
      lusiksPicks: "Lusik's Picks",
      pickYourOwn: "Pick your own",
      selected: "Selected:",
      chooseSize: "{step} Choose a size",
      finalSale: "FINAL SALE —",
      finalSaleBody: "Embroidered specifically for you. No returns, exchanges, or refunds.",
      readPolicy: "Read the full policy",
      buyNow: "Buy it now",
      othersEyebrow: "From other families' kitchens",
      othersTitlePre: "Real bibs Lusik has ",
      othersTitleEm: "stitched",
      othersTitlePost: " for other families.",
      othersBody: "Armenian names, English names, a small motif beside each one for the milestone it marked — tulips, teddy bears, giraffes, daffodils, the things a baby will one day point at and ask the word for. Tap any photo to step closer.",
      othersAlt: "Past customer bibs",
    },

    // Heritage bib sets (BibSetCard) — shared option labels.
    bibSet: {
      colorLabel: "Thread color",
      capHeading: "Matching cap",
      addCap: "Add the matching cap",
      capAdded: "Added ✓",
      capUpcharge: "Add — +${price}",
      capNameLabel: "Name or initial on the cap",
      capNamePlaceholder: "e.g. Anna or A",
      capNameHint: "Optional — leave blank and Lusik uses the first initial.",
      includesCap: "Includes the matching cap",
      flagFixed: "Hand cross-stitched in the three colors of the Armenian flag — red, blue, orange. The flag is the design, so the colors are fixed.",
    },

    // Full Alphabet Crib Blanket (CribBlanketCard).
    cribBlanket: {
      bodyColorLabel: "Body color",
      nameLabel: "Optional name (set into a free square)",
      namePlaceholder: "e.g. Anna",
      nameHint: "Optional — leave blank and the blanket ships with just the alphabet. No extra charge either way.",
    },

    // Sold-out state + restock notify (SoldOutPanel).
    soldOut: {
      eyebrow: "Sold out",
      body: "Sold out for now. Please check back soon — Lusik makes these by hand in small batches.",
      notify: "Notify me when it's back in stock",
      badge: "Sold out",
    },
  },

  // ============================================================
  // WESTERN ARMENIAN (hyw) — RESERVED FOR FUTURE USE
  // ============================================================
  // This translation table is preserved in code but NOT exposed to customers.
  // The LANGUAGES array at the top of this file only includes English (en)
  // and Armenian (hy, Eastern), so customers can't currently pick Western.
  // Lusik can still review and refine the Western strings below at her pace;
  // when she's ready, add { code: "hyw", label: "Western Armenian", ... }
  // back to LANGUAGES and the option appears in the picker and footer toggle.
  //
  // Why keep this data here at all: the work is already done — deleting it
  // would mean redoing the translations later. Storage is free; restraint
  // is the right call on exposure, not on preservation.
  // ============================================================
  hyw: {
    nav: {
      blanket: "Ծածկոցը",
      custom: "Յատուկ պատուէրներ",
      story: "Մեր պատմութիւնը",
      faq: "Հարցեր",
      shipping: "Առաքում",
      contact: "Կապուիլ",
      cart: "Զամբիւղ",
      account: "Հաշիւ",
      signIn: "Մուտք",
      connect: "Կապ",
    },
    announce: "Ձեռագործ խաչաձեւ կարկատանով՝ Հարաւային Քալիֆորնիոյ մէջ",
    hero: {
      // TODO_LUSIK_REVIEW — auto-translated, please refine
      headline: "Կարուած Լուսիկին ձեռքով։",
      headlineEm: "Կը մնայ սերունդէ սերունդ",
      body: "Հարաւային Քալիֆորնիոյ իր տունէն, Լուսիկ ձեռքով խաչաձեւ կարկատանով կը պատրաստէ ծածկոցներ, թիկնոցներ եւ օրհնութիւններ — իւրաքանչիւր կտոր ձեռագործ, իւրաքանչիւր կտոր պատուէրով։ Իր տղաքը կ՚օգնեն խանութը վարելու։",
      // TODO_LUSIK_REVIEW — mobile-only variant, city removed (hero eyebrow already shows it)
      bodyShort: "Իր տունէն, Լուսիկ ձեռքով խաչաձեւ կարկատանով կը պատրաստէ ծածկոցներ, թիկնոցներ եւ օրհնութիւններ — իւրաքանչիւր կտոր ձեռագործ, իւրաքանչիւր կտոր պատուէրով։ Իր տղաքը կ՚օգնեն խանութը վարելու։",
      shopCta: "Տեսնել Լուսիկին գործերը",
      storyCta: "Լուսիկին մասին",
      callout1: "Լուսիկէն",
      callout2: "Պատուէրով կը պատրաստուի",
      captions: [
        "Այբուբենը՝ տառ առ տառ։",
        "Ընտանիք մը՝ առաջին օրուան համար։",
        "Իւրաքանչիւր թիկնոցի վրայ՝ անուն մը։",
        "Մանր ու փափուկ կտորներ։",
        "Օրհնութիւններ՝ թելով կարուած։",
        "Ամէնէն փոքր գլուխներուն համար։",
      ],
    },
    langBanner: {
      title: "Բարի եկաք",
      body: "Կը փափաքի՞ք կայքը հայերէնով կարդալ։",
      western: "Հայերէն",
      westernSub: "Արեւմտահայ",
      eastern: "Հայերեն",
      easternSub: "Արեւելահայ",
      english: "English",
      keepEnglish: "Շարունակել անգլերէնով",
    },
    langToggle: { label: "Լեզու" },
    common: {
      addToCart: "Աւելցնել զամբիւղին",
      continueShopping: "Շարունակել գնումները",
      close: "Փակել",
      readMore: "Կարդալ աւելին",
      showLess: "Քիչ ցոյց տալ",
      learnMore: "Իմանալ աւելին",
      email: "Ե-նամակ",
      call: "Հեռաձայն",
      dm: "Հաղորդագրութիւն",
      yes: "Այո",
      no: "Ոչ",
      cancel: "Չեղարկել",
    },
    product: {
      madeToOrder: "Պատուէրով կը պատրաստուի · Հարաւային Քալիֆորնիա",
      limited: "Սահմանուած է առաջին {n} պատուէրներուն։",
      premium: "Բարձր տարբերակ — այբուբենը երկու անգամ կարկատուած (վեց տառ)։",
      step1: "1. Ընտրեցէք ձեր այբուբենը",
      step2: "2. Ընտրեցէք դասաւորութիւնը",
      yourBlanket: "Ձեր ծածկոցը",
      details: "Մանրամասներ · չափ · խնամք",
      armenianLabel: "Հայերէն",
      englishLabel: "Անգլերէն",
      transliterationArmenian: "Այբ · Բեն · Գիմ",
      transliterationEnglish: "A · B · C",
      lettersOnly: "տառ",
      letterSingular: "տառ",
      emailForOther: "Ուրիշ տառեր կամ յատուկ պատուէրներու համար՝ ",
      emailLink: "գրեցէք Լուսիկին",
    },
    footer: {
      brand: "Ձեռագործ խաչաձեւ կարկատանով մանկական ծածկոցներ՝ հայկական այբուբենով — Ա Բ Գ — կամ անգլերէն A B C։ Կը պատրաստէ Լուսիկը Հարաւային Քալիֆորնիոյ մէջ։",
      tagline: "Մայրիկը կը կարկատէ։ Մենք կը գրենք։",
      shop: "Խանութ",
      help: "Օգնութիւն եւ կանոններ",
      findUs: "Մեզ գտնել",
      shippingTracking: "Առաքում եւ հետեւում",
      finalSalePolicy: "Վերջնական վաճառքի կանոն",
      privacyPolicy: "Գաղտնիութեան կանոն",
      termsOfService: "Ծառայութեան պայմաններ",
      contactUs: "Կապուիլ մեզի",
      repliesNote: "Լուսիկը սովորաբար մէկ օրուայ ընթացքին կը պատասխանէ։",
      trustMade: "Պատրաստուած է Հարաւային Քալիֆորնիոյ մէջ",
      trustSecure: "Ապահով վճարում՝ Stripe-ի միջոցով",
      trustShips: "Կ՛առաքենք Միացեալ Նահանգներու ներսը",
      copyright: "© {year} Լուսիկ եւ Որդիներ™։ Բնօրինակ ձեւաւորումներ, լուսանկարներ եւ տեքստ — բոլոր իրաւունքները վերապահուած են։",
      thanks: "Շնորհակալութիւն",
      thanksEn: "Thank you",
      madeWith: "Համբերութեամբ պատրաստուած Հարաւային Քալիֆորնիոյ մէջ",
    },
    textUs: {
      directLine: "Ուղիղ գիծ",
      headline: "Գրեցէք մեզի հաղորդագրութիւն։",
      subhead: "Լուսիկը կամ իր որդիներէն մէկը կը պատասխանէ, սովորաբար մէկ օրուայ ընթացքին։",
      textNow: "Հիմա գրել",
      preferToCall: "Կը նախընտրէ՞ք հեռաձայնել։ ",
      rates: "Սովորական հաղորդագրութեան վճարներ կը կիրառուին · Մենք ձեր թիւը չենք կիսեր",
      proactiveQ: "Կրնա՞նք օգնել ձեզի որեւէ բան գտնելու։",
      proactiveSub: "Լուսիկը սովորաբար մէկ օրուայ ընթացքին կը պատասխանէ։",
      chatNow: "Հիմա խօսիլ",
      noThanks: "Շնորհակալ եմ, ոչ",
    },
    // Story, FAQ, Shipping, Contact, Cart, Auth, Account, Custom, Beta-badge:
    // ⚠️ TODO_LUSIK_REVIEW: Lusik to add Western Armenian directly here.
    // Until then, these sections fall back to English.
  },

  // ============================================================
  // EASTERN ARMENIAN (hy)
  // ⚠️⚠️⚠️ TODO_LUSIK_REVIEW: ALL strings below are AI-generated drafts.
  // Lusik (who grew up with Eastern Armenian) must review every string
  // for grammar, vocabulary, and tone before launch. Specifically:
  //   - Verb conjugations (Eastern uses present "-ում" form vs Western "կը")
  //   - Vocabulary differences (հաշիվ vs հաշիւ, etc.)
  //   - Punctuation: Eastern Armenian uses ։ for periods, ՞ for questions
  //   - Idiom and natural flow — AI translations can feel "off"
  // The "Beta translation" badge in the footer warns visitors that these
  // translations are being reviewed. Remove the badge after Lusik signs off.
  // ============================================================
  hy: {
    nav: {
      blanket: "Ծածկոցը",
      custom: "Հատուկ պատվերներ",
      story: "Մեր պատմությունը",
      faq: "Հաճախ տրվող հարցեր",
      shipping: "Առաքում",
      contact: "Կապ",
      cart: "Զամբյուղ",
      account: "Հաշիվ",
      signIn: "Մուտք",
      connect: "Կապվել",
    },
    announce: "Ձեռագործ խաչաձև կարկատանով՝ Հարավային Կալիֆորնիայում",

    hero: {
      // TODO_LUSIK_REVIEW — auto-translated, please refine
      headline: "Կարված Լուսիկի ձեռքով։",
      headlineEm: "Մնում է սերնդեսերունդ",
      body: "Հարավային Կալիֆորնիայի իր տնից, Լուսիկը ձեռքով խաչաձև կարկատանով պատրաստում է ծածկոցներ, թիկնոցներ և օրհնություններ — յուրաքանչյուր կտոր ձեռագործ, յուրաքանչյուր կտոր պատվերով։ Նրա տղաները օգնում են խանութը վարել։",
      // TODO_LUSIK_REVIEW — mobile-only variant, city removed (hero eyebrow already shows it)
      bodyShort: "Իր տնից, Լուսիկը ձեռքով խաչաձև կարկատանով պատրաստում է ծածկոցներ, թիկնոցներ և օրհնություններ — յուրաքանչյուր կտոր ձեռագործ, յուրաքանչյուր կտոր պատվերով։ Նրա տղաները օգնում են խանութը վարել։",
      shopCta: "Տեսնել Լուսիկի գործերը",
      storyCta: "Լուսիկի մասին",
      callout1: "Լուսիկից",
      callout2: "Պատվերով է պատրաստվում",
      captions: [
        "Այբուբենը՝ տառ առ տառ։",
        "Մի ընտանիք՝ առաջին օրվա համար։",
        "Յուրաքանչյուր թիկնոցի վրա՝ անուն։",
        "Մանր ու փափուկ կտորներ։",
        "Օրհնություններ՝ թելով կարված։",
        "Ամենափոքր գլուխների համար։",
      ],
    },

    langBanner: {
      title: "Բարի գալուստ",
      body: "Ցանկանու՞մ եք կայքը կարդալ հայերեն։",
      western: "Հայերէն",
      westernSub: "Արեւմտահայ",
      eastern: "Հայերեն",
      easternSub: "Արևելահայ",
      english: "English",
      keepEnglish: "Շարունակել անգլերենով",
      footnote: "Լեզուն կարող եք ցանկացած պահի փոխել ստորին հատվածից։",
    },
    langToggle: { label: "Լեզու" },

    betaBadge: {
      label: "Բետա թարգմանություն",
      body: "Այս թարգմանությունը դեռ վերանայվում է։ Եթե ինչ-որ բան անհասկանալի է թվում, խնդրում ենք գրել մեզ — միանգամից կուղղենք։",
    },

    common: {
      addToCart: "Ավելացնել զամբյուղին",
      continueShopping: "Շարունակել գնումները",
      close: "Փակել",
      readMore: "Կարդալ ավելին",
      showLess: "Քիչ ցույց տալ",
      learnMore: "Իմանալ ավելին",
      email: "Էլ. փոստ",
      call: "Զանգահարել",
      dm: "Հաղորդագրություն",
      yes: "Այո",
      no: "Ոչ",
      cancel: "Չեղարկել",
      save: "Պահպանել",
      remove: "Հեռացնել",
      edit: "Խմբագրել",
      loading: "Բեռնվում է…",
      backHome: "← Վերադառնալ գլխավորին",
    },

    product: {
      madeToOrder: "Պատվերով է պատրաստվում · Հարավային Կալիֆորնիա",
      limited: "Սահմանափակված է առաջին {n} պատվերներով։",
      premium: "Բարձր տարբերակ — այբուբենը կարկատված է երկու անգամ (վեց տառի վանդակ)։",
      step1: "1. Ընտրեք ձեր այբուբենը",
      step2: "2. Ընտրեք դասավորությունը",
      yourBlanket: "Ձեր ծածկոցը",
      details: "Մանրամասներ · չափ · խնամք",
      armenianLabel: "Հայերեն",
      englishLabel: "Անգլերեն",
      transliterationArmenian: "Այբ · Բեն · Գիմ",
      transliterationEnglish: "A · B · C",
      lettersOnly: "տառ",
      letterSingular: "տառ",
      emailForOther: "Այլ տառերի կամ հատուկ պատվերների համար՝ ",
      emailLink: "գրեք Լուսիկին",
      quantity: "Քանակ",
    },

    story: {
      eyebrow: "Մեր Պատմությունը",
      title: "Լուսիկը Լոս Անջելես է եկել 1970-ականների վերջին։",
      p1: "Իր հետ բերել է խաչաձև կարկատանի շրջանակ, մի քանի կարմիր ու ոսկեգույն թելի կծիկ, և իր մորից ու տատիկից սովորած աշխատելու ոճը՝ դանդաղ, հավասար կարկատաններ, որ տառը կազմում են մեկ X-ով։",
      p2: "Այդ ժամանակից ի վեր նա պատրաստում է այս ծածկոցները՝ ձեռքով։ Իր որդիները կայքը կառավարում են։ Նա կարկատում է։",
      p3: "Յուրաքանչյուր ծածկոց պատվերով է պատրաստվում։ Լուսիկը անձամբ վերցնում է յուրաքանչյուրը, երբ պատրաստ է, և ստուգում այն մինչև առաքելը։",
      meetLusik: "Ծանոթացեք Լուսիկի հետ",
    },

    contact: {
      eyebrow: "Կապվեք Մեզ Հետ",
      title: "Ինչպես ցանկանաք։",
      directLine: "Ուղիղ գիծ",
      callLabel: "Զանգահարեք մեզ",
      emailLabel: "Էլ. փոստ",
      byPost: "Փոստով",
      mailPickup: "Փոստի ընդունման ժամերը",
      online: "Մեզ գտեք առցանց",
      onlineNote: "Որոշ հաշիվներ դեռ կարգավորվում են։ Եթե հղումը դեռ չի աշխատում, խնդրում ենք գրել մեզ։",
      moreWays: "Կապվելու ավելի շատ տարբերակներ",
      tagline: "Լուսիկը ինքն է պատասխանում, իր ժամանակին։",
    },

    footer: {
      brand: "Ձեռագործ խաչաձև կարկատանով մանկական ծածկոցներ՝ հայկական այբուբենով — Ա Բ Գ — կամ անգլերեն A B C։ Պատրաստում է Լուսիկը Հարավային Կալիֆորնիայում։",
      tagline: "Մայրիկը կարկատում է։ Մենք գրում ենք։",
      shop: "Խանութ",
      help: "Օգնություն և կանոններ",
      findUs: "Մեզ գտնել",
      shippingTracking: "Առաքում և հետևում",
      finalSalePolicy: "Վերջնական վաճառքի կանոն",
      privacyPolicy: "Գաղտնիության կանոն",
      termsOfService: "Ծառայության պայմաններ",
      contactUs: "Կապվել մեզ հետ",
      repliesNote: "Լուսիկը սովորաբար մեկ օրվա ընթացքում է պատասխանում։",
      trustMade: "Պատրաստված է Հարավային Կալիֆորնիայում",
      trustSecure: "Անվտանգ վճարում՝ Stripe-ի միջոցով",
      trustShips: "Առաքում ենք Միացյալ Նահանգների ներսում",
      copyright: "© {year} Լուսիկ և Որդիներ™։ Բնօրինակ ձևավորումներ, լուսանկարներ և տեքստ — բոլոր իրավունքները պաշտպանված են։",
      thanks: "Շնորհակալություն",
      thanksEn: "Thank you",
      madeWith: "Համբերությամբ պատրաստված Հարավային Կալիֆորնիայում",
    },

    textUs: {
      directLine: "Ուղիղ գիծ",
      headline: "Գրեք մեզ հաղորդագրություն։",
      subhead: "Լուսիկը կամ իր որդիներից մեկը պատասխանում է, սովորաբար մեկ օրվա ընթացքում։",
      textNow: "Հիմա գրել",
      preferToCall: "Նախընտրու՞մ եք զանգահարել։ ",
      rates: "Սովորական հաղորդագրության վճարներ են կիրառվում · Մենք ձեր համարը երբեք չենք կիսում",
      proactiveQ: "Կարո՞ղ ենք օգնել ձեզ ինչ-որ բան գտնել։",
      proactiveSub: "Լուսիկը սովորաբար մեկ օրվա ընթացքում է պատասխանում։",
      chatNow: "Հիմա խոսել",
      noThanks: "Շնորհակալ եմ, ոչ",
    },

    cart: {
      title: "Ձեր զամբյուղը",
      empty: "Ձեր զամբյուղը դատարկ է։",
      keepShopping: "Շարունակել գնումները",
      subtotal: "Ենթագումար",
      taxNote: "Հարկն ու առաքումը հաշվարկվում են վճարման ժամանակ։",
      checkout: "Վճարել",
    },

    auth: {
      signIn: "Մուտք",
      signUp: "Գրանցվել",
      signOut: "Դուրս գալ",
      forgot: "Մոռացա՞ք գաղտնաբառը։",
      noAccount: "Հաշիվ չունե՞ք։",
      hasAccount: "Արդեն հաշիվ ունե՞ք։",
      emailLabel: "Էլ. փոստի հասցե",
      passwordLabel: "Գաղտնաբառ",
      nameLabel: "Անուն",
      welcomeBack: "Բարի գալուստ նորից",
      createAccount: "Ստեղծեք ձեր հաշիվը",
      resetPassword: "Վերականգնեք գաղտնաբառը",
      resetBody: "Գրեք ձեր էլ. փոստը, և մենք կուղարկենք գաղտնաբառի վերականգնման հղում։",
      sendResetLink: "Ուղարկել վերականգնման հղում",
      checkEmail: "Ստուգեք ձեր էլ. փոստը՝ վերականգնման հղման համար։",
      backToSignIn: "← Վերադառնալ մուտքին",
      submit: "Շարունակել",
    },

    account: {
      title: "Ձեր հաշիվը",
      hello: "Բարև, {name}",
      orderHistory: "Պատվերների պատմություն",
      savedAddresses: "Պահպանված հասցեներ",
      yourInfo: "Ձեր տվյալները",
      noOrders: "Դուք դեռ պատվեր չեք տվել։",
      shopFirstBlanket: "Տեսնել ձեր առաջին ծածկոցը",
    },

    custom: {
      eyebrow: "Հատուկ Պատվերներ",
      title: "Հատուկ պատվերներ",
      subtitle: "Կրծկալներ և սրբիչներ՝ ձեր երեխայի տառով կամ նկարով։",
      bibTitle: "Մանկական կրծկալ",
      // ⚠️ TODO_LUSIK_REVIEW — Armenian wording updated to reflect machine-only bib.
      bibSubtitle: "Մեքենայով ասեղնագործ՝ անհատականացված անունով։",
      bibMachine: "Մեքենայով ասեղնագործ",
      // ⚠️ TODO_LUSIK_REVIEW — Armenian wording updated; was about PNG/JPEG upload.
      bibMachineNote: "Մուտքագրեք կարճ անուն (մինչև 5–6 տառ)։ Լուսիկը հաստատում է տեղադրումը նախքան կարկատելը։",
      towelTitle: "Հատուկ ասեղնագործ սրբիչ",
      towelSubtitle: "Վերբեռնեք նկար, մենք մեքենայով կասեղնագործենք։",
      uploadImage: "Վերբեռնել նկար (PNG/JPEG, առավելագույնը 5 ՄԲ)",
      chooseFile: "Ընտրել ֆայլ",
      noFile: "Ֆայլ ընտրված չէ",
      pickLetter: "Ընտրեք տառ",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    disclaimer: {
      heading: "Այս լուսանկարների մասին",
      short: "Լուսանկարները ցույց են տալիս նախկին աշխատանքների օրինակներ — ձեր ձեռագործ կտորը կարող է փոքր-ինչ տարբերվել։",
      full: "Ցուցադրված լուսանկարները նախկին աշխատանքների օրինակներ են։ Քանի որ յուրաքանչյուր կտոր ձեռագործ է, և նյութերը ժամանակի ընթացքում կարող են փոխվել, գործվածքը, եզրագիծը, ամրակման ոճը, գույները և մանրամասները կարող են տարբերվել ցուցադրված լուսանկարներից։ Յուրաքանչյուր պատվեր պատրաստվում է խնամքով, բայց այն կարող է ճշգրիտ պատճենը չլինել նմուշային լուսանկարի։",
      bibClosure: "Ընթացիկ կրծկալները կարող են ունենալ վզի ամրակման այլ համակարգ՝ քան ցուցադրված օրինակները։",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    mobileNav: {
      forYou: "Ձեզ համար",
      products: "Ապրանքներ",
      journal: "Օրագիր",
      bag: "Պայուսակ",
      search: "Որոնում",
      searchPlaceholder: "Ի՞նչ եք փնտրում։",
      clearSearch: "Մաքրել որոնման տեքստը",
      voiceSearch: "Որոնել ձայնով",
      stopListening: "Դադարեցնել լսելը",
      dismissKeyboard: "Փակել ստեղնաշարը",
      openBag: "Բացել պայուսակը",
      goForYou: "Անցնել «Ձեզ համար» էջ",
      backToForYou: "Վերադառնալ «Ձեզ համար» էջ",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    search: {
      title: "Որոնում",
      recentlyViewed: "Վերջերս դիտված",
      recentSearches: "Վերջին որոնումները",
      trySearching: "Փորձեք որոնել",
      clear: "Մաքրել",
      noResults: "Արդյունք չկա «{q}»-ի համար",
      noResultsHint: "Փորձեք այլ որոնում կամ դիտեք խանութը։",
      from: "{price}$-ից",
      comingSoon: "Շուտով",
      journalTag: "Օրագիր",
      sectionTag: "Կայքի բաժին",
      yourAccount: "Ձեր հաշիվը",
      sections: {
        faq: "Հաճախ տրվող հարցեր",
        shipping: "Առաքում և վերադարձ",
        contact: "Կապ մեզ հետ",
        story: "Մեր պատմությունը",
      },
      suggestions: [
        { label: "Հայկական այբուբենով ծածկոց", query: "Armenian alphabet blanket" },
        { label: "Մկրտության սրբիչ", query: "Baptism towel" },
        { label: "Բարի ախորժակ", query: "Bari akhorzhak" },
        { label: "Այբուբենով օրորոցի ծածկոց", query: "Alphabet crib blanket" },
        { label: "Առաքում", query: "Shipping" },
        { label: "Վերադարձի կանոն", query: "Refund policy" },
      ],
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    bag: {
      title: "Պայուսակ",
      emptyPage: "Ձեր պայուսակը դատարկ է։",
      emptyDrawer: "Ձեր զամբյուղը դատարկ է։",
      emptyUser: "Շարունակեք դիտել Լուսիկ և Որդիներ խանութը կամ բացեք նախկինում պահպանված ձևավորում։",
      emptyGuest: "Շարունակեք դիտել Լուսիկ և Որդիներ խանութը՝ ձեր ծածկոցը սկսելու համար։",
      shopBlanket: "Տեսնել ծածկոցը",
      openSaved: "Կամ բացել պահպանված ձևավորում →",
      custom: "Հատուկ",
      qty: "Քանակ՝",
      removeItem: "Հեռացնել զամբյուղից",
      edit: "Խմբագրել",
      doneEditing: "Ավարտել խմբագրումը",
      closeCart: "Փակել զամբյուղը",
      customOrders: "Հատուկ պատվերներ՝",
      customOrdersBody: "Ձեր վերբեռնած ձևավորումները պահպանվում են ձեր պատվերի հետ։ Մենք ձեզ կուղարկենք ձեր ասեղնագործ ձևավորման նմուշը նախքան մեքենայով կարկատելը։",
      madeToOrderNote: "Պատվերով է պատրաստվում — յուրաքանչյուր ծածկոց սկսվում է այն բանից հետո, երբ Լուսիկը ստանա ձեր պատվերը։",
      checkout: "Վճարել",
      orderDetails: "Պատվերի մանրամասներ և կանոններ",
      dmInstagram: "Գրել մեզ Instagram-ով",
      orderViaPre: "Կամ ",
      orderViaPost: "՝ պատվիրելու համար",
      agreePre: "Պատվեր կատարելով՝ դուք համաձայնում եք մեր ",
      terms: "Պայմաններին",
      privacy: "Գաղտնիության կանոնին",
      finalSale: "Վերջնական վաճառքի կանոնին",
      agreePost: "։",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    help: {
      stillQuestions: "Հարցե՞ր ունեք դեռ։",
      stillSubline: "Լուսիկը կամ իր որդիներից մեկը կօգնի։",
      needHelp: "Օգնության կարիք ունե՞ք ընտրելու հարցում։",
      stillNeedHelp: "Դեռ օգնության կարիք ունե՞ք ընտրելու հարցում։",
      textUs: "Գրեք մեզ",
      callUs: "Զանգահարեք մեզ",
      emailUs: "Էլ. փոստ գրեք",
      videoCall: "Տեսազանգ",
      lede: "Հարց ունե՞ք որևէ կտորի մասին։ Լուսիկը կամ իր որդիներից մեկը շուտով կպատասխանի։",
      frequentlyAsked: "Հաճախ տրվող հարցեր",
      faq: [
        { q: "Ի՞նչ է լինում տեսազանգի ժամանակ։", a: "Դուք ընտրում եք ժամ, և Լուսիկը (կամ իր որդիներից մեկը) միանում է կարճ տեսազանգի։ Նա ձեզ ցույց կտա ծածկոցները, թելերի գույներն ու գործվածքը մոտիկից, և կօգնի ընտրել այբուբեն, անուն ու դասավորություն։ Կարիք չկա տեսախցիկը միացնելու, եթե չեք ցանկանում։" },
        { q: "Կարո՞ղ եք օգնել ընտրել գույներ ու անուն։", a: "Հենց դրա համար են այս զրույցները։ Բերեք մանկական սենյակի գունապնակը, քրոջ կամ եղբոր ծածկոցը կամ պարզապես մի զգացողություն — Լուսիկը կօգնի ընտրել համադրություն, որը և՛ լավ տեսք ունի, և՛ լավ է կարկատվում։ Ոչինչ չի պատվիրվում, մինչև դուք գոհ չլինեք։" },
        { q: "Իսկ եթե նախընտրեմ պարզապես գրել կամ էլ. փոստ ուղարկել։", a: "Միանգամայն ընդունելի է — մարդկանց մեծ մասն այդպես է անում։ Սեղմեք վերևի «Գրեք մեզ» կամ «Էլ. փոստ գրեք» կոճակը և գրեք այն, ինչ մտքիդ կա։ Լուսիկն ինքն է պատասխանում, երբ կարող է, այլապես՝ իր որդիներից մեկը, սովորաբար մեկ օրվա ընթացքում։" },
        { q: "Որքա՞ն ժամանակ է պահանջում մի կտոր պատրաստելը։", a: "Յուրաքանչյուր ծածկոց ձեռքով խաչաձև կարկատվում է պատվերով, ուստի մեծ մասը պահանջում է մոտ 5–10 աշխատանքային օր, երբ ձևավորումը հաստատված է։ Դուք կստանաք լուսանկար նախքան առաքելը և հետևման հղում, երբ այն ճանապարհին լինի։" },
        { q: "Կա՞ տեղական վերցնելու հնարավորություն։", a: "Այո — եթե դուք Օրինջ Քաունթիի կամ Լոս Անջելեսի տարածքում եք, կարող եք ձեր պատվերն անձամբ վերցնել՝ առանց առաքման։ Պատվերից հետո կապ հաստատեք Լուսիկի հետ («Գրեք մեզ» կամ «Էլ. փոստ գրեք»)՝ ժամն ու վայրը պայմանավորվելու համար։ ԱՄՆ-ի մնացած պատվերներն անվճար առաքվում են։" },
        { q: "Իմ կտորը ճի՞շտ նույն տեսքը կունենա, ինչ լուսանկարներում։", a: "Լուսանկարները նախկին աշխատանքների օրինակներ են։ Քանի որ յուրաքանչյուր կտոր ձեռագործ է, և նյութերը ժամանակի ընթացքում փոխվում են, գործվածքը, եզրագիծը, ամրակման ոճը և գույները կարող են փոքր-ինչ տարբերվել — ընթացիկ կրծկալները կարող են նույնիսկ ունենալ վզի այլ ամրակում, քան ցույց են տալիս հին լուսանկարները։ Յուրաքանչյուր պատվեր պատրաստվում է նույն խնամքով, բայց այն նմուշային լուսանկարի ճշգրիտ պատճենը չէ։" },
      ],
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    pageTitles: {
      home: "Ձեզ համար",
      shop: "Խանութ",
      journal: "Օրագիր",
      account: "Ձեր հաշիվը",
      gallery: "Պատկերասրահ",
      checkout: "Վճարում",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    forYou: {
      weThink: "Կարծում ենք՝ ձեզ դուր կգա",
      selectedForYou: "Ընտրված ձեզ համար",
      featuredName: "Հայկական այբուբենով ծածկոց",
      exploreRest: "Տեսնել մնացածը",
      recentActivity: "Ձեր վերջին ակտիվությունը",
      more: "Ավելին",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    explore: {
      shop: { title: "Խանութ", blurb: "Ծածկոցներ, կրծկալներ և սրբիչներ" },
      story: { title: "Մեր պատմությունը", blurb: "Հայաստան → Կալիֆորնիա" },
      workshop: { title: "Լուսիկի արհեստանոցից", blurb: "Նախկին ծածկոցներ, իրական ընտանիքներ" },
      journal: { title: "Օրագիրը", blurb: "Հայկական արհեստի մասին" },
      faq: { title: "Լավ հարցեր", blurb: "Ինչպես է պատրաստվում և առաքվում" },
      shipping: { title: "Առաքում և հետևում", blurb: "Ինչպես է ձեր կտորը հասնում տուն" },
      contact: { title: "Կապ Լուսիկի հետ", blurb: "Մեզ հասնելու չորս եղանակ" },
      newsletter: { title: "Մնացեք կապի մեջ", blurb: "Երբեմն մի նամակ" },
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    shop: {
      breadcrumbHome: "Գլխավոր",
      browseBy: "Դիտել ըստ կատեգորիայի",
      view: "Դիտել",
      viewAria: "Դիտել {name}",
      browseAria: "Դիտել {label}",
      readAria: "Կարդալ {title}",
      comingSoonAria: "{name} — շուտով",
      from: "{price}$-ից",
      stepIn: "Մտնել ներս",
      byDirectOrder: "Ուղիղ պատվերով",
      writeMe: "Գրեք ինձ",
      almostReady: "Գրեթե պատրաստ",
      lusikHands: "Նախ՝ Լուսիկի ձեռքերը",
      journal: "Օրագիր",
      readMin: "Կարդալ · {min} րոպե",
      newest: "Ամենանորը",
      discoverNew: "Բացահայտեք նորույթները",
      featuredPieces: "Ընտրված կտորներ",
      shopCollection: "Դիտեք հավաքածուն",
      fromJournal: "Օրագրից",
      theShop: "Խանութը",
      everythingPre: "Այն ամենը, ինչ Լուսիկը ",
      everythingEm: "պատրաստում է",
      intro: "Խաչաձև կարկատված ծածկոցներ՝ օրորոցի համար։ Ասեղնագործ կրծկալներ՝ խոհանոցի սեղանի համար։ Ծիսական սրբիչներ՝ կարևոր օրերի համար։ Մանր գործվածքե իրեր՝ առաջին շաբաթների համար։ Յուրաքանչյուր կտոր՝ Լուսիկի ձեռքով, իր տնից Հարավային Կալիֆորնիայում՝ պատվերով, տևելու համար։ Ընտրեք կատեգորիա՝ ներս մտնելու համար։",
      availableNow: "{n} հասանելի է հիմա",
      comingSoonCount: "{n} շուտով",
      madeToOrder: "Պատվերով",
      byOrder: "{price}$ · պատվերով",
      differenceHeading: "Լուսիկ և Որդիներ տարբերությունը",
      newestName: "«Բարի ախորժակ» կրծկալի և թքակալի հավաքածու",
      newestTagline: "Երկու հայկական սեղանի օրհնություն, մեկ համընկնող հավաքածու։",
      featured: [
        { eyebrow: "Լուսիկի ստորագիրը", name: "Հայկական այբուբենով ծածկոց", tagline: "Ա Բ Գ, ձեռքով խաչաձև կարկատված անկյունից անկյուն։", price: "65$-ից" },
        { eyebrow: "Ժառանգությունը", name: "Ամբողջ այբուբենով օրորոցի ծածկոց", tagline: "Հայկական այբուբենի ամեն տառ՝ բոլոր երեսունվեցը։", price: "Ուղիղ պատվերով · 245$" },
        { eyebrow: "Ամեն օրվա համար", name: "Անհատական անունով կրծկալ", tagline: "Ձեր երեխայի անունը՝ հայերեն կամ անգլերեն։", price: "22$-ից" },
      ],
      difference: [
        { text: "Պատվերով, տևելու համար։ Ամեն կարկատան՝ Լուսիկի սեփական ձեռքով։", linkLabel: "Դիտել ծածկոցները" },
        { text: "Իր տնից Հարավային Կալիֆորնիայում՝ կարկատված ձերի համար։", linkLabel: "Կարդալ Լուսիկի օրագիրը" },
        { text: "Ձեր երեխայի անունն ու ծննդյան տարին՝ հյուսված կտորի մեջ, հայերեն կամ անգլերեն։", linkLabel: "Անհատականացնել ծածկոց" },
      ],
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    placeholder: {
      comingSoon: "Շուտով",
      comingSoonBody: "Լուսիկը այս կտորի առաջինն ավարտում է իր խոհանոցի սեղանին։ Լուսանկարները կհայտնվեն այստեղ հենց որ այն պատրաստ լինի աշխարհին ցույց տալու։",
      byDirectOrderEyebrow: "Ուղիղ պատվերով · Լուսիկի տնից՝ Հարավային Կալիֆորնիայում",
      almostReadyEyebrow: "Գրեթե պատրաստ · Հարավային Կալիֆորնիա",
      checkoutNotOpen: "Այս կտորի առցանց վճարումը դեռ բաց չէ, բայց գինը սահմանված է, և Լուսիկն ընդունում է ուղիղ պատվերներ։ Գրեք կամ զանգահարեք՝ սկսելու համար, և նա ինքը կպատասխանի մեկ օրվա ընթացքում։",
      priceComingSoon: "Գինը՝ շուտով",
      unpricedBody: "Լուսիկը դեռ որոշում է, թե որքան գին սահմանի այս շարքի համար — նա սիրում է կտորը ձեռքում պահել նախքան գին նշանակելը։ Թողեք ձեր էլ. փոստը ներքևում, և մենք ձեզ կգրենք հենց որ այն ցուցակվի։",
      detailsHeading: "Մանրամասներ · չափ · խնամք",
      writeToCommission: "Գրեք Լուսիկին՝ սա պատվիրելու համար",
      orCall: "Կամ զանգահարեք (760) 874-2333",
      commissionNote: "Լուսիկը կամ իր որդիներից մեկը պատասխանում է, սովորաբար մեկ օրվա ընթացքում։ Մենք կքննարկենք գունավորումը, այբուբենը, ձեզ անհրաժեշտ ամսաթիվը և կհաստատենք գինը նախքան կարկատելը։",
      orWaitListing: "Կամ սպասեք ցուցակմանը",
      waitListingBody: "Մենք աշխատում ենք այս կտորի առցանց վճարումը բացելու ուղղությամբ։ Եթե նախընտրում եք սպասել, մենք ձեզ կգրենք հենց որ այն հասանելի դառնա։",
      addToList: "Ավելացրեք ինձ ցուցակին",
      currentlyUnavailable: "Ներկայումս անհասանելի է",
      currentlyUnavailableAria: "Ներկայումս անհասանելի է — տես ստորև «Տեղեկացրեք ինձ» տարբերակը",
      writeWhenReady: "Գրեք ինձ, երբ պատրաստ լինի",
      oneNote: "Մեկ նամակ՝ ցուցակման օրը, ուրիշ ոչինչ, երբեք։",
      orWriteLusik: "Կամ գրեք Լուսիկին",
      customRequestBody: "Եթե նախընտրում եք չսպասել հանրային ցուցակմանը, կամ հարց ունեք, որին Լուսիկը պետք է ինքը պատասխանի, գրեք նրան։",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    pdp: {
      madeToOrderEyebrow: "Պատվերով · Լուսիկի տնից՝ Հարավային Կալիֆորնիայում",
      premiumNote: "Բարձր տարբերակ — այբուբենը կարկատված է երկու անգամ, ծածկոցի վրա վեց տառի վանդակ։",
      standardNote: "Ձեռքով խաչաձև կարկատված Լուսիկի կողմից · պատվերով, տևելու համար։",
      step1: "1. Ընտրեք ձեր այբուբենը",
      step2: "2. Ընտրեք դասավորությունը",
      step3: "3. Ընտրեք ձեր գույները",
      step4: "4. Կամընտիր անհատականացում",
      letters: "{n} տառ",
      lettersWord: "տառ",
      forDifferentLetterPre: " Այլ տառի կամ անվան համար, որ կուզենայիք գրել, ",
      writeLusikDirectly: "գրեք Լուսիկին ուղիղ",
      forDifferentLetterPost: " — նա միշտ ինքն է կարդում դրանք։",
      cube: "խորանարդ",
      letter: "տառ",
      colorIntro: "Լուսիկը յուրաքանչյուր ծածկոցի թելն ընտրում է այն կծիկներից, որ ձեռքի տակ ունի այն շաբաթ, երբ կարկատում է ձերը։ Ծածկոցների միջև փոքր տարբերությունները հենց ապացույց են, որ մեկ կին է պատրաստել։",
      presets: "Կաղապարներ",
      pickYourOwn: "Ընտրեք ձերը",
      blockColorLabel: "Խորանարդի եզրագծի գույնը (3D խորանարդը)",
      letterColorLabel: "Տառի գույնը (խորանարդի ներսում)",
      selected: "Ընտրված է՝",
      doneCollapse: "Պատրաստ է — փակել այս բաժինը",
      willEmbroider: "Կասեղնագործվի ծածկոցի վրա",
      noOptionalText: "Կամընտիր տեքստ չկա",
      shipsAlphabet: "Ծածկոցը կառաքվի միայն այբուբենով",
      personalizationIntro: "Երկու կարճ տող, որ Լուսիկը կարող է տեղադրել ծածկոցի ազատ վանդակում՝ ձեր երեխայի անունը, տարեթիվը, կարևոր ամսաթիվը։ Երկուսն էլ կամընտիր են։ Թողեք դատարկ, և ծածկոցը կառաքվի միայն այբուբենով՝ առանց հավելավճարի։",
      line1Label: "Տող 1 — անուն, մականուն կամ սկզբնատառեր",
      line1Placeholder: "օր.՝ ԱՆՆԱ",
      line1Aria: "Անհատականացված տեքստի կամընտիր առաջին տողը",
      line2Label: "Տող 2 — ծննդյան տարի կամ ամսաթիվ",
      line2Placeholder: "օր.՝ 2025",
      line2Aria: "Անհատականացված տեքստի կամընտիր երկրորդ տողը",
      upToChars: "Մինչև 6 նիշ · {n}/6",
      realExample: "Իրական օրինակ",
      skipNoText: "Բաց թողնել — կամընտիր տեքստ չկա",
      yourBlanket: "Ձեր ծածկոցը",
      saveDesign: "Պահպանել ձևավորումը",
      saving: "Պահպանվում է…",
      saved: "Պահպանված է ✓",
      saveAria: "Պահպանել այս ձևավորումը ձեր հաշվում",
      saveTitleUser: "Պահպանեք ձեր հաշվում, որ կարողանաք ավելի ուշ վերադառնալ դրան",
      saveTitleGuest: "Մուտք գործեք՝ ձևավորումներ պահպանելու համար",
      share: "Կիսվել",
      shareAria: "Կիսվել այս ձևավորմամբ",
      shareTitle: "Ստացեք երկրորդ կարծիք նախքան պատվիրելը",
      saveHintUser: "Պահպանված ձևավորումներն ապրում են ձեր հաշվում — շարունակեք ցանկացած պահի։",
      saveHintGuest: "Մուտք գործեք՝ ձևավորումը պահպանելու և ավելի ուշ շարունակելու համար։",
      alphabetLabel: "{label} այբուբեն — {translit}",
      cubeOutline: "{name} խորանարդի եզրագիծ",
      letterInside: "{name} տառ՝ ներսում",
      finalSale: "ՎԵՐՋՆԱԿԱՆ ՎԱՃԱՌՔ —",
      finalSaleBody: "Այս ծածկոցը կարկատվում է հատկապես ձեզ համար, ուստի բոլոր վաճառքները վերջնական են։ Ոչ վերադարձ, ոչ փոխանակում, ոչ գումարի վերադարձ։ Խնդրում ենք ստուգել ձեր այբուբենը, գույները և ցանկացած անուն կամ տարի նախքան վճարելը։",
      readPolicy: "Կարդալ ամբողջ կանոնը",
      buyNow: "Գնել հիմա",
      ships: "Առաքվում է {date}",
      arrives: " · ժամանում է {date}",
      deliveryNote: "Հիմնված Լուսիկի ընթացիկ արտադրության ժամանակի և ԱՄՆ հասցեով ցամաքային առաքման վրա։",
      yourDesign: "Ձեր ձևավորումը",
      realPhotos: "Իրական լուսանկարներ",
      livePreviewCaption: "Կենդանի նախադիտում, թե ինչպիսին կլինի ձեր ծածկոցը։ Իրական կտորն ունի հյուսված նռան հյուսվածք և ծոպավոր եզրեր — սեղմեք «Իրական լուսանկարներ»՝ տեսնելու այն կտորը, որի վրա Լուսիկն աշխատում է։",
      zoomPhotoAria: "Խոշորացնել լուսանկար {n}-ը {m}-ից",
      prevPhoto: "Նախորդ լուսանկարը",
      nextPhoto: "Հաջորդ լուսանկարը",
      tapToZoom: "Սեղմեք խոշորացնելու համար",
      closeZoom: "Փակել խոշորացված լուսանկարը",
    },

    // ⚠️ TODO_LUSIK_REVIEW — auto-translated, please refine.
    bib: {
      errSize: "Խնդրում ենք ընտրել չափ։",
      errName: "Խնդրում ենք մուտքագրել ասեղնագործելու անուն։",
      errTooLong: "Անունը պետք է լինի {n} տառ կամ պակաս — կրծկալը փոքր է։",
      previewHint: "Մուտքագրեք ձեր երեխայի անունը՝ տեսնելու, թե ինչպես Լուսիկը կկարկատի այն",
      step1Name: "1. Անհատականացված անուն",
      namePlaceholder: "օր.՝ Աննա",
      nameAria: "Ասեղնագործելու անհատականացված անունը",
      upToLetters: "Մինչև {n} տառ · {len}/{n}",
      previewOnly: "Միայն նախադիտում — իրական ասեղնագործության տառատեսակը կարող է փոքր-ինչ տարբերվել։",
      step2Color: "2. Թելի գույնը",
      lusiksPicks: "Լուսիկի ընտրությունները",
      pickYourOwn: "Ընտրեք ձերը",
      selected: "Ընտրված է՝",
      chooseSize: "{step} Ընտրեք չափը",
      finalSale: "ՎԵՐՋՆԱԿԱՆ ՎԱՃԱՌՔ —",
      finalSaleBody: "Ասեղնագործված հատկապես ձեզ համար։ Ոչ վերադարձ, ոչ փոխանակում, ոչ գումարի վերադարձ։",
      readPolicy: "Կարդալ ամբողջ կանոնը",
      buyNow: "Գնել հիմա",
      othersEyebrow: "Այլ ընտանիքների խոհանոցներից",
      othersTitlePre: "Իրական կրծկալներ, որ Լուսիկը ",
      othersTitleEm: "կարկատել է",
      othersTitlePost: " այլ ընտանիքների համար։",
      othersBody: "Հայկական անուններ, անգլերեն անուններ, յուրաքանչյուրի կողքին փոքր մոտիվ՝ այն իրադարձության համար, որ նշում էր — կակաչներ, արջուկներ, ընձուղտներ, նարգիզներ, այն բաները, որ մի օր երեխան կմատնացույց անի և կհարցնի դրանց անունը։ Սեղմեք ցանկացած լուսանկար՝ ավելի մոտիկից տեսնելու համար։",
      othersAlt: "Նախկին հաճախորդների կրծկալներ",
    },

    // ⚠️ TODO_LUSIK_REVIEW: auto-translated, awaiting a native speaker.
    bibSet: {
      colorLabel: "Թելի գույնը",
      capHeading: "Համապատասխան գլխարկ",
      addCap: "Ավելացնել համապատասխան գլխարկը",
      capAdded: "Ավելացված ✓",
      capUpcharge: "Ավելացնել — +${price}",
      capNameLabel: "Անունը կամ սկզբնատառը գլխարկի վրա",
      capNamePlaceholder: "օր.՝ Աննա կամ Ա",
      capNameHint: "Ըստ ցանկության — թողեք դատարկ, և Լուսիկը կօգտագործի առաջին տառը։",
      includesCap: "Ներառում է համապատասխան գլխարկը",
      flagFixed: "Ձեռքով խաչաձև կարված հայկական դրոշի երեք գույներով՝ կարմիր, կապույտ, նարնջագույն։ Դրոշը հենց ձևավորումն է, ուստի գույները հաստատուն են։",
    },

    // ⚠️ TODO_LUSIK_REVIEW: auto-translated, awaiting a native speaker.
    cribBlanket: {
      bodyColorLabel: "Հիմնական գույնը",
      nameLabel: "Ըստ ցանկության անուն (տեղադրվում է ազատ վանդակում)",
      namePlaceholder: "օր.՝ Աննա",
      nameHint: "Ըստ ցանկության — թողեք դատարկ, և ծածկոցը կառաքվի միայն այբուբենով։ Լրացուցիչ վճար չկա։",
    },

    // ⚠️ TODO_LUSIK_REVIEW: auto-translated, awaiting a native speaker.
    soldOut: {
      eyebrow: "Սպառված է",
      body: "Առայժմ սպառված է։ Խնդրում ենք շուտով կրկին ստուգել — Լուսիկը դրանք պատրաստում է ձեռքով, փոքր քանակով։",
      notify: "Տեղեկացրեք ինձ, երբ նորից առկա լինի",
      badge: "Սպառված է",
    },
  },
};
