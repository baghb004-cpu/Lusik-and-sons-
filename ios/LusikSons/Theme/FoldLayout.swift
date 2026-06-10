import SwiftUI

/// Layout adaptivity for big and UNFOLDED canvases — written ahead of the
/// book-style iPhone Fold (7.8" 4:3 inner display, 5.5" cover screen,
/// horizontal book fold, wider passport-like form factor).
///
/// How it maps to SwiftUI: the inner display lands in the iPad-mini size
/// ballpark (7.9" 4:3), so the system will express the opened posture as a
/// REGULAR horizontal size class; the cover screen behaves like today's
/// compact iPhones, which the existing layouts already serve. Nothing here
/// needs fold-specific API — size classes are how the posture reaches
/// SwiftUI — so the same rules light up correctly TODAY on iPads and
/// landscape Max phones, and on the Fold's inner screen the day it ships.
///
/// The rule set ("the open book"):
///   • the glass island stays a centered pill, never a full-width runway
///   • photo-led product pages become a two-page SPREAD — photos on the
///     left page, the buy column on the right (no pill sheet to drag;
///     everything is already visible)
///   • grids gain columns; prose and forms cap at a readable column
enum FoldLayout {
    /// Long-form text column (journal posts, placeholder pages) — capped
    /// so lines stay readable on the open 4:3 canvas.
    static let readableWidth: CGFloat = 640

    /// Forms and stacked cards (checkout, bag rows) — a touch wider
    /// than prose.
    static let contentWidth: CGFloat = 700

    /// The floating glass island's cap on wide canvases.
    static let islandMaxWidth: CGFloat = 430

    /// The photo "page" share of the open-book product spread.
    static let spreadPhotoFraction: CGFloat = 0.55
}
