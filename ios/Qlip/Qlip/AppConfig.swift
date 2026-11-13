import Foundation
import Supabase

enum AppConfig {
    static let supabaseURL = URL(string: "https://sjskpjgepbvblojohtlr.supabase.co")!

    // Supabase anon keys are publishable client identifiers. Service-role and
    // AI provider keys never ship in Qlip; Edge Functions read those from Vault.
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqc2twamdlcGJ2Ymxvam9odGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzIzMzYsImV4cCI6MjA4NDU0ODMzNn0.x17WuelrlAXL_5UCyWo2FfD5BkH7IrPJbPWa9c125fY"

    static let supabase = SupabaseClient(
        supabaseURL: supabaseURL,
        supabaseKey: supabaseAnonKey
    )

    private static let functionsSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 45
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }()

    /// Saves use their own connection pool so image and list traffic can never
    /// delay the one user action that must feel immediate.
    static func functionsClient(accessToken: String) -> FunctionsClient {
        FunctionsClient(
            url: supabaseURL.appendingPathComponent("functions/v1"),
            headers: [
                "apikey": supabaseAnonKey,
                "Authorization": "Bearer \(accessToken)",
            ],
            fetch: { request in
                var request = request
                request.timeoutInterval = 30
                return try await functionsSession.data(for: request)
            }
        )
    }

    private static let aiFunctionsSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 150
        configuration.timeoutIntervalForResource = 180
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }()

    /// AI functions (translate, future TTS) run an LLM server-side with a 140s
    /// budget — the default 30s client timeout aborts them mid-flight, so they
    /// get their own long-timeout session.
    static func aiFunctionsClient(accessToken: String) -> FunctionsClient {
        FunctionsClient(
            url: supabaseURL.appendingPathComponent("functions/v1"),
            headers: [
                "apikey": supabaseAnonKey,
                "Authorization": "Bearer \(accessToken)",
            ],
            fetch: { request in
                var request = request
                request.timeoutInterval = 150
                return try await aiFunctionsSession.data(for: request)
            }
        )
    }

    static let appGroup = "group.com.mohamedatef.Qlip"
}
