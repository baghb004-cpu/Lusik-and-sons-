import SwiftUI
import UIKit

/// Brand tokens — the Swift mirror of the website's CSS variables
/// (src/styles/index.css `:root` + `:root[data-theme="dark"]`). Change
/// values here, never inline at call sites (same "dial board" rule as the
/// web CONFIG). Every color is a light/dark pair, so dark mode is
/// automatic wherever the tokens are used — including the ink↔cream
/// inversion the website does (ink buttons render cream in dark, with
/// dark text on top, via `ink` + `textOnInk` flipping together).
enum Brand {
    // ── palette (web :root ↔ :root[data-theme="dark"]) ──
    static let ink = paired(0x1A1612, 0xF5EFE3)                       // --ink (inverts)
    static let cream = paired(0xF5EFE3, 0x15110E)                     // --bg-page
    static let creamSubtle = paired(0xFAF6EC, 0x251D17)               // --bg-subtle
    static let surface = paired(0xFFFFFF, 0x1F1814)                   // --bg-surface (cards, inputs)
    static let accent = paired(0xB08842, 0xC9A678)                    // gold (brighter for dark-bg contrast)
    static let inkSoft = paired(0x3D332A, 0xF5EFE3, darkAlpha: 0.78)  // --text-secondary (long-form prose)
    static let textOnInk = paired(0xF5EFE3, 0x1A1612)                 // --text-on-ink (inverts with ink)

    /// Shadows stay BLACK in both modes — never shadow with `ink`,
    /// it inverts to cream in dark and would cast light.
    static let shadow = Color.black

    /// The 1px highlight rim on glass chrome — bright in light mode,
    /// faint in dark (the web island's bevel).
    static let glassBevel = Color(uiColor: UIColor { trait in
        UIColor.white.withAlphaComponent(trait.userInterfaceStyle == .dark ? 0.16 : 0.55)
    })

    // ── typography ──
    // Fraunces (display) + DM Sans (body) still pending font files; system
    // serif/sans keep every chunk building. Sizes are the design-time
    // values and SCALE with the user's Dynamic Type setting (relative to
    // .body — the system-font equivalent of Font.custom(_:size:relativeTo:)).
    static func fontDisplay(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: scaled(size), weight: weight, design: .serif)
    }

    static func fontBody(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: scaled(size), weight: weight, design: .default)
    }

    private static func scaled(_ size: CGFloat) -> CGFloat {
        UIFontMetrics(forTextStyle: .body).scaledValue(for: size)
    }

    // ── spacing rhythm used across the web layouts ──
    static let cornerRadius: CGFloat = 18
    static let pillRadius: CGFloat = 999

    // ── helpers ──
    private static func paired(_ light: UInt32, _ dark: UInt32, darkAlpha: CGFloat = 1) -> Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? uiColor(dark, alpha: darkAlpha)
                : uiColor(light, alpha: 1)
        })
    }

    private static func uiColor(_ hex: UInt32, alpha: CGFloat) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}
