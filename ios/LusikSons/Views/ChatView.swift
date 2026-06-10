import SwiftUI

// ============================================================
// ChatView — "Text Lusik", native edition (Chunk 7)
// ============================================================
// The website's ChatAssistant as a sheet: same welcome copy, same
// bubble layout, same optimistic-send-with-rollback behavior, backed
// by the same POST /chat Netlify Function (an Anthropic proxy — the
// key never ships in the app). The transcript is in-memory only, like
// a web refresh clearing it. A per-install session id feeds the
// server's per-session daily cap.
//
// Chat is OFF server-side until Lusik sets ANTHROPIC_API_KEY (the
// function answers 503) — in that case this view swaps the composer
// for the real channels (text + email), so the sheet stays useful
// from day one.

struct ChatView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var messages: [LusikAPI.ChatMessage] = [
        .init(role: "assistant", content: ChatConfig.welcome),
    ]
    @State private var input = ""
    @State private var sending = false
    @State private var errorText: String?
    @State private var assistantOffline = false
    @State private var typingPulse = false
    @FocusState private var composerFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            transcript
            if assistantOffline {
                offlinePanel
            } else {
                composer
                disclaimer
            }
        }
        .background(Brand.cream)
    }

    // ── header ──

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "sparkles")
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Brand.accent)
            Text("Lusik & Sons")
                .font(Brand.fontDisplay(16, weight: .medium))
                .foregroundStyle(Brand.ink)
            Text("AI")
                .font(Brand.fontBody(9, weight: .semibold))
                .kerning(2)
                .foregroundStyle(Brand.ink.opacity(0.55))
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Brand.ink.opacity(0.7))
            }
            .accessibilityLabel("Close chat")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(Brand.surface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Brand.ink.opacity(0.08)).frame(height: 1)
        }
    }

    // ── transcript ──

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(Array(messages.enumerated()), id: \.offset) { _, message in
                        bubble(message)
                    }
                    if sending {
                        typingBubble
                    }
                    if let errorText {
                        Text(errorText)
                            .font(Brand.fontBody(12))
                            .italic()
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(16)
            }
            .onChange(of: messages.count) { scrollToBottom(proxy) }
            .onChange(of: sending) { scrollToBottom(proxy) }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        if reduceMotion {
            proxy.scrollTo("bottom", anchor: .bottom)
        } else {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo("bottom", anchor: .bottom)
            }
        }
    }

    @ViewBuilder
    private func bubble(_ message: LusikAPI.ChatMessage) -> some View {
        let isUser = message.role == "user"
        HStack(spacing: 0) {
            if isUser { Spacer(minLength: 48) }
            Text(message.content)
                .font(Brand.fontBody(15))
                .lineSpacing(3)
                .foregroundStyle(isUser ? Brand.textOnInk : Brand.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(isUser ? AnyShapeStyle(Brand.ink) : AnyShapeStyle(Brand.surface))
                )
                .overlay {
                    if !isUser {
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Brand.ink.opacity(0.1), lineWidth: 1)
                    }
                }
                .textSelection(.enabled)
            if !isUser { Spacer(minLength: 48) }
        }
    }

    private var typingBubble: some View {
        HStack {
            Text("● ● ●")
                .font(Brand.fontBody(10))
                .foregroundStyle(Brand.ink.opacity(0.45))
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Brand.surface))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Brand.ink.opacity(0.1), lineWidth: 1))
                .opacity(reduceMotion ? 1 : (typingPulse ? 1 : 0.35))
                .onAppear {
                    guard !reduceMotion else { return }
                    withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) {
                        typingPulse = true
                    }
                }
                .onDisappear { typingPulse = false }
            Spacer(minLength: 48)
        }
        .accessibilityLabel("Assistant is typing")
    }

    // ── composer + footer ──

    private var composer: some View {
        HStack(spacing: 10) {
            TextField(ChatConfig.placeholder, text: $input)
                .font(Brand.fontBody(15))
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 10).fill(Brand.cream))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Brand.ink.opacity(0.12), lineWidth: 1))
                .focused($composerFocused)
                .submitLabel(.send)
                .onSubmit(send)
                .accessibilityLabel("Type your message")

            Button(action: send) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textOnInk)
                    .padding(11)
                    .background(Circle().fill(Brand.ink))
            }
            .disabled(sending || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(sending || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1)
            .accessibilityLabel("Send message")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Brand.surface)
        .overlay(alignment: .top) {
            Rectangle().fill(Brand.ink.opacity(0.08)).frame(height: 1)
        }
    }

    private var disclaimer: some View {
        Text("AI-generated · Verify before relying")
            .font(Brand.fontBody(9, weight: .medium))
            .kerning(1.5)
            .textCase(.uppercase)
            .foregroundStyle(Brand.ink.opacity(0.5))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background(Brand.surface)
    }

    // ── offline fallback (server answered 503) ──

    private var offlinePanel: some View {
        VStack(spacing: 14) {
            VStack(spacing: 5) {
                Text("The assistant isn't online yet.")
                    .font(Brand.fontDisplay(17, weight: .medium))
                    .foregroundStyle(Brand.ink)
                Text(Contact.subhead)
                    .font(Brand.fontBody(13))
                    .foregroundStyle(Brand.ink.opacity(0.65))
                    .multilineTextAlignment(.center)
            }

            Link(destination: Contact.smsURL) {
                Label("Text \(Contact.phoneDisplay)", systemImage: "message")
                    .font(Brand.fontBody(14, weight: .semibold))
                    .foregroundStyle(Brand.textOnInk)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Capsule().fill(Brand.ink))
            }

            Link(destination: Contact.mailURL) {
                Label(Contact.email, systemImage: "envelope")
                    .font(Brand.fontBody(14, weight: .medium))
                    .foregroundStyle(Brand.ink)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Capsule().fill(Brand.surface))
                    .overlay(Capsule().strokeBorder(Brand.ink.opacity(0.15), lineWidth: 1))
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .background(Brand.surface)
        .overlay(alignment: .top) {
            Rectangle().fill(Brand.ink.opacity(0.08)).frame(height: 1)
        }
    }

    // ── send ──

    private func send() {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !sending else { return }
        errorText = nil
        let previous = messages
        messages.append(.init(role: "user", content: trimmed))
        input = ""
        sending = true
        composerFocused = true   // keep the keyboard up between turns (web parity)
        Task {
            do {
                let reply = try await LusikAPI.sendChat(messages: messages, sessionId: ChatSession.id)
                messages.append(.init(role: "assistant", content: reply))
            } catch LusikAPI.ChatError.notConfigured {
                rollBack(to: previous, restoring: trimmed)
                assistantOffline = true
            } catch let error as LusikAPI.ChatError {
                rollBack(to: previous, restoring: trimmed)
                errorText = error.localizedDescription
            } catch {
                rollBack(to: previous, restoring: trimmed)
                errorText = "Couldn't reach the assistant. Please try again."
            }
            sending = false
        }
    }

    /// Failed turn: take the optimistic user bubble back out so a retry
    /// doesn't double it, and put their words back in the composer (web
    /// parity) — unless they've already started typing something new.
    private func rollBack(to previous: [LusikAPI.ChatMessage], restoring text: String) {
        messages = previous
        if input.isEmpty { input = text }
    }
}

/// Stable per-install id for the server's per-session daily cap —
/// the web keeps the same thing in localStorage ("ls_chat_session").
private enum ChatSession {
    private static let key = "lusik.chat.session"

    static var id: String {
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: key) { return existing }
        let fresh = UUID().uuidString
        defaults.set(fresh, forKey: key)
        return fresh
    }
}

#Preview {
    ChatView()
}
