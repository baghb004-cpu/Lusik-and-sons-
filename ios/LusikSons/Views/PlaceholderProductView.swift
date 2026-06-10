import SwiftUI

// ============================================================
// PlaceholderProductView — coming-soon products + the waitlist
// ============================================================
// The web's unpriced-placeholder path (ProductPlaceholderView +
// WaitlistModal), natively: name/tagline/description from the catalog
// mirror, a disabled "Currently unavailable" bar with "Price coming
// soon.", and the one-field waitlist signup that POSTs to the same
// /waitlist Function the website uses — app and site signups land in
// one list for the admin Notify sweep. No photos yet (Lusik's are
// pending), so the gold-wash band carries the title, like the journal
// cards.

struct PlaceholderProductView: View {
    let placeholder: PlaceholderProduct

    @State private var email = ""
    @State private var busy = false
    @State private var joined = false
    @State private var errorText: String?

    private var emailValid: Bool {
        // Same shape check the website runs before POSTing.
        email.trimmingCharacters(in: .whitespaces)
            .range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
    }

    private var mailtoURL: URL {
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = Contact.email
        components.queryItems = [URLQueryItem(name: "subject", value: "Inquiry: \(placeholder.name)")]
        return components.url!
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                cover

                Text(placeholder.tagline)
                    .font(Brand.fontBody(15, weight: .medium))
                    .foregroundStyle(Brand.ink.opacity(0.75))

                Text(placeholder.description)
                    .font(Brand.fontBody(15))
                    .lineSpacing(5)
                    .foregroundStyle(Brand.inkSoft)

                unavailableBar

                waitlistCard

                Link(destination: mailtoURL) {
                    Text("Or write Lusik directly — \(Contact.email) — if you'd rather have the conversation in her own words.")
                        .font(Brand.fontBody(12))
                        .underline()
                        .foregroundStyle(Brand.ink.opacity(0.65))
                        .multilineTextAlignment(.leading)
                }
            }
            .padding(18)
        }
        .background(Brand.cream)
        .navigationBarTitleDisplayMode(.inline)
    }

    // Gold-wash "cover" band — stands in for photos until Lusik shoots
    // them (web placeholder-template parity).
    private var cover: some View {
        Text(placeholder.name)
            .font(Brand.fontDisplay(30))
            .foregroundStyle(Brand.ink)
            .multilineTextAlignment(.leading)
            .padding(20)
            .frame(maxWidth: .infinity, minHeight: 200, alignment: .bottomLeading)
            .background(
                LinearGradient(
                    stops: [
                        .init(color: Brand.accent.opacity(0.22), location: 0),
                        .init(color: Brand.accent.opacity(0.07), location: 0.55),
                        .init(color: Brand.ink.opacity(0.04), location: 1),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(alignment: .topLeading) {
                Text("Almost ready")
                    .font(Brand.fontBody(10, weight: .semibold))
                    .kerning(3)
                    .textCase(.uppercase)
                    .foregroundStyle(Brand.accent)
                    .padding(.top, 18)
                    .padding(.leading, 20)
            }
            .clipShape(RoundedRectangle(cornerRadius: 22))
    }

    private var unavailableBar: some View {
        VStack(spacing: 8) {
            Text("Currently unavailable")
                .font(Brand.fontBody(14, weight: .semibold))
                .kerning(1.2)
                .textCase(.uppercase)
                .foregroundStyle(Brand.ink.opacity(0.45))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(Brand.creamSubtle, in: RoundedRectangle(cornerRadius: Brand.pillRadius))

            Text("Price coming soon.")
                .font(Brand.fontBody(13))
                .italic()
                .foregroundStyle(Brand.accent)
                .frame(maxWidth: .infinity)
        }
        .padding(.top, 4)
    }

    private var waitlistCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            if joined {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Brand.accent)
                    Text("Added — we'll write you the day \(placeholder.name) is ready.")
                        .font(Brand.fontBody(13, weight: .medium))
                        .foregroundStyle(Brand.ink)
                }
            } else {
                Text("A single note, the day it's ready")
                    .font(Brand.fontBody(10, weight: .semibold))
                    .kerning(2)
                    .textCase(.uppercase)
                    .foregroundStyle(Brand.ink.opacity(0.7))

                HStack(spacing: 8) {
                    TextField("you@example.com", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(Brand.fontBody(14))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 11)
                        .background(Brand.surface, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Brand.ink.opacity(0.15), lineWidth: 1))
                        .onSubmit(join)
                        .accessibilityLabel("Email address")

                    Button(action: join) {
                        Text(busy ? "…" : "Write me")
                            .font(Brand.fontBody(12, weight: .semibold))
                            .kerning(1.2)
                            .textCase(.uppercase)
                            .foregroundStyle(Brand.textOnInk)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 13)
                            .background(Brand.ink.opacity(busy ? 0.5 : 1), in: RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(busy)
                    .accessibilityLabel("Join the waitlist")
                }

                if let errorText {
                    Text(errorText)
                        .font(Brand.fontBody(12))
                        .italic()
                        .foregroundStyle(.red)
                }
            }
        }
        .padding(14)
        .background(Brand.creamSubtle, in: RoundedRectangle(cornerRadius: Brand.cornerRadius))
    }

    private func join() {
        guard !busy, !joined else { return }
        guard emailValid else {
            errorText = "Please enter a valid email address."
            return
        }
        errorText = nil
        busy = true
        Task {
            do {
                try await LusikAPI.joinWaitlist(
                    email: email.trimmingCharacters(in: .whitespaces),
                    productKey: placeholder.key,
                    productName: placeholder.name
                )
                joined = true
                Haptics.success()
            } catch {
                errorText = error.localizedDescription
            }
            busy = false
        }
    }
}

// The category-grid card for a placeholder (web "{name} — coming soon"
// cards) — full-width, gold-wash band, no photo yet.
struct PlaceholderCard: View {
    let placeholder: PlaceholderProduct

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(placeholder.name)
                .font(Brand.fontDisplay(20, weight: .medium))
                .foregroundStyle(Brand.ink)
                .multilineTextAlignment(.leading)
                .padding(16)
                .frame(maxWidth: .infinity, minHeight: 110, alignment: .bottomLeading)
                .background(
                    LinearGradient(
                        stops: [
                            .init(color: Brand.accent.opacity(0.2), location: 0),
                            .init(color: Brand.accent.opacity(0.06), location: 0.6),
                            .init(color: Brand.ink.opacity(0.04), location: 1),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(alignment: .topLeading) {
                    Text("Coming soon")
                        .font(Brand.fontBody(9, weight: .semibold))
                        .kerning(2)
                        .textCase(.uppercase)
                        .foregroundStyle(Brand.textOnInk)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(Brand.ink.opacity(0.75), in: Capsule())
                        .padding(10)
                }

            VStack(alignment: .leading, spacing: 8) {
                Text(placeholder.tagline)
                    .font(Brand.fontBody(13))
                    .foregroundStyle(Brand.ink.opacity(0.7))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text("Get one note when it's ready →")
                    .font(Brand.fontBody(11, weight: .medium))
                    .kerning(1)
                    .textCase(.uppercase)
                    .foregroundStyle(Brand.accent)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Brand.surface)
        }
        .clipShape(RoundedRectangle(cornerRadius: Brand.cornerRadius))
        .overlay(RoundedRectangle(cornerRadius: Brand.cornerRadius).strokeBorder(Brand.ink.opacity(0.08), lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(placeholder.name) — coming soon")
    }
}

#Preview("Page") {
    NavigationStack {
        PlaceholderProductView(placeholder: Placeholders.all[0])
    }
}

#Preview("Card") {
    PlaceholderCard(placeholder: Placeholders.all[1])
        .padding(18)
        .background(Brand.cream)
}
