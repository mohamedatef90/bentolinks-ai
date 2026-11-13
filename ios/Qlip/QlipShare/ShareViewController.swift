import Social
import UniformTypeIdentifiers

private enum ShareDestination: String, Codable, CaseIterable {
    case auto, bookmark, content

    var title: String {
        switch self {
        case .auto: "Automatic"
        case .bookmark: "Bookmarks"
        case .content: "Reading"
        }
    }

    var explanation: String {
        switch self {
        case .auto: "Domains become Bookmarks; posts, articles and files become Reading."
        case .bookmark: "Keep this link in Bookmarks."
        case .content: "Keep this link in Reading."
        }
    }
}

private struct SharedFolder: Codable, Identifiable {
    let id: UUID
    let name: String
}

private struct SharedCapture: Codable {
    let id: UUID
    let url: URL
    let destination: ShareDestination
    let folderID: UUID?
    let savedVia: String
    let note: String?
    let createdAt: Date
}

private struct SharedSaveRequest: Encodable {
    let url: String
    let destination: String
    let folderID: UUID?
    let savedVia: String
    let note: String?

    enum CodingKeys: String, CodingKey {
        case url, destination, note
        case folderID = "folder_id"
        case savedVia = "saved_via"
    }
}

final class ShareViewController: SLComposeServiceViewController {
    private let appGroup = "group.com.mohamedatef.Qlip"
    private let captureKey = "pending-captures-v2"
    private let foldersKey = "share-folders-v1"
    private let accessTokenKey = "share-access-token-v1"
    private let lastDestinationKey = "share-last-destination-v1"
    private let lastFolderKey = "share-last-folder-v1"
    private let supabaseURL = URL(string: "https://sjskpjgepbvblojohtlr.supabase.co")!
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqc2twamdlcGJ2Ymxvam9odGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzIzMzYsImV4cCI6MjA4NDU0ODMzNn0.x17WuelrlAXL_5UCyWo2FfD5BkH7IrPJbPWa9c125fY"
    private var destination: ShareDestination = .auto
    private var selectedFolder: SharedFolder?

    private var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    override func viewDidLoad() {
        super.viewDidLoad()
        restoreLastChoice()
        title = "Save to Qlip"
        placeholder = "Add context for future you (optional)"
        navigationItem.titleView = makeLogoView()
        view.tintColor = UIColor(red: 0.66, green: 0.81, blue: 0.22, alpha: 1)
    }

    override func isContentValid() -> Bool { true }

    override func didSelectPost() {
        Task { @MainActor in
            guard let url = await sharedURL() else {
                let error = NSError(
                    domain: "QlipShare",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Qlip could not find a valid web link in this share."]
                )
                extensionContext?.cancelRequest(withError: error)
                return
            }

            let capture = enqueue(url, note: captureNote(excluding: url))
            if let capture, await uploadIfAuthenticated(capture) {
                remove(capture)
            }
            extensionContext?.completeRequest(returningItems: [])
        }
    }

    override func configurationItems() -> [Any]! {
        let destinationItem = SLComposeSheetConfigurationItem()!
        destinationItem.title = "Destination"
        destinationItem.value = destination == .auto ? "Automatic · Qlip decides" : destination.title
        destinationItem.tapHandler = { [weak self] in self?.presentDestinationPicker() }

        let folderItem = SLComposeSheetConfigurationItem()!
        folderItem.title = "Category"
        folderItem.value = selectedFolder?.name ?? "AI chooses"
        folderItem.tapHandler = { [weak self] in self?.presentFolderPicker() }

        let contextItem = SLComposeSheetConfigurationItem()!
        contextItem.title = "Capture"
        contextItem.value = sharedHostLabel()
        contextItem.tapHandler = { }
        return [destinationItem, folderItem, contextItem]
    }

    private func presentDestinationPicker() {
        let sheet = UIAlertController(
            title: "Where should Qlip save it?",
            message: "Automatic is recommended. Qlip puts domains in Bookmarks and articles, posts, and files in Reading. You can move it later.",
            preferredStyle: .actionSheet
        )
        for option in ShareDestination.allCases {
            let label = option == destination ? "✓ \(option.title)" : option.title
            sheet.addAction(UIAlertAction(title: label, style: .default) { [weak self] _ in
                self?.destination = option
                self?.persistChoice()
                self?.reloadConfigurationItems()
            })
        }
        sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        presentSheet(sheet)
    }

    private func presentFolderPicker() {
        let sheet = UIAlertController(
            title: "Choose a category",
            message: "AI chooses lets Qlip categorize the Bookmark after enrichment.",
            preferredStyle: .actionSheet
        )
        let unfiledTitle = selectedFolder == nil ? "✓ AI chooses" : "AI chooses"
        sheet.addAction(UIAlertAction(title: unfiledTitle, style: .default) { [weak self] _ in
            self?.selectedFolder = nil
            self?.persistChoice()
            self?.reloadConfigurationItems()
        })
        for folder in cachedFolders() {
            let label = folder.id == selectedFolder?.id ? "✓ \(folder.name)" : folder.name
            sheet.addAction(UIAlertAction(title: label, style: .default) { [weak self] _ in
                self?.selectedFolder = folder
                self?.persistChoice()
                self?.reloadConfigurationItems()
            })
        }
        sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        presentSheet(sheet)
    }

    private func presentSheet(_ sheet: UIAlertController) {
        if let popover = sheet.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 20, width: 1, height: 1)
        }
        present(sheet, animated: true)
    }

    private func cachedFolders() -> [SharedFolder] {
        guard let data = defaults?.data(forKey: foldersKey) else { return [] }
        return ((try? JSONDecoder().decode([SharedFolder].self, from: data)) ?? [])
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private func restoreLastChoice() {
        if let savedDestination = defaults?.string(forKey: lastDestinationKey), let value = ShareDestination(rawValue: savedDestination) {
            destination = value
        }
        if let savedFolderID = defaults?.string(forKey: lastFolderKey), let id = UUID(uuidString: savedFolderID) {
            selectedFolder = cachedFolders().first { $0.id == id }
        }
    }

    private func persistChoice() {
        defaults?.set(destination.rawValue, forKey: lastDestinationKey)
        defaults?.set(selectedFolder?.id.uuidString, forKey: lastFolderKey)
    }

    private func sharedHostLabel() -> String {
        if let url = normalizedURL(contentText) { return url.host() ?? "Web link" }
        return "Web link"
    }

    private func sharedURL() async -> URL? {
        if let url = normalizedURL(contentText) { return url }

        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            if let value = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier),
               let url = value as? URL,
               isWebURL(url) {
                return url
            }
        }

        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            if let value = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier),
               let text = value as? String,
               let url = normalizedURL(text) {
                return url
            }
        }
        return nil
    }

    private func normalizedURL(_ value: String?) -> URL? {
        guard let value else { return nil }
        for token in value.split(whereSeparator: \Character.isWhitespace) {
            if let url = URL(string: String(token)), isWebURL(url) { return url }
        }
        return nil
    }

    private func isWebURL(_ url: URL) -> Bool {
        ["http", "https"].contains(url.scheme?.lowercased())
    }

    private func captureNote(excluding url: URL) -> String? {
        let note = contentText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty, note != url.absoluteString else { return nil }
        return String(note.prefix(1000))
    }

    private func enqueue(_ url: URL, note: String?) -> SharedCapture? {
        var captures: [SharedCapture] = []
        if let data = defaults?.data(forKey: captureKey) {
            captures = (try? JSONDecoder().decode([SharedCapture].self, from: data)) ?? []
        }
        if let existing = captures.first(where: {
            $0.url.absoluteString == url.absoluteString &&
            $0.destination == destination &&
            $0.folderID == selectedFolder?.id
        }) { return existing }
        let capture = SharedCapture(
            id: UUID(),
            url: url,
            destination: destination,
            folderID: selectedFolder?.id,
            savedVia: "extension",
            note: note,
            createdAt: .now
        )
        captures.append(capture)
        if let data = try? JSONEncoder().encode(captures) {
            defaults?.set(data, forKey: captureKey)
        }
        return capture
    }

    /// Upload immediately when the host app has shared a current user token.
    /// The durable app-group queue remains the fallback for an expired token,
    /// no network, or iOS terminating the extension early.
    private func uploadIfAuthenticated(_ capture: SharedCapture) async -> Bool {
        guard let token = defaults?.string(forKey: accessTokenKey), !token.isEmpty else { return false }
        var request = URLRequest(url: supabaseURL.appendingPathComponent("functions/v1/save-item"))
        request.httpMethod = "POST"
        request.timeoutInterval = 12
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(SharedSaveRequest(
            url: capture.url.absoluteString,
            destination: capture.destination.rawValue,
            folderID: capture.folderID,
            savedVia: capture.savedVia,
            note: capture.note
        ))
        guard request.httpBody != nil else { return false }
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
        } catch {
            return false
        }
    }

    private func remove(_ capture: SharedCapture) {
        guard let data = defaults?.data(forKey: captureKey),
              var captures = try? JSONDecoder().decode([SharedCapture].self, from: data) else { return }
        captures.removeAll { $0.id == capture.id }
        defaults?.set(try? JSONEncoder().encode(captures), forKey: captureKey)
    }

    private func makeLogoView() -> UIView {
        let container = UIView(frame: CGRect(x: 0, y: 0, width: 116, height: 32))
        let imageView = UIImageView(image: UIImage(named: "QlipLogo"))
        imageView.contentMode = .scaleAspectFit
        imageView.frame = CGRect(x: 0, y: 0, width: 32, height: 32)
        imageView.layer.cornerRadius = 8
        imageView.clipsToBounds = true
        let label = UILabel(frame: CGRect(x: 39, y: 0, width: 77, height: 32))
        label.text = "Qlip"
        label.font = .systemFont(ofSize: 18, weight: .bold)
        label.textColor = .label
        container.addSubview(imageView)
        container.addSubview(label)
        return container
    }
}
