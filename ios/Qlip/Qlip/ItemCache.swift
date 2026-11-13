import Foundation
import SwiftData

@Model
final class CachedContentItem {
    @Attribute(.unique) var id: UUID
    var payload: Data
    var savedAt: Date

    init(id: UUID, payload: Data, savedAt: Date = .now) {
        self.id = id
        self.payload = payload
        self.savedAt = savedAt
    }
}

@MainActor
final class ItemCache {
    private let container: ModelContainer?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        container = try? ModelContainer(
            for: CachedContentItem.self,
            configurations: ModelConfiguration("QlipCache")
        )
    }

    func load() -> [ContentItem] {
        guard let container else { return [] }
        let context = ModelContext(container)
        var descriptor = FetchDescriptor<CachedContentItem>(
            sortBy: [SortDescriptor(\.savedAt, order: .reverse)]
        )
        descriptor.fetchLimit = 80
        return (try? context.fetch(descriptor))?
            .compactMap { try? decoder.decode(ContentItem.self, from: $0.payload) } ?? []
    }

    func replace(with items: [ContentItem]) {
        guard let container else { return }
        let context = ModelContext(container)
        if let existing = try? context.fetch(FetchDescriptor<CachedContentItem>()) {
            existing.forEach(context.delete)
        }
        for item in items {
            guard let payload = try? encoder.encode(item) else { continue }
            context.insert(CachedContentItem(id: item.id, payload: payload))
        }
        try? context.save()
    }

    func clear() {
        replace(with: [])
    }
}
