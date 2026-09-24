import UIKit

/// The edition's type size for the reader's system text size (Dynamic Type), bead
/// am-app-settings-prepaint-tydj requirement 4. The edition has its own steps
/// (am:settings:v1:typeScale), read from the edition manifest, so the app never keeps a list.
enum EditionTypeSize {
    /// The system's default text size, which is the edition's 100 percent.
    static let reference = UIContentSizeCategory.large

    /// The smallest step at least as large as the system's body text relative to its size at the
    /// default, capped at the largest step: the reader never gets smaller text than they asked
    /// for, as far as the edition's steps go. With the steps 100, 112, 125 and 150 this gives
    /// 100 from extra small to large, 112 at extra large, 125 at extra extra large, and 150 from
    /// extra extra extra large through every accessibility size (EditionSettingsTests).
    static func percent(for category: UIContentSizeCategory, steps: [Int]) -> Int? {
        let sorted = steps.sorted()
        guard let largest = sorted.last else { return nil }
        let wanted = bodySize(category) / bodySize(reference) * 100
        // Half a percent of slack: 19 pt over 17 pt is 111.8 percent, which the 112 step covers.
        return sorted.first { Double($0) >= wanted - 0.5 } ?? largest
    }

    static func bodySize(_ category: UIContentSizeCategory) -> Double {
        let traits = UITraitCollection(preferredContentSizeCategory: category)
        return Double(UIFont.preferredFont(forTextStyle: .body, compatibleWith: traits).pointSize)
    }
}

/// The settings snapshot script (src/platform/app-bridge/settingsSnapshot.ts), verified by its
/// digest, with the JSON of the app's settings in place of its one placeholder. The script keeps
/// only fields and values it knows, whatever this sends.
struct SettingsSnapshot: Sendable {
    struct Values: Encodable, Equatable, Sendable {
        let typeSize: Int?
    }

    let template: String
    let placeholder: String

    /// Nil unless the placeholder occurs exactly once.
    init?(template: String, placeholder: String) {
        guard !placeholder.isEmpty, template.components(separatedBy: placeholder).count == 2 else { return nil }
        self.template = template
        self.placeholder = placeholder
    }

    func source(_ values: Values) -> String? {
        guard let json = try? JSONEncoder().encode(values), let text = String(bytes: json, encoding: .utf8) else {
            return nil
        }
        return template.replacingOccurrences(of: placeholder, with: text)
    }
}
