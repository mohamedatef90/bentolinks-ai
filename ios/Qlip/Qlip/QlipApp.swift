//
//  QlipApp.swift
//  Qlip
//
//  Created by Mohamed Atef on 21/07/2026.
//

import SwiftUI
import SwiftData

@main
struct QlipApp: App {
    @StateObject private var store = QlipStore()
    @Environment(\.scenePhase) private var scenePhase
    @State private var showingSplash = true
    @AppStorage("qlip-appearance") private var appearance = QlipAppearance.default.rawValue

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .environmentObject(store)
                    .preferredColorScheme(appearance == QlipAppearance.default.rawValue ? .dark : .light)
                    .id(appearance)
                if showingSplash {
                    QlipSplashView()
                        .transition(.opacity)
                        .zIndex(10)
                }
            }
            .task {
                guard showingSplash else { return }
                try? await Task.sleep(for: .milliseconds(1500))
                withAnimation(.easeOut(duration: 0.3)) { showingSplash = false }
            }
        }
        .backgroundTask(.appRefresh(BackgroundRefresh.identifier)) {
            await store.performBackgroundRefresh()
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                Task { await store.applicationDidBecomeActive() }
            case .background:
                store.applicationDidEnterBackground()
            default:
                break
            }
        }
    }
}

private struct QlipSplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var markAppeared = false
    @State private var copyAppeared = false

    var body: some View {
        ZStack {
            QlipTheme.background.ignoresSafeArea()
            VStack(spacing: 20) {
                Image("QlipLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 132, height: 132)
                    .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
                    .scaleEffect(markAppeared ? 1 : 0.94)
                    .opacity(markAppeared ? 1 : 0)
                VStack(spacing: 7) {
                    Text("Qlip")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(QlipTheme.foreground)
                    Text("YOUR KNOWLEDGE VAULT")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(2.2)
                        .foregroundStyle(QlipTheme.foregroundMuted)
                }
                .opacity(copyAppeared ? 1 : 0)
                .offset(y: copyAppeared ? 0 : 8)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Qlip is opening")
        .onAppear {
            guard !reduceMotion else {
                markAppeared = true
                copyAppeared = true
                return
            }
            withAnimation(.easeOut(duration: 0.24)) {
                markAppeared = true
            }
            withAnimation(.easeOut(duration: 0.22).delay(0.09)) {
                copyAppeared = true
            }
        }
    }
}
