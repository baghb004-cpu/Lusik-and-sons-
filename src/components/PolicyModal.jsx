"use client";

// ============================================================
// PolicyModal — Privacy / Terms / Refunds
// ============================================================
// Intentionally English-only (legal copy doesn't translate
// well without a lawyer, and the audience is U.S.). Three
// policy bodies, picked by `policyKey` prop.
//
// MIRRORED FROM index.html (~line 6587). No external deps
// other than React + the X icon.
// ============================================================

import React, { useEffect } from "react";
import { X } from "./icons.jsx";

export function PolicyModal({ policyKey, onClose }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Last-updated date — bump this manually whenever you revise the text.
  const lastUpdated = "May 2026";

  const policies = {
    privacy: {
      title: "Privacy Policy",
      eyebrow: "How we handle your information",
      sections: [
        {
          heading: "What we collect",
          body: "When you place an order, we collect your name, email address, shipping address, and phone number (if you provide one). When you create an account, we additionally store a password (encrypted; we never see it in plain text) and any profile photo you choose to upload. Your payment information is collected by Stripe, our payment processor, and never touches our servers."
        },
        {
          heading: "How we use it",
          body: "We use your information to fulfill your order, ship your blanket, contact you about your order, and — if you create an account — to show you your order history. That's it. We do not sell your information. We do not share it with advertisers. We do not run analytics that track you across the internet."
        },
        {
          heading: "Who can see it",
          body: "Lusik and her sons can see your contact information and shipping address. Stripe sees your payment information. The United States Postal Service, UPS, or FedEx see your shipping address — whichever carrier you select at checkout. Nobody else."
        },
        {
          heading: "How long we keep it",
          body: "Order records are kept indefinitely for tax and warranty purposes. Account profiles are kept as long as you have an account. You can delete your account yourself from the bottom of your account page — your profile, saved addresses, saved designs, avatar, and sign-in are removed immediately. Past order records stay (we have to keep them for taxes) but they're anonymized: your user account is unlinked from them. You can also download everything we have about you from the same page. If you'd rather have a human handle it, email hello@lusikandsons.com and we'll remove your account within 30 days."
        },
        {
          heading: "Cookies and tracking",
          body: "We use only the cookies necessary to keep you signed in and to remember your cart. We don't use Google Analytics, Facebook Pixel, or any other cross-site tracking, and we don't run advertisements. The site may use a privacy-first analytics provider (Umami) for aggregate pageview counts; if active, it doesn't set cookies, doesn't track you across other sites, and doesn't collect personal data. On mobile, the site also remembers your recently viewed items and recent searches locally in your own browser to help you pick up where you left off — that history stays on your device, is never sent to us, and you can clear it anytime from the search screen. You can confirm what's running by opening your browser's developer tools and looking at the Network tab — every request the site makes will be visible there."
        },
        {
          heading: "Children's privacy",
          body: "Our products are for babies and children, but our site is intended for adult purchasers. We don't knowingly collect information from anyone under 13."
        },
        {
          heading: "Optional social-share consent",
          body: "At checkout you can choose, entirely optionally, to let Lusik share a photo of your finished piece on social media. The checkbox is unchecked by default. If you tick it, we store: the fact that you opted in, the timestamp of your consent, which platforms you authorized (Instagram, TikTok, Facebook, YouTube — whichever you ticked), and the handle you typed for each of those platforms if you provided one. Each handle is stored against its own platform, so an Instagram handle is only ever used on Instagram, a TikTok handle only on TikTok, and so on. We use this information only to know what Lusik is allowed to post about your order and where, and to tag the right account on each platform if you asked to be tagged. We never post photos of you, your child, or anyone else — only the finished blanket or bib. You can withdraw your consent at any time by emailing hello@lusikandsons.com; we'll honor the withdrawal within a few days and remove any posts that are still under our control. Posts that other people have already shared or saved are outside our reach, which is the practical limit of any social-media consent."
        },
        {
          heading: "Your California rights",
          body: "If you are a California resident, you have specific rights under the California Consumer Privacy Act (CCPA) and its 2023 amendments (CPRA): the right to know what personal information we have collected about you, the right to access a copy of it, the right to correct inaccuracies, the right to delete it (subject to the order-record retention noted above), and the right to opt out of the sale or sharing of your personal information. We do not sell your information and we do not share it with advertisers, so the opt-out is, in our case, the default state for every customer. The first two rights are self-serve: in your account page, the \"Download my data\" button gives you a JSON export of everything we hold, and \"Delete my account\" tears it down. To exercise the others, email hello@lusikandsons.com from the address associated with your account or order. We do not discriminate against customers who exercise their privacy rights — your order is fulfilled the same way either way."
        },
        {
          heading: "Questions",
          body: "Email hello@lusikandsons.com. Lusik or one of her sons will respond, usually within a day."
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      eyebrow: "The agreement when you buy from us",
      sections: [
        {
          heading: "Who we are",
          body: "Lusik & Sons is a small family business based in Southern California. Lusik hand cross-stitches Armenian-alphabet baby blankets, and machine-embroiders personalized baby bibs. Her sons run this website."
        },
        {
          heading: "Placing an order",
          body: "When you place an order, you're entering into a sales agreement with Lusik & Sons. All sales are final — see our Final Sale Policy below. Prices on the site are accurate to the best of our ability, but we reserve the right to cancel an order and reverse the charge before stitching begins if a clear pricing error has occurred. Each blanket is made to order; we begin work only after your order is paid and confirmed."
        },
        {
          heading: "Making the blanket",
          body: "Each blanket has three letters of your chosen alphabet (Armenian Ա, Բ, Գ or English A, B, C), hand cross-stitched along two parallel diagonals that run top-left to bottom-right — six letter-squares in total, with the alphabet repeated once on each diagonal. The bib is machine-embroidered with a personalized name (up to five or six letters); its surface is too small for hand cross-stitch to read well, so it gets the technique that suits its size. Because every blanket is made by hand, slight variation between pieces is expected and is part of the character of the product."
        },
        {
          heading: "Shipping",
          body: "We currently ship only within the United States via USPS, UPS, or FedEx (your choice at checkout). Most orders ship within 5–10 business days of order confirmation; the Full Alphabet Crib Blanket — every letter, by hand — needs 3–4 weeks. You'll receive a tracking number when your order ships. Shipping costs and any duties are the customer's responsibility."
        },
        {
          heading: "Documentation and disputes",
          body: "Every order is documented from the finished-piece photograph Lusik takes through the moment the package is handed off to the carrier — the piece itself, the packing, and the shipping label, kept on file for 90 days. If your order arrives damaged or doesn't arrive at all, that record lets us resolve things with you directly — and, in the rare cases a dispute goes to our payment processor, gives us what we need to back you up or, honestly, to back ourselves up, depending on what actually happened. Every damage claim is read personally by Lusik or one of her sons; we don't use automated screening on the photographs you send us. The conversation stays human, on both sides."
        },
        {
          heading: "Customer responsibility",
          body: "You're responsible for entering accurate shipping information. If a package is returned because of a bad address, you'll be responsible for re-shipping costs. Please make sure your shipping address is correct before completing checkout."
        },
        {
          heading: "Care and longevity",
          body: "Every blanket and bib is hand-made with cross-stitching, crochet edging, and a satin backing matched to the body color. To preserve the piece for years, we strongly recommend professional dry cleaning. The dry cleaner gives consistent, gentle treatment that's difficult to match at home — washing machines, dryers, ironing, and bleach all wear handmade textiles down quickly, and a single wrong setting (a hot cycle, the wrong detergent, mixed colors) can damage the piece in a way that can't be reversed. If you choose to launder a piece at home, follow the yarn manufacturer's label exactly. Lusik & Sons is not responsible for damage that results from any care method, professional or at-home — once an item leaves our hands, how it's looked after is your call. The damaged-in-transit and clear-defect coverage in the Final Sale Policy below stands as written and is not affected by this clause."
        },
        {
          heading: "Custom orders",
          body: "If a future custom order includes an image you upload, you confirm you have the right to use that image. Lusik reserves the right to decline custom orders that are offensive, illegal, or use copyrighted material she doesn't have permission to reproduce. (Today's bib only accepts a typed name, not an uploaded image, but this clause applies if image-upload products are reactivated.)"
        },
        {
          heading: "Optional social-media license",
          body: "If you tick the optional 'share your story' box at checkout, you grant Lusik & Sons a limited, non-exclusive, royalty-free, and revocable license to photograph the finished item we made for you and to display those photographs on the social-media platforms you authorized (Instagram, TikTok, Facebook, YouTube — whichever you ticked). This license covers only the finished article — never you, your child, your home, or any other person. If you provided a handle for any of the platforms you authorized, you authorize us to tag that handle on its own platform — your Instagram handle on Instagram, your TikTok handle on TikTok, and so on; we will never carry a handle from one platform over to another. You can revoke this license at any time by emailing hello@lusikandsons.com; we will stop posting and remove any posts still under our control. Posts already saved, re-shared, or downloaded by other people are outside our control, which is the practical limit of any social-media license. If you did not tick the box, no such license is granted."
        },
        {
          heading: "Limitation of liability",
          body: "Our liability is limited to the amount you paid for the product. We're not responsible for incidental damages, missed events, or other indirect losses. Please order in advance if you need a piece for a specific occasion."
        },
        {
          heading: "Our designs are our own",
          body: "Every piece Lusik & Sons sells is designed and hand cross-stitched by Lusik herself. Our designs, color combinations, patterns, photographs, written descriptions, and the Lusik & Sons name and logo are our original creative work — protected by copyright and held as our trademark (™). You're welcome to share our photographs with credit and a link to lusikandsons.com, but please don't reproduce, copy, or sell our designs, images, or text for commercial use without our written permission. If you'd like to license a design or collaborate, write to hello@lusikandsons.com — we'd love to talk."
        },
        {
          heading: "Trademarks and materials",
          body: "Other names and marks mentioned on this site — including Stripe; USPS, UPS, and FedEx; Instagram, TikTok, Facebook, and YouTube; Visa, Mastercard, American Express, Apple Pay, and Google Pay; and DMC threads — are referenced only to describe how we run our business or what we use to make our products. Lusik & Sons is not affiliated with, endorsed by, sponsored by, or partnered with any of these companies, and no such relationship is implied. All trademarks, service marks, and trade names belong to their respective owners."
        },
        {
          heading: "Changes",
          body: "We may update these terms occasionally. The version on this page is the one that applies to your order at the time you place it."
        },
      ],
    },
    finalSale: {
      title: "Final Sale Policy",
      eyebrow: "All sales are final",
      sections: [
        {
          heading: "Why every order is final sale",
          body: "Every blanket and bib is made specifically for you — the alphabet, the layout, the colors, and any name or year you've added are stitched into the piece by hand or by a single-purpose embroidery machine. There's no shelf to put a finished blanket back on if you change your mind. Once your order is paid, Lusik begins working on a piece that exists because of you and that we cannot resell to anyone else. For that reason, all sales are final: no returns, no exchanges, no refunds for change of mind, color preference, or fit."
        },
        {
          heading: "Please review your design before you check out",
          body: "The live preview on the product page shows your exact alphabet, layout, colors, and optional name and year — what you see is what Lusik stitches. Take a moment to confirm spelling, year digits, and color choice. If you're unsure about anything, email hello@lusikandsons.com or text (760) 874-2333 BEFORE checking out. We're happy to talk a design through with you."
        },
        {
          heading: "We still stand behind our work",
          body: "Final sale does not mean you are on your own. If your item arrives damaged in transit, has a clear manufacturing defect, or is materially different from what you ordered (wrong alphabet, wrong letter, wrong name, wrong product), email us within 14 days of delivery with photos. We keep our own documentation on every order — the finished-piece photograph, the packaging, the carrier handoff — so most of the picture is usually already on our side; we can skip the back-and-forth and move straight to making it right. At our discretion, Lusik will repair the piece, remake it, or work with you to find an acceptable resolution. This is not a returns process — it is us standing behind the work."
        },
        {
          heading: "Slight variation is part of the work",
          body: "Lusik sources thread from different manufacturers, so two blankets in the same color can vary slightly in shade. Each blanket is hand-stitched, so spacing, tension, and stitch density can vary subtly from piece to piece. These are characteristics of handmade goods, not defects, and are not grounds for remake."
        },
        {
          heading: "Lost in transit",
          body: "If your package's tracking shows it as lost or stuck for over 14 business days past the expected delivery date, contact us. We will file a claim with the carrier and work with you on a replacement — separate from the final-sale rule."
        },
        {
          heading: "Pricing-error cancellations",
          body: "If we accept an order at an obviously wrong price (typo, misconfigured listing), we reserve the right to cancel before stitching begins. In that case the charge is reversed in full and the order does not proceed. This is the only situation in which money flows back to the buyer."
        },
        {
          heading: "How to reach us",
          body: "Email hello@lusikandsons.com, call or text (760) 874-2333, or DM @lusikandsons on Instagram. Lusik or one of her sons will respond, usually within a day."
        },
      ],
    },
  };

  const policy = policies[policyKey];
  if (!policy) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 lg-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`policy-${policyKey}-title`}
    >
      <div
        className="lg-panel-tall w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 lg:p-8 border-b" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent)" }}>{policy.eyebrow}</p>
            <h2 id={`policy-${policyKey}-title`} className="font-display text-2xl lg:text-3xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              {policy.title}
            </h2>
            <p className="text-xs opacity-50 mt-1">Last updated: {lastUpdated}</p>
          </div>
          <button onClick={onClose} className="p-1 -mt-1 -mr-1 opacity-60 hover:opacity-100" aria-label="Close" data-tooltip="Close" data-tooltip-pos="left">
            <X size={22} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="p-6 lg:p-8 overflow-y-auto flex-1">
          <div className="space-y-6">
            {policy.sections.map((s, i) => (
              <div key={i}>
                <h3 className="font-display text-base lg:text-lg mb-2" style={{ fontWeight: 500 }}>{s.heading}</h3>
                <p className="text-sm leading-relaxed opacity-85">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Sister-policy links at the bottom */}
          <div className="mt-10 pt-6 text-xs opacity-60" style={{ borderTop: "1px solid rgba(26,22,18,0.08)" }}>
            <p className="mb-1">Other policies:</p>
            <div className="flex gap-4 flex-wrap">
              {Object.keys(policies).filter((k) => k !== policyKey).map((k) => (
                <button
                  key={k}
                  onClick={(e) => { e.stopPropagation(); /* swap content by reopening */ window.dispatchEvent(new CustomEvent("openPolicy", { detail: k })); }}
                  className="underline hover:opacity-100"
                >
                  {policies[k].title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 lg:px-8 py-4 text-center text-xs opacity-60" style={{ borderTop: "1px solid rgba(26,22,18,0.08)", background: "rgba(176,136,66,0.06)" }}>
          Questions? <a href="mailto:hello@lusikandsons.com" className="underline">hello@lusikandsons.com</a> · <a href="tel:+17608742333" className="underline">(760) 874-2333</a>
        </div>
      </div>
    </div>
  );
}
