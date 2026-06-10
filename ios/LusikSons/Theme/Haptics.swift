import UIKit

/// The app's haptic vocabulary — parity with the website's haptic.js
/// touchpoints (SiteProvider's add/remove buzzes, QuantityPicker's
/// steps), graded with native generators instead of navigator.vibrate's
/// single buzz. The system mutes these per user settings on its own;
/// haptics aren't motion, so no reduced-motion gate.
enum Haptics {
    /// Add to bag / buy now (web haptic(12)).
    static func add() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    /// Removing a bag row (web haptic(8)).
    static func remove() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    /// Quantity / option stepping (web haptic(8) on the qty picker).
    static func step() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    /// Chrome taps — tab switches (Chunk 6's light impact, now shared).
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    /// A completed moment — order placed, waitlist joined.
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
