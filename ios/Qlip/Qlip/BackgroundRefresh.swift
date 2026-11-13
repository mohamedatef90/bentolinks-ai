import BackgroundTasks
import Foundation

/// iOS grants background time opportunistically, so this is a reliability
/// layer rather than the place where AI work happens. The server keeps parsing
/// and enriching after `save-item` accepts a URL; this task retries any URL
/// that the phone could not hand off before it was suspended.
enum BackgroundRefresh {
    static let identifier = "com.mohamedatef.Qlip.refresh"

    static func schedule(after delay: TimeInterval = 20) {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: delay)
        // iOS permits one pending request per identifier. A duplicate request
        // simply means one is already scheduled, which is exactly what we want.
        try? BGTaskScheduler.shared.submit(request)
    }
}
