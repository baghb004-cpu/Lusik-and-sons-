import SwiftUI
import WebKit

// ============================================================
// CheckoutView — "Almost in Lusik's hands", native edition (Chunk 5)
// ============================================================
// Mirrors the website's pre-Stripe page: order summary with bundle
// savings, the REQUIRED shipping ZIP that prices the zone rate (Pay
// stays disabled without it, exactly the web rule), gift options +
// notes, then POST create-checkout-session with the same body shape
// the web sends and hand off to Stripe's hosted page.
//
// The Stripe page opens in an in-app WKWebView so we can watch for the
// ?order=success return → clear the bag → thank-you. Trade-off, recorded
// in the roadmap: WKWebView has no Apple Pay; upgrading to
// SFSafariViewController + Apple Pay needs a small server-side return
// redirect (a website PR, only with explicit approval). Card checkout
// works fully today.

struct CheckoutView: View {
    @EnvironmentObject private var cart: CartStore
    @Environment(\.dismiss) private var dismiss

    @State private var shipZip = ""
    @State private var giftIsGift = false
    @State private var giftMessage = ""
    @State private var giftHidePrices = false
    @State private var giftWrap = false
    @State private var reminderOptIn = false
    @State private var notes = ""

    @State private var busy = false
    @State private var errorMessage: String?
    @State private var stripeURL: IdentifiedURL?
    @State private var orderComplete = false
    @State private var idempotencyKey = UUID().uuidString

    private struct IdentifiedURL: Identifiable { let id = UUID(); let url: URL }

    private static let giftWrapDollars = 5      // web GIFT_WRAP_PRICE_CENTS parity
    private static let giftMessageMax = 140
    private static let notesMax = 280

    private var freeShipping: Bool { cart.qualifiesForFreeShipping }
    private var zipValid: Bool { ShippingZones.isValidZip(shipZip) }
    private var zipNeeded: Bool { !freeShipping && !zipValid }
    private var estimate: ShippingZones.Estimate? {
        freeShipping ? nil : ShippingZones.estimate(for: shipZip)
    }

    var body: some View {
        Group {
            if orderComplete {
                thanks
            } else {
                form
            }
        }
        .background(Brand.cream)
        .navigationTitle("Checkout")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $stripeURL) { item in
            StripeWebSheet(
                url: item.url,
                onSuccess: {
                    stripeURL = nil
                    cart.clear()
                    idempotencyKey = UUID().uuidString
                    orderComplete = true
                    Haptics.success()
                },
                onClose: { stripeURL = nil }
            )
            .ignoresSafeArea()
        }
        .alert("Couldn't start checkout", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // ── the pre-Stripe form ──
    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Almost in Lusik's hands")
                    .font(Brand.fontDisplay(26, weight: .medium))
                    .foregroundStyle(Brand.ink)

                summaryCard
                shippingCard
                giftCard
                notesCard
                payButton

                Text("Payment is handled by Stripe on the next screen — Lusik never sees your card. Tax is calculated there.")
                    .font(Brand.fontBody(11))
                    .foregroundStyle(Brand.ink.opacity(0.5))
            }
            // Unfolded: the form holds a centered column.
            .frame(maxWidth: FoldLayout.contentWidth, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(18)
        }
    }

    private var summaryCard: some View {
        card {
            ForEach(cart.items) { item in
                HStack {
                    Text("\(item.qty) ×").foregroundStyle(Brand.ink.opacity(0.5))
                    Text(item.name).lineLimit(1)
                    Spacer()
                    Text("$\(item.priceDollars * item.qty)")
                }
                .font(Brand.fontBody(13))
            }
            Divider()
            row("Subtotal", "$\(cart.subtotalDollars).00")
            if cart.bundleSavingsDollars > 0 {
                row("Bundle savings (\(cart.unitCount) pieces)",
                    String(format: "−$%.2f", cart.bundleSavingsDollars),
                    valueColor: Brand.accent)
            }
            if giftIsGift && giftWrap {
                row("Gift wrap", "+$\(Self.giftWrapDollars).00")
            }
            if freeShipping {
                row("Shipping", "Free", valueColor: Brand.accent)
            } else if let est = estimate {
                row("Shipping", String(format: "$%.2f", est.dollars))
            } else {
                row("Shipping", "Enter ZIP below", muted: true)
            }
        }
    }

    private var shippingCard: some View {
        card {
            Text("SHIPPING ZIP CODE")
                .font(Brand.fontBody(10, weight: .semibold)).kerning(1.6)
                .foregroundStyle(Brand.ink.opacity(0.6))
            if freeShipping {
                Text("You've earned free U.S. shipping — your address is collected on the Stripe page.")
                    .font(Brand.fontBody(12)).foregroundStyle(Brand.ink.opacity(0.6))
            } else {
                TextField("90620", text: $shipZip)
                    .keyboardType(.numberPad)
                    .textContentType(.postalCode)
                    .font(Brand.fontBody(16, weight: .medium))
                    .padding(12)
                    .background(Brand.surface, in: RoundedRectangle(cornerRadius: 10))
                    .onChange(of: shipZip) { _, new in
                        shipZip = String(new.filter(\.isNumber).prefix(5))
                    }
                    .accessibilityLabel("Shipping ZIP code")

                if let est = estimate {
                    Text("\(est.label) — \(String(format: "$%.2f", est.dollars)) · \(est.daysMin)–\(est.daysMax) business days transit once it ships.")
                        .font(Brand.fontBody(12)).foregroundStyle(Brand.ink)
                } else {
                    Text("Shipping is priced by distance from Lusik's workshop in Buena Park, CA — $9.99–$15.49 in the lower 48.")
                        .font(Brand.fontBody(11)).foregroundStyle(Brand.ink.opacity(0.55))
                }
            }
        }
    }

    private var giftCard: some View {
        card {
            Toggle("This is a gift", isOn: $giftIsGift)
                .font(Brand.fontBody(14, weight: .medium))
                .tint(Brand.accent)
            if giftIsGift {
                TextField("A short note for the card (\(Self.giftMessageMax) chars)",
                          text: $giftMessage, axis: .vertical)
                    .lineLimit(2...3)
                    .font(Brand.fontBody(13))
                    .padding(10)
                    .background(Brand.surface, in: RoundedRectangle(cornerRadius: 10))
                    .onChange(of: giftMessage) { _, new in
                        giftMessage = String(new.prefix(Self.giftMessageMax))
                    }
                Toggle("Hide prices in the box", isOn: $giftHidePrices)
                    .font(Brand.fontBody(13)).tint(Brand.accent)
                Toggle("Gift wrap (+$\(Self.giftWrapDollars))", isOn: $giftWrap)
                    .font(Brand.fontBody(13)).tint(Brand.accent)
            }
            Toggle("Remind me about this occasion next year", isOn: $reminderOptIn)
                .font(Brand.fontBody(13)).tint(Brand.accent)
        }
    }

    private var notesCard: some View {
        card {
            Text("A NOTE FOR LUSIK (OPTIONAL)")
                .font(Brand.fontBody(10, weight: .semibold)).kerning(1.6)
                .foregroundStyle(Brand.ink.opacity(0.6))
            TextField("Anything she should know while stitching?", text: $notes, axis: .vertical)
                .lineLimit(2...4)
                .font(Brand.fontBody(13))
                .padding(10)
                .background(Brand.surface, in: RoundedRectangle(cornerRadius: 10))
                .onChange(of: notes) { _, new in
                    notes = String(new.prefix(Self.notesMax))
                }
        }
    }

    private var payButton: some View {
        Button(action: pay) {
            HStack {
                if busy { ProgressView().tint(Brand.textOnInk) }
                Text(busy ? "Connecting to Stripe…"
                          : zipNeeded ? "Enter ZIP to continue" : "Pay with Stripe")
            }
            .font(Brand.fontBody(14, weight: .semibold))
            .kerning(1.2)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(zipNeeded || busy ? Brand.ink.opacity(0.5) : Brand.ink,
                        in: RoundedRectangle(cornerRadius: Brand.pillRadius))
            .foregroundStyle(Brand.textOnInk)
        }
        .disabled(zipNeeded || busy || cart.items.isEmpty)
    }

    private func pay() {
        busy = true
        let body = LusikAPI.CheckoutRequest(
            cart: cart.items.map {
                LusikAPI.CheckoutItem(
                    productKey: $0.checkoutKey.rawValue,
                    id: $0.id,
                    qty: $0.qty,
                    subtitle: $0.subtitle,
                    isCustom: false
                )
            },
            ship_zip: zipValid ? shipZip : nil,
            gift: LusikAPI.GiftOptions(
                is_gift: giftIsGift,
                message: giftIsGift ? giftMessage : "",
                hide_prices: giftIsGift && giftHidePrices,
                wrap: giftIsGift && giftWrap
            ),
            gift_reminder_opt_in: reminderOptIn,
            customer_notes: notes,
            customerEmail: nil,            // Stripe's page collects it
            idempotency_key: idempotencyKey
        )
        Task {
            defer { busy = false }
            do {
                stripeURL = IdentifiedURL(url: try await LusikAPI.createCheckoutSession(body))
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private var thanks: some View {
        VStack(spacing: 14) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 48))
                .foregroundStyle(Brand.accent)
            Text("Lusik is starting on your order.")
                .font(Brand.fontDisplay(24, weight: .medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Brand.ink)
            Text("A confirmation email is on its way. Hand-stitching takes about two weeks — you'll get a photo of the finished piece before it ships.")
                .font(Brand.fontBody(14))
                .multilineTextAlignment(.center)
                .foregroundStyle(Brand.ink.opacity(0.7))
            Button("Done") { dismiss() }
                .font(Brand.fontBody(14, weight: .semibold))
                .padding(.top, 8)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // ── little helpers ──
    @ViewBuilder
    private func card(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.creamSubtle, in: RoundedRectangle(cornerRadius: Brand.cornerRadius))
    }

    private func row(_ label: String, _ value: String,
                     valueColor: Color = Brand.ink, muted: Bool = false) -> some View {
        HStack {
            Text(label).foregroundStyle(Brand.ink.opacity(0.7))
            Spacer()
            Text(value)
                .fontWeight(.medium)
                .foregroundStyle(muted ? Brand.ink.opacity(0.5) : valueColor)
        }
        .font(Brand.fontBody(14))
    }
}

// ── the Stripe hosted page, watched for the success return ──

private struct StripeWebSheet: View {
    let url: URL
    let onSuccess: () -> Void
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            CheckoutWebView(url: url, onSuccess: onSuccess)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel", action: onClose)
                    }
                }
                .navigationTitle("Secure checkout")
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct CheckoutWebView: UIViewRepresentable {
    let url: URL
    let onSuccess: () -> Void

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onSuccess: onSuccess) }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let onSuccess: () -> Void
        init(onSuccess: @escaping () -> Void) { self.onSuccess = onSuccess }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // Stripe redirects to lusikandsons.com/?order=success&session_id=…
            // on payment — that's our cue; never load the website itself.
            if let target = navigationAction.request.url,
               target.host?.contains("lusikandsons.com") == true,
               target.query?.contains("order=success") == true {
                decisionHandler(.cancel)
                onSuccess()
                return
            }
            decisionHandler(.allow)
        }
    }
}

#Preview {
    let store = CartStore()
    store.add(CartItem(id: "bib-hy-em", checkoutKey: .bibHyEm,
                       name: "The Hye Em Yes Bib", subtitle: "Flag colors",
                       priceDollars: 20, qty: 2,
                       photoURL: Catalog.products[4].photoURLs.first))
    return NavigationStack { CheckoutView() }.environmentObject(store)
}
