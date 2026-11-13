import Foundation

struct PendingCapture: Codable, Identifiable, Hashable {
    let id: UUID
    let url: URL
    let destination: SaveDestination
    let folderID: UUID?
    let savedVia: String
    let note: String?
    let createdAt: Date

    init(
        id: UUID = UUID(),
        url: URL,
        destination: SaveDestination = .auto,
        folderID: UUID? = nil,
        savedVia: String,
        note: String? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.url = url
        self.destination = destination
        self.folderID = folderID
        self.savedVia = savedVia
        self.note = note?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        self.createdAt = createdAt
    }
}

enum ShareInbox {
    static let captureKey = "pending-captures-v2"
    static let legacyURLKey = "pending-shared-urls"
    static let foldersKey = "share-folders-v1"
    static let accessTokenKey = "share-access-token-v1"

    private static var defaults: UserDefaults? { UserDefaults(suiteName: AppConfig.appGroup) }
    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()

    static func enqueue(
        _ url: URL,
        destination: SaveDestination = .auto,
        folderID: UUID? = nil,
        savedVia: String,
        note: String? = nil
    ) {
        var captures = pending()
        guard !captures.contains(where: {
            $0.url.absoluteString == url.absoluteString &&
            $0.destination == destination &&
            $0.folderID == folderID
        }) else { return }
        captures.append(PendingCapture(
            url: url,
            destination: destination,
            folderID: folderID,
            savedVia: savedVia,
            note: note
        ))
        save(captures)
    }

    static func pending() -> [PendingCapture] {
        var captures: [PendingCapture] = []
        if let data = defaults?.data(forKey: captureKey) {
            captures = (try? decoder.decode([PendingCapture].self, from: data)) ?? []
        }

        // One-time compatibility with the first native build, which stored URL
        // strings only. Treat them as mobile automatic captures.
        let legacy = defaults?.stringArray(forKey: legacyURLKey) ?? []
        if !legacy.isEmpty {
            for value in legacy {
                guard let url = URL(string: value), !captures.contains(where: { $0.url == url }) else { continue }
                captures.append(PendingCapture(url: url, savedVia: "mobile"))
            }
            defaults?.removeObject(forKey: legacyURLKey)
            save(captures)
        }
        return captures.sorted { $0.createdAt < $1.createdAt }
    }

    static func remove(_ capture: PendingCapture) {
        save(pending().filter { $0.id != capture.id })
    }

    static func clear() {
        defaults?.removeObject(forKey: captureKey)
        defaults?.removeObject(forKey: legacyURLKey)
        defaults?.removeObject(forKey: accessTokenKey)
    }

    static func cacheAccessToken(_ token: String) {
        defaults?.set(token, forKey: accessTokenKey)
    }

    static func cacheFolders(_ folders: [QlipFolder]) {
        guard let data = try? encoder.encode(folders) else { return }
        defaults?.set(data, forKey: foldersKey)
    }

    private static func save(_ captures: [PendingCapture]) {
        guard let data = try? encoder.encode(captures) else { return }
        defaults?.set(data, forKey: captureKey)
    }
}
