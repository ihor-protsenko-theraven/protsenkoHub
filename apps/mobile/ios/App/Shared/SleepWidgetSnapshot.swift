import Foundation

struct SleepWidgetSnapshot: Codable {
    struct LastSleep: Codable {
        let kind: String
        let startedAt: String
        let endedAt: String
        let asleepMs: Int64
    }

    let childName: String
    let state: String
    let nextSleepAt: String?
    let receivedAt: String
    let asleepMs: Int64
    let timeZone: String
    var kind: String? = nil
    var startedAt: String? = nil
    var pauseCount: Int? = nil
    var lastSleep: LastSleep? = nil
    var sessionId: String? = nil
    var revision: Int? = nil
    var notice: String? = nil
}

struct SleepWidgetServerSnapshot: Decodable {
    struct Active: Decodable {
        let sessionId: String
        let revision: Int
        let asleepMs: Int64
        let kind: String?
        let startedAt: String?
        let pauseCount: Int?
    }

    let schemaVersion: Int
    let timeZone: String
    let childName: String
    let state: String
    let nextSleepAt: String?
    let lastSleep: SleepWidgetSnapshot.LastSleep?
    let active: Active?

    func projected(at date: Date) -> SleepWidgetSnapshot? {
        guard schemaVersion == 1,
              ["idle", "sleeping", "paused", "stale"].contains(state) else { return nil }
        if ["sleeping", "paused"].contains(state) {
            guard let active,
                  !active.sessionId.isEmpty,
                  active.sessionId.utf8.count <= 128,
                  active.revision >= 0 else { return nil }
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return SleepWidgetSnapshot(
            childName: String(childName.prefix(40)),
            state: state,
            nextSleepAt: nextSleepAt,
            receivedAt: formatter.string(from: date),
            asleepMs: max(0, active?.asleepMs ?? 0),
            timeZone: String(timeZone.prefix(64)),
            kind: active?.kind,
            startedAt: active?.startedAt,
            pauseCount: active?.pauseCount,
            lastSleep: lastSleep,
            sessionId: active?.sessionId,
            revision: active?.revision
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
