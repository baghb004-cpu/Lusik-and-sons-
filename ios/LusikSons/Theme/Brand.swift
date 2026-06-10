import SwiftUI

/// Brand tokens — the Swift mirror of the website's CSS variables
/// (src/styles/index.css). Change values here, never inline at call sites
/// (same "dial board" rule as the web CONFIG).
enum Brand {
    // Core palette (light theme values; dark variants come with Chunk 8).
    static let ink = Color(red: 0x1A / 255, green: 0x16 / 255, blue: 0x12 / 255)        // #1A1612
    static let cream = Color(red: 0xF5 / 255, green: 0xEF / 255, blue: 0xE3 / 255)      // #F5EFE3
    static let creamSubtle = Color(red: 0xFA / 255, green: 0xF6 / 255, blue: 0xEC / 255) // #FAF6EC
    static let accent = Color(red: 0xB0 / 255, green: 0x88 / 255, blue: 0x42 / 255)     // gold #B08842
    static let textOnInk = cream

    // Typography. Fraunces (display) + DM Sans (body) ship in Chunk 6;
    // these fall back to system faces so every chunk builds without assets.
    static func fontDisplay(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }

    static func fontBody(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    // Spacing rhythm used across the web layouts.
    static let cornerRadius: CGFloat = 18
    static let pillRadius: CGFloat = 999
}
