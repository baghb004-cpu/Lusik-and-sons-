import Foundation

/// Display mirror of the server's zone-priced shipping
/// (netlify/functions/_lib/shipping-zones.mjs — the file that actually
/// charges). Same prefix table, rates, and transit windows; the app shows
/// the estimate, the server recomputes from its own copy at checkout.
enum ShippingZones {
    struct Estimate {
        let zone: String
        let cents: Int
        let daysMin: Int
        let daysMax: Int

        var dollars: Double { Double(cents) / 100 }
        var label: String {
            zone == "AKHI" ? "UPS to Alaska / Hawaii / territories"
                           : "UPS Ground (zone \(zone))"
        }
    }

    // Ordered [loPrefix, hiPrefix, zone] over the ZIP's first 3 digits;
    // first match wins, anything unmatched falls to zone 8.
    private static let prefixZones: [(String, String, String)] = [
        ("995", "999", "AKHI"), ("967", "969", "AKHI"), ("006", "009", "AKHI"),
        ("900", "935", "2"),
        ("936", "939", "3"), ("889", "893", "3"),
        ("940", "961", "4"), ("894", "899", "4"), ("850", "865", "4"),
        ("840", "847", "5"), ("870", "884", "5"), ("800", "816", "5"),
        ("798", "799", "5"), ("885", "885", "5"), ("970", "979", "5"),
        ("832", "838", "5"), ("820", "831", "5"),
        ("980", "994", "6"), ("590", "599", "6"), ("660", "679", "6"),
        ("730", "749", "6"), ("750", "797", "6"),
        ("680", "693", "7"), ("570", "577", "7"), ("580", "588", "7"),
        ("500", "528", "7"), ("630", "658", "7"), ("716", "729", "7"),
        ("700", "714", "7"),
    ]

    private static let rateCents: [String: Int] = [
        "2": 999, "3": 1049, "4": 1149, "5": 1249,
        "6": 1349, "7": 1449, "8": 1549, "AKHI": 2499,
    ]

    private static let transitDays: [String: (Int, Int)] = [
        "2": (1, 2), "3": (2, 3), "4": (2, 3), "5": (3, 4),
        "6": (3, 4), "7": (4, 5), "8": (4, 5), "AKHI": (5, 7),
    ]

    static func isValidZip(_ zip: String) -> Bool {
        zip.count == 5 && zip.allSatisfy(\.isNumber)
    }

    /// nil until the ZIP is a usable 5-digit code.
    static func estimate(for zip: String) -> Estimate? {
        guard isValidZip(zip) else { return nil }
        let prefix = String(zip.prefix(3))
        let zone = prefixZones.first { prefix >= $0.0 && prefix <= $0.1 }?.2 ?? "8"
        let (lo, hi) = transitDays[zone] ?? (4, 5)
        return Estimate(zone: zone, cents: rateCents[zone] ?? 1549, daysMin: lo, daysMax: hi)
    }
}
