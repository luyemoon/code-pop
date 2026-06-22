import SwiftUI

struct PopArtTheme {
    static let primary = Color(hex: "FF006E")
    static let secondary = Color(hex: "3A86FF")
    static let accent = Color(hex: "FFBE0B")
    static let success = Color(hex: "06D6A0")
    static let warning = Color(hex: "FB5607")
    static let dark = Color(hex: "1A1A2E")
    static let cardBackground = Color(hex: "16213E")
    static let surface = Color(hex: "0F3460")

    static let titleFont = Font.system(size: 28, weight: .black, design: .rounded)
    static let headlineFont = Font.system(size: 18, weight: .bold, design: .rounded)
    static let bodyFont = Font.system(size: 13, weight: .medium, design: .default)
    static let captionFont = Font.system(size: 11, weight: .semibold, design: .monospaced)

    static func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "ok", "indexed", "online", "healthy":
            return success
        case "indexing", "busy", "degraded":
            return warning
        case "error", "offline":
            return primary
        default:
            return secondary
        }
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
