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
// MIRRORED FROM index.html (~line 2082). Big file (~608 lines)
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
    announce: "Hand cross-stitched in Cypress, California — by Lusik, for the families who'll keep it",

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
      body: "From her home in Cypress, California, Lusik cross-stitches blankets, bibs, and blessings — every piece by hand, every piece made for one specific child. Her sons run the website. Mom does the stitching. We do the typing.",
      // Mobile-only variant — the hero eyebrow already says "Cypress,
      // California", so the phone body drops the city to avoid repeating
      // it. Desktop keeps the full `body` above.
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
      madeToOrder: "Made to order · Cypress, CA",
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
      p1: "She brought a cross-stitch hoop, a few skeins of red and gold thread, and a way of working her grandmother had taught her in Armenia — slow, even stitches that build a letter one small X at a time.",
      p2: "She has been making these pieces, by hand, ever since. Her sons run this website. She does the stitching. Mom does the work; we do the typing.",
      p3: "Every blanket is made to order. Lusik picks up each one when it's ready, sits with it on her kitchen table, and personally checks it before it goes in the box for your family.",
      meetLusik: "Meet Lusik",
    },

    // FAQ — each entry is a Q/A pair
    faq: {
      eyebrow: "Common Questions",
      title: "Things people ask us",
      q1: { q: "How long does a blanket take to make?",
            a: "Anywhere from one to three weeks, depending on how many orders are ahead of yours. Lusik works on one blanket at a time. If you need it by a specific date, please tell us at checkout or email — we'll let you know honestly whether we can meet it." },
      q2: { q: "Which letters come on the blanket?",
            a: "Each blanket has three letters — Armenian (Ա, Բ, Գ) or English (A, B, C). The alphabet is stitched twice, along two parallel diagonals that run top-left to bottom-right, so six letter-squares appear across the blanket in total — three letters in one diagonal, the same three again in the other. You pick the alphabet on the product page. For other letters or special requests, please email Lusik at hello@lusikandsons.com." },
      q3: { q: "Which way do the letters run?",
            a: "Top-left to bottom-right. Lusik stitches the alphabet along that one diagonal — she doesn't offer the mirrored direction. The middle letter is always in the center." },
      q4: { q: "What is the blanket made of?",
            a: "A soft acrylic baby blanket with a woven pomegranate pattern, finished with fringe edges and a satin backing matched to the body color. The fabric is gentle enough for newborns. Lusik picks each blanket personally before stitching." },
      q5: { q: "How do I clean it?",
            a: "We recommend professional dry cleaning for every piece. The dry cleaner gives consistent gentle treatment that preserves the cross-stitching, satin backing, and crochet edging — washing machines wear handmade textiles down quickly, and cycle / temperature mistakes are easy to make. If you'd rather launder at home, follow the yarn's label exactly (cool wash, no bleach, no iron, tumble dry low on delicate). We can't guarantee against wear from washing-machine cycles." },
      q6: { q: "Do you ship internationally?",
            a: "Not yet. Right now we ship only within the United States. We'll add more countries as the business grows." },
      q7: { q: "Is this a final sale?",
            a: "Yes — every blanket and bib is made specifically for you, so all sales are final. We don't accept exchanges, refunds, or returns once an order is placed. Please use the live preview to confirm your alphabet, colors, and any name or year before checking out. If anything is unclear, email or text us before you buy and we'll talk it through. If your item arrives damaged in transit or has a clear defect, we stand behind the work — email us within 14 days with photos and Lusik will repair or remake it." },
    },

    // Shipping section
    shipping: {
      eyebrow: "Shipping",
      title: "How your blanket gets to you",
      p1: "Once Lusik finishes the last stitch, she folds the blanket between layers of tissue, places it in the box herself, and walks it to the carrier from her home in Cypress, California.",
      p2: "USPS, UPS, or FedEx — you pick at checkout. Free U.S. shipping on orders over $150.",
      tracking: "Tracking",
      trackingBody: "A tracking number arrives in your inbox the moment the package leaves Lusik's hands.",
      times: "Delivery times",
      timesBody: "Most orders arrive within 3–5 business days after they ship — and Lusik usually emails you a photograph of the finished piece a day or two before that.",
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
      brand: "Hand cross-stitched baby blankets with the Armenian alphabet — Ա Բ Գ — or English A B C. By Lusik herself, from her home in Cypress, California. Made to order, made to last.",
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
      trustMade: "Made by Lusik in Cypress, California",
      trustSecure: "Secure checkout powered by Stripe",
      trustShips: "Ships within the United States",
      copyright: "© {year} Lusik & Sons. All rights reserved.",
      thanks: "Շնորհակալություն",
      thanksEn: "Thank you",
      madeWith: "Made with patience in Cypress, California",
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
    announce: "Ձեռագործ խաչաձեւ կարկատանով՝ Սայփրըսի մէջ, Քալիֆորնիա",
    hero: {
      // TODO_LUSIK_REVIEW — auto-translated, please refine
      headline: "Կարուած Լուսիկին ձեռքով։",
      headlineEm: "Կը մնայ սերունդէ սերունդ",
      body: "Կիպրեսի (Քալիֆորնիա) իր տունէն, Լուսիկ ձեռքով խաչաձեւ կարկատանով կը պատրաստէ ծածկոցներ, թիկնոցներ եւ օրհնութիւններ — իւրաքանչիւր կտոր ձեռագործ, իւրաքանչիւր կտոր պատուէրով։ Իր տղաքը կ՚օգնեն խանութը վարելու։",
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
      madeToOrder: "Պատուէրով կը պատրաստուի · Սայփրըս, Քալիֆորնիա",
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
      brand: "Ձեռագործ խաչաձեւ կարկատանով մանկական ծածկոցներ՝ հայկական այբուբենով — Ա Բ Գ — կամ անգլերէն A B C։ Կը պատրաստէ Լուսիկը Սայփրըսի մէջ, Քալիֆորնիա։",
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
      trustMade: "Պատրաստուած է Սայփրըսի մէջ, Քալիֆորնիա",
      trustSecure: "Ապահով վճարում՝ Stripe-ի միջոցով",
      trustShips: "Կ՛առաքենք Միացեալ Նահանգներու ներսը",
      copyright: "© {year} Լուսիկ եւ Որդիներ։ Բոլոր իրաւունքները վերապահուած են։",
      thanks: "Շնորհակալութիւն",
      thanksEn: "Thank you",
      madeWith: "Համբերութեամբ պատրաստուած Սայփրըսի մէջ, Քալիֆորնիա",
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
    announce: "Ձեռագործ խաչաձև կարկատանով՝ Սայփրեսսում, Քալիֆորնիա",

    hero: {
      // TODO_LUSIK_REVIEW — auto-translated, please refine
      headline: "Կարված Լուսիկի ձեռքով։",
      headlineEm: "Մնում է սերնդեսերունդ",
      body: "Կիպրեսի (Կալիֆոռնիա) իր տնից, Լուսիկը ձեռքով խաչաձև կարկատանով պատրաստում է ծածկոցներ, թիկնոցներ և օրհնություններ — յուրաքանչյուր կտոր ձեռագործ, յուրաքանչյուր կտոր պատվերով։ Նրա տղաները օգնում են խանութը վարել։",
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
      madeToOrder: "Պատվերով է պատրաստվում · Սայփրեսս, Քալիֆորնիա",
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
      p1: "Իր հետ բերել է խաչաձև կարկատանի շրջանակ, մի քանի կարմիր ու ոսկեգույն թելի կծիկ, և իր տատիկից սովորած աշխատելու ոճը՝ դանդաղ, հավասար կարկատաններ, որ տառը կազմում են մեկ X-ով։",
      p2: "Այդ ժամանակից ի վեր նա պատրաստում է այս ծածկոցները՝ ձեռքով։ Իր որդիները կայքը կառավարում են։ Նա կարկատում է։",
      p3: "Յուրաքանչյուր ծածկոց պատվերով է պատրաստվում։ Լուսիկը անձամբ վերցնում է յուրաքանչյուրը, երբ պատրաստ է, և ստուգում այն մինչև առաքելը։",
      meetLusik: "Ծանոթացեք Լուսիկի հետ",
    },

    faq: {
      eyebrow: "Հաճախ Տրվող Հարցեր",
      title: "Ինչ են մարդիկ հարցնում մեզ",
      q1: { q: "Որքա՞ն ժամանակ է տևում ծածկոցի պատրաստումը։",
            a: "Մեկ-երեք շաբաթ, կախված նրանից, թե քանի պատվեր կա ձեր առջևից։ Լուսիկը միաժամանակ աշխատում է մեկ ծածկոցի վրա։ Եթե այն ձեզ անհրաժեշտ է որոշակի օրվա համար, խնդրում ենք գրել պատվեր տալիս կամ էլ. փոստով — մենք ազնվորեն կասենք՝ կարո՞ղ ենք հասցնել։" },
      q2: { q: "Որ տառերն են դրվում ծածկոցի վրա։",
            // ⚠️ TODO_LUSIK_REVIEW — auto-translated to match the corrected English; please confirm.
            a: "Յուրաքանչյուր ծածկոցի վրա երեք տառ կա՝ հայերեն (Ա, Բ, Գ) կամ անգլերեն (A, B, C)։ Այբուբենը կարկատվում է երկու անգամ՝ երկու զուգահեռ անկյունագծերի վրա, որոնք ընթանում են վերին ձախից դեպի ներքին աջ — ընդհանուր առմամբ վեց տառի վանդակ ծածկոցի վրա, երեքը մի անկյունագծի, երեքն էլ՝ մյուսի։ Դուք ընտրում եք այբուբենը արտադրանքի էջում։ Այլ տառերի կամ հատուկ պատվերների համար գրեք Լուսիկին՝ hello@lusikandsons.com։" },
      q3: { q: "Ի՞նչ ուղղությամբ են ընթանում տառերը։",
            // ⚠️ TODO_LUSIK_REVIEW — auto-translated; please confirm with Lusik.
            a: "Վերին ձախից ներքին աջ։ Լուսիկը կարկատում է այբուբենը այդ մեկ անկյունագծի վրա — հակառակ ուղղությունը նա չի առաջարկում։ Միջին տառը միշտ կենտրոնում է։" },
      q4: { q: "Ինչից է պատրաստված ծածկոցը։",
            // TODO_LUSIK_REVIEW — added satin backing mention
            a: "Փափուկ ակրիլային մանկական ծածկոցից՝ նռան նախշով գործվածքով, ծոպավոր եզրերով և գույնին համապատասխան ատլասե աստառով։ Գործվածքը բավականաչափ նուրբ է նորածինների համար։ Լուսիկը անձամբ ընտրում է յուրաքանչյուր ծածկոց՝ կարկատելուց առաջ։" },
      q5: { q: "Ինչպե՞ս մաքրել։",
            // TODO_LUSIK_REVIEW — rewritten to recommend dry cleaning
            a: "Խորհուրդ ենք տալիս չոր մաքրում յուրաքանչյուր կտորի համար։ Չոր մաքրողը հետևողականորեն մեղմ մշակում է խաչաձև կարկատանը, ատլասե աստառը և կեռիկ եզրերը — լվացքի մեքենաները արագ մաշում են ձեռագործ կտորները։ Եթե նախընտրում եք տանը լվանալ, հետևեք թելի պիտակին (սառը ջուր, ոչ սպիտակեցուցիչ, ոչ արդուկ, չորանոցով ցածր ջերմությամբ՝ նուրբ ռեժիմով)։ Մեքենայի լվացման մաշվածության դեմ երաշխիք չենք տալիս։" },
      q6: { q: "Միջազգային առաքում կատարու՞մ եք։",
            a: "Դեռ ոչ։ Այս պահին միայն ԱՄՆ-ի սահմաններում ենք առաքում։ Բիզնեսի աճի հետ կավելացնենք այլ երկրներ։" },
      q7: { q: "Կարո՞ղ եմ վերադարձնել։",
            a: "Քանի որ յուրաքանչյուր ծածկոց հատուկ ձեզ համար է պատրաստված, մտքի փոփոխության դեպքում վերադարձ չենք ընդունում։ Եթե թերություն կա կամ առաքման ընթացքում վնասվել է, գրեք մեզ 7 օրվա ընթացքում և մենք կուղղենք։" },
    },

    shipping: {
      eyebrow: "Առաքում",
      title: "Ինչպես է ձեր ծածկոցը հասնում ձեզ",
      p1: "Երբ Լուսիկը ավարտում է ձեր ծածկոցը, մենք այն խնամքով փաթեթավորում ենք և առաքում Սայփրեսսից, Քալիֆորնիա։",
      p2: "Մենք օգտագործում ենք USPS, UPS կամ FedEx — ընտրությունը ձերն է պատվեր տալիս։ Անվճար ԱՄՆ առաքում 150 դոլարից բարձր պատվերների համար։",
      tracking: "Հետևում",
      trackingBody: "Հենց որ ձեր պատվերն առաքվի, էլ. փոստով կստանաք հետևման համարը։",
      times: "Առաքման ժամկետներ",
      timesBody: "Պատվերների մեծ մասը հասնում է 3–5 աշխատանքային օրվա ընթացքում՝ առաքվելուց հետո։",
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
      brand: "Ձեռագործ խաչաձև կարկատանով մանկական ծածկոցներ՝ հայկական այբուբենով — Ա Բ Գ — կամ անգլերեն A B C։ Պատրաստում է Լուսիկը Սայփրեսսում, Քալիֆորնիա։",
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
      trustMade: "Պատրաստված է Սայփրեսսում, Քալիֆորնիա",
      trustSecure: "Անվտանգ վճարում՝ Stripe-ի միջոցով",
      trustShips: "Առաքում ենք Միացյալ Նահանգների ներսում",
      copyright: "© {year} Լուսիկ և Որդիներ։ Բոլոր իրավունքները պաշտպանված են։",
      thanks: "Շնորհակալություն",
      thanksEn: "Thank you",
      madeWith: "Համբերությամբ պատրաստված Սայփրեսսում, Քալիֆորնիա",
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
  },
};
