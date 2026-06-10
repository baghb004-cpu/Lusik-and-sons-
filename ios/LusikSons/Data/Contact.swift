import Foundation

/// Contact channels — the Swift mirror of the web's CONFIG.TEXT_US
/// (src/data/config.js): the one source of truth for the phone + email
/// the app shows, the exact strings the website and the server's order
/// emails use. Change values here, never inline at call sites.
enum Contact {
    static let phoneE164 = "+17608742333"
    static let phoneDisplay = "(760) 874-2333"
    static let smsPrefill = "Hi Lusik & Sons — "   // seeds the SMS body so threads are recognizable
    static let email = "hello@lusikandsons.com"
    static let headline = "Send us a text."
    static let subhead = "Lusik or one of her sons writes back, usually within a day."

    /// sms: link with the brand prefill (web TextUsWidget parity).
    static var smsURL: URL {
        var components = URLComponents()
        components.scheme = "sms"
        components.path = phoneE164
        components.queryItems = [URLQueryItem(name: "body", value: smsPrefill)]
        return components.url!
    }

    static var mailURL: URL {
        URL(string: "mailto:\(email)")!
    }
}

/// Chat assistant strings — mirror of CONFIG.PAID_FEATURES.CHAT_ASSISTANT.
/// Whether chat is LIVE is the server's call (the /chat Function answers
/// 503 until ANTHROPIC_API_KEY is set); these are just the UI strings.
enum ChatConfig {
    static let launcherLabel = "Ask us anything"
    static let welcome = "Hello — I'm the Lusik & Sons assistant. Ask me about the alphabet blanket, the bibs, the towels, the colors Lusik works in, shipping, sizing, anything. If a question is best for Lusik herself, I'll tell you that too."
    static let placeholder = "Type your question…"
}
