import Foundation

/// One journal post — the Swift mirror of a web JOURNAL_POSTS entry
/// (slug/title/excerpt/publishedAt/readMinutes + typed content nodes).
/// The data itself is generated into Data/JournalPosts.swift by
/// ios/scripts/gen-journal-swift.mjs; this file is the hand-written shape.
struct JournalPost: Identifiable, Hashable {
    let slug: String
    let title: String
    let excerpt: String
    let publishedAt: String      // "YYYY-MM-DD", same string the web stores
    let readMinutes: Int
    let content: [JournalNode]

    var id: String { slug }

    /// "May 17, 2026" — fixed en_US month names like the website's
    /// formatPublishedDate (posts are English-only), built from date
    /// components so a YYYY-MM-DD string never shifts a day via UTC.
    var formattedDate: String {
        let parts = publishedAt.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return publishedAt }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        guard let date = Calendar.current.date(from: components) else { return publishedAt }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter.string(from: date)
    }
}

/// Typed body node — web parity with { type: "p"|"h2"|"blockquote", text }.
enum JournalNode: Hashable {
    case p(String)
    case h2(String)
    case blockquote(String)
}
