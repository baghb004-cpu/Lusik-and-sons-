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

    // ── waitlist (Chunk 8) ──

    enum APIError: LocalizedError {
        /// A failure carrying the server's customer-facing message.
        case message(String)

        var errorDescription: String? {
            if case .message(let text) = self { return text }
            return nil
        }
    }

    /// POST /waitlist → { ok: true } (netlify/functions/waitlist.mjs).
    /// Public + IP-rate-limited server-side; `productKey` must match the
    /// web CATALOG key (the server shape-validates it), so the admin
    /// Notify sweep sees app and website signups as one list.
    static func joinWaitlist(email: String, productKey: String, productName: String) async throws {
        struct Body: Encodable {
            let email: String
            let product_key: String
            let product_name: String
        }
        struct Reply: Decodable {
            let ok: Bool?
            let error: String?
        }
        var req = URLRequest(url: functionsBase.appendingPathComponent("waitlist"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(Body(email: email, product_key: productKey, product_name: productName))
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let decoded = try? JSONDecoder().decode(Reply.self, from: data)
        guard status == 200, decoded?.ok == true else {
            throw APIError.message(decoded?.error
                ?? "We couldn't add you just now — please try again, or write to \(Contact.email).")
        }
    }

    // ── chat (Chunk 7) ──

    struct ChatMessage: Codable, Hashable {
        let role: String          // "user" | "assistant"
        let content: String
    }

    enum ChatError: LocalizedError {
        /// 503 — the function exists but ANTHROPIC_API_KEY isn't set yet.
        /// The UI falls back to the real channels (SMS + email).
        case notConfigured
        /// Any other failure, carrying the server's customer-facing message
        /// (rate-limit copy, "having trouble right now", …).
        case server(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured: return "The assistant isn't online yet."
            case .server(let message): return message
            }
        }
    }

    /// POST /chat → assistant reply (netlify/functions/chat.mjs, the same
    /// Anthropic proxy the website's ChatAssistant uses — the API key never
    /// ships in the app). The full visible history goes up each turn; the
    /// server holds no state. `sessionId` feeds its per-session daily cap.
    static func sendChat(messages: [ChatMessage], sessionId: String) async throws -> String {
        struct Body: Encodable {
            let messages: [ChatMessage]
            let sessionId: String
        }
        struct Reply: Decodable {
            let reply: String?
            let error: String?
        }
        var req = URLRequest(url: functionsBase.appendingPathComponent("chat"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(Body(messages: messages, sessionId: sessionId))
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let decoded = try? JSONDecoder().decode(Reply.self, from: data)
        if status == 503 { throw ChatError.notConfigured }
        guard status == 200, let reply = decoded?.reply else {
            throw ChatError.server(decoded?.error ?? "The assistant is having trouble right now. Please try again in a moment.")
        }
        return reply
    }
}
