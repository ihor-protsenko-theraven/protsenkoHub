import Foundation

struct SleepWidgetSnapshot: Codable {
    let childName: String
    let state: String
    let nextSleepAt: String?
    let receivedAt: String
    let asleepMs: Int64
    let timeZone: String
    var notice: String? = nil
}

struct SleepWidgetServerSnapshot: Decodable {
    struct Active: Decodable {
        let sessionId: String
        let revision: Int
        let asleepMs: Int64
    }

    let schemaVersion: Int
    let timeZone: String
    let childName: String
    let state: String
    let nextSleepAt: String?
    let active: Active?

    func projected(at date: Date) -> SleepWidgetSnapshot? {
        guard schemaVersion == 1,
              ["idle", "sleeping", "paused", "stale"].contains(state) else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return SleepWidgetSnapshot(
            childName: String(childName.prefix(40)),
            state: state,
            nextSleepAt: nextSleepAt,
            receivedAt: formatter.string(from: date),
            asleepMs: max(0, active?.asleepMs ?? 0),
            timeZone: timeZone
        )
    }
}

enum SleepWidgetStore {
    static let groupID = "group.com.protsenko.hub"
    static let kind = "SleepWidget"
    private static let key = "sleepWidgetSnapshot"

    static func read() -> SleepWidgetSnapshot? {
        guard let data = UserDefaults(suiteName: groupID)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(SleepWidgetSnapshot.self, from: data)
    }

    static func write(_ snapshot: SleepWidgetSnapshot) -> Bool {
        guard let defaults = UserDefaults(suiteName: groupID),
              let data = try? JSONEncoder().encode(snapshot) else { return false }
        defaults.set(data, forKey: key)
        return true
    }

    static func clear() {
        UserDefaults(suiteName: groupID)?.removeObject(forKey: key)
    }
}
