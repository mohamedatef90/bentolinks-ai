import SwiftUI

enum QlipAppearance: String, CaseIterable, Identifiable {
    case `default`
    case professional
    case funny

    var id: String { rawValue }
    var title: String {
        switch self {
        case .default: "Magic Black"
        case .professional: "Professional"
        case .funny: "Playful"
        }
    }
    var icon: String {
        switch self {
        case .default: "moon.stars.fill"
        case .professional: "briefcase.fill"
        case .funny: "face.smiling.inverse"
        }
    }
}

enum QlipTheme {
    // Primitive tokens. Components below use semantic aliases only.
    private static let midnight = Color(red: 8 / 255, green: 19 / 255, blue: 31 / 255)
    private static let panel = Color(red: 16 / 255, green: 33 / 255, blue: 49 / 255)
    private static let panelRaised = Color(red: 24 / 255, green: 48 / 255, blue: 68 / 255)
    private static let lime = Color(red: 185 / 255, green: 230 / 255, blue: 75 / 255)
    private static let mint = Color(red: 97 / 255, green: 213 / 255, blue: 138 / 255)
    private static let amber = Color(red: 242 / 255, green: 184 / 255, blue: 75 / 255)
    private static let cloud = Color(red: 244 / 255, green: 247 / 255, blue: 242 / 255)
    private static let mist = Color(red: 154 / 255, green: 171 / 255, blue: 183 / 255)
    private static let hairline = Color(red: 41 / 255, green: 65 / 255, blue: 85 / 255)

    private static var appearance: QlipAppearance {
        QlipAppearance(rawValue: UserDefaults.standard.string(forKey: "qlip-appearance") ?? "default") ?? .default
    }

    // Semantic tokens mirror the web app's three appearance choices.
    static var background: Color {
        switch appearance {
        case .default: midnight
        case .professional: Color(red: 244 / 255, green: 247 / 255, blue: 250 / 255)
        case .funny: Color(red: 1, green: 248 / 255, blue: 232 / 255)
        }
    }
    static var surface: Color {
        switch appearance {
        case .default: panel
        case .professional: .white
        case .funny: Color(red: 1, green: 1, blue: 248 / 255)
        }
    }
    static var surfaceRaised: Color {
        switch appearance {
        case .default: panelRaised
        case .professional: Color(red: 231 / 255, green: 237 / 255, blue: 243 / 255)
        case .funny: Color(red: 255 / 255, green: 234 / 255, blue: 204 / 255)
        }
    }
    static var primary: Color {
        appearance == .funny ? Color(red: 236 / 255, green: 72 / 255, blue: 153 / 255) : lime
    }
    static var success: Color {
        appearance == .professional ? Color(red: 35 / 255, green: 148 / 255, blue: 91 / 255) : mint
    }
    static var warning: Color { amber }
    static var foreground: Color {
        appearance == .default ? cloud : Color(red: 15 / 255, green: 30 / 255, blue: 44 / 255)
    }
    static var foregroundMuted: Color {
        appearance == .default ? mist : Color(red: 91 / 255, green: 105 / 255, blue: 117 / 255)
    }
    static var border: Color {
        appearance == .default ? hairline : Color(red: 209 / 255, green: 218 / 255, blue: 226 / 255)
    }
    static var destructive: Color { Color(red: 0.92, green: 0.25, blue: 0.25) }

    static let controlRadius: CGFloat = 14
    static let cardRadius: CGFloat = 22
    static let heroRadius: CGFloat = 28
    static let horizontalPadding: CGFloat = 20
    /// Keeps a tab-root scroll view's final controls clear of the system tab bar.
    /// The value includes a small breathing room above the 49pt tab bar and home
    /// indicator, and is intentionally not used by pushed detail screens.
    static let tabBarClearance: CGFloat = 104

    static var brandGradient: LinearGradient {
        LinearGradient(colors: [primary, success], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

struct QlipBackdrop: View {
    var body: some View {
        ZStack {
            QlipTheme.background
            Circle()
                .fill(QlipTheme.primary.opacity(0.10))
                .frame(width: 280, height: 280)
                .blur(radius: 75)
                .offset(x: 150, y: -300)
            Circle()
                .fill(QlipTheme.success.opacity(0.07))
                .frame(width: 240, height: 240)
                .blur(radius: 85)
                .offset(x: -170, y: 330)
        }
        .ignoresSafeArea()
    }
}

struct QlipMark: View {
    var size: CGFloat = 42

    var body: some View {
        Image("QlipLogo")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
            .shadow(color: QlipTheme.primary.opacity(0.18), radius: 16, y: 8)
            .accessibilityHidden(true)
    }
}

extension View {
    func qlipCard(radius: CGFloat = QlipTheme.cardRadius) -> some View {
        self
            .background(QlipTheme.surface.opacity(0.94), in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(QlipTheme.border.opacity(0.75), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.12), radius: 18, y: 10)
    }
}
