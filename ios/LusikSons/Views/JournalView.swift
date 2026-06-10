import SwiftUI

// ============================================================
// Journal — Lusik's mini-blog, native edition (Chunk 7)
// ============================================================
// Mirrors the website's mobile journal (JournalView.jsx): the editorial
// card list ("Read something new" — gold-wash cover bands carrying the
// title, since posts have no per-post art) and the single-post page
// rendering the typed content nodes (p / h2 / blockquote) with the
// "Keep reading" aside. Post data is the generated Swift mirror in
// Data/JournalPosts.swift.

struct JournalTabView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Read something new")
                        .font(Brand.fontBody(24, weight: .bold))
                        .foregroundStyle(Brand.ink)
                        .padding(.bottom, 2)

                    ForEach(JournalPosts.all) { post in
                        NavigationLink(value: post) {
                            JournalCard(post: post)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 24)
            }
            .background(Brand.cream)
            .navigationTitle("Journal")
            .navigationDestination(for: JournalPost.self) { post in
                JournalPostView(post: post)
            }
        }
    }
}

// One editorial card — cover band (gold wash + the title set large,
// web mobile-card parity) over an excerpt + read-time meta row.
private struct JournalCard: View {
    let post: JournalPost

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(post.title)
                .font(Brand.fontDisplay(24))
                .foregroundStyle(Brand.ink)
                .multilineTextAlignment(.leading)
                .padding(20)
                .frame(maxWidth: .infinity, minHeight: 172, alignment: .bottomLeading)
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
                    Text("Journal")
                        .font(Brand.fontBody(10, weight: .semibold))
                        .kerning(3)
                        .textCase(.uppercase)
                        .foregroundStyle(Brand.accent)
                        .padding(.top, 18)
                        .padding(.leading, 20)
                }

            VStack(alignment: .leading, spacing: 12) {
                Text(post.excerpt)
                    .font(Brand.fontBody(14))
                    .lineSpacing(4)
                    .foregroundStyle(Brand.ink.opacity(0.7))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 6) {
                    Image(systemName: "book")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(Brand.accent)
                    Text("\(post.readMinutes) min read")
                    Text("·").opacity(0.4)
                    Text(post.formattedDate)
                }
                .font(Brand.fontBody(12))
                .foregroundStyle(Brand.ink.opacity(0.55))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 20)
            .background(Brand.surface)
        }
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(Brand.ink.opacity(0.08), lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(post.title) — \(post.readMinutes) minute read")
    }
}

// The single post — eyebrow meta row, display title, typed nodes,
// "Keep reading" aside pushing the two other most-recent posts.
struct JournalPostView: View {
    let post: JournalPost

    private var others: [JournalPost] {
        Array(JournalPosts.all.filter { $0.slug != post.slug }.prefix(2))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    Text("Journal")
                        .foregroundStyle(Brand.accent)
                    Text("·").opacity(0.4)
                    Text(post.formattedDate)
                        .foregroundStyle(Brand.ink.opacity(0.7))
                    Text("·").opacity(0.4)
                    Text("\(post.readMinutes) min read")
                        .foregroundStyle(Brand.ink.opacity(0.7))
                }
                .font(Brand.fontBody(10, weight: .medium))
                .kerning(1.5)
                .textCase(.uppercase)
                .foregroundStyle(Brand.ink)

                Text(post.title)
                    .font(Brand.fontDisplay(32))
                    .foregroundStyle(Brand.ink)
                    .padding(.top, 12)

                VStack(alignment: .leading, spacing: 22) {
                    ForEach(Array(post.content.enumerated()), id: \.offset) { _, node in
                        nodeView(node)
                    }
                }
                .padding(.top, 28)

                if !others.isEmpty {
                    keepReading
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 22)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .background(Brand.cream)
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func nodeView(_ node: JournalNode) -> some View {
        switch node {
        case .p(let text):
            Text(text)
                .font(Brand.fontBody(17))
                .lineSpacing(6)
                .foregroundStyle(Brand.inkSoft)
        case .h2(let text):
            Text(text)
                .font(Brand.fontDisplay(24))
                .foregroundStyle(Brand.ink)
                .padding(.top, 12)
        case .blockquote(let text):
            Text(text)
                .font(Brand.fontDisplay(19))
                .italic()
                .lineSpacing(5)
                .foregroundStyle(Brand.inkSoft)
                .padding(.leading, 18)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(Brand.accent)
                        .frame(width: 2)
                }
        }
    }

    private var keepReading: some View {
        VStack(alignment: .leading, spacing: 16) {
            Rectangle()
                .fill(Brand.ink.opacity(0.12))
                .frame(height: 1)

            Text("Keep reading")
                .font(Brand.fontBody(10, weight: .semibold))
                .kerning(3)
                .textCase(.uppercase)
                .foregroundStyle(Brand.accent)

            ForEach(others) { other in
                NavigationLink(value: other) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(other.formattedDate)
                            .font(Brand.fontBody(10))
                            .kerning(2)
                            .textCase(.uppercase)
                            .foregroundStyle(Brand.ink.opacity(0.7))
                        Text(other.title)
                            .font(Brand.fontDisplay(18, weight: .medium))
                            .foregroundStyle(Brand.ink)
                            .multilineTextAlignment(.leading)
                        Text(other.excerpt)
                            .font(Brand.fontBody(12))
                            .lineSpacing(3)
                            .foregroundStyle(Brand.ink.opacity(0.7))
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .background(Brand.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Brand.cornerRadius))
                    .overlay(
                        RoundedRectangle(cornerRadius: Brand.cornerRadius)
                            .strokeBorder(Brand.ink.opacity(0.1), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 44)
    }
}

#Preview("List") {
    JournalTabView()
}

#Preview("Post") {
    NavigationStack {
        JournalPostView(post: JournalPosts.all[0])
    }
}
