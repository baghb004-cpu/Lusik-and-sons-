import Foundation

/// Client for the existing Netlify Functions backend — the same API the
/// website uses. The server owns all pricing/authorization; this client
/// sends keys and quantities, never trusted amounts.
struct LusikAPI {
    static let functionsBase = URL(string: "https://lusikandsons.com/.netlify/functions")!

    struct CheckoutItem: Encodable {
        let productKey: String
        let id: String
        let qty: Int
        let subtitle: String
        let isCustom: Bool
    }

    struct GiftOptions: Encodable {
        var is_gift = false
        var message = ""
        var hide_prices = false
        var wrap = false
    }

    /// Mirrors the body CheckoutView.jsx sends — same field names, same
    /// shapes. `ship_zip` drives the server's zone-priced shipping.
    struct CheckoutRequest: Encodable {
        let cart: [CheckoutItem]
        let ship_zip: String?
        let gift: GiftOptions
        let gift_reminder_opt_in: Bool
        let customer_notes: String
        let customerEmail: String?
        let idempotency_key: String
    }

    struct CheckoutResponse: Decodable {
        let url: String?
        let error: String?
    }

    /// POST /create-checkout-session → Stripe-hosted checkout URL, opened
    /// in SFSafariViewController (Chunk 5 wires the UI + success return).
    static func createCheckoutSession(_ body: CheckoutRequest) async throws -> URL {
        var req = URLRequest(url: functionsBase.appendingPathComponent("create-checkout-session"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, _) = try await URLSession.shared.data(for: req)
        let decoded = try JSONDecoder().decode(CheckoutResponse.self, from: data)
        guard let urlString = decoded.url, let url = URL(string: urlString) else {
            throw NSError(domain: "LusikAPI", code: 1, userInfo: [
                NSLocalizedDescriptionKey: decoded.error ?? "Checkout unavailable. Please try again.",
            ])
        }
        return url
    }

    /// GET /inventory → availability snapshot (display-only cap; the server
    /// enforces the real limit at checkout).
    static func inventory() async throws -> [String: Int] {
        struct Wrapper: Decodable { let inventory: [String: Int]? }
        let url = functionsBase.appendingPathComponent("inventory")
        let (data, _) = try await URLSession.shared.data(from: url)
        return (try JSONDecoder().decode(Wrapper.self, from: data)).inventory ?? [:]
    }
}
