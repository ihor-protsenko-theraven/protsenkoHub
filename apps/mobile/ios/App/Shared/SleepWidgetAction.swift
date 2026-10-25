import AppIntents
import Foundation
import Security
import WidgetKit

struct SleepWidgetActionReference {
    let sessionId: String
    let revision: Int
    let state: String
}

struct SleepWidgetActionCredential: Codable {
    let token: String
    let expiresAt: String
    let apiOrigin: String
    let sessionId: String
    let revision: Int
    let state: String

    var reference: SleepWidgetActionReference {
        SleepWidgetActionReference(sessionId: sessionId, revision: revision, state: state)
    }

    var isUsable: Bool {
        guard !token.isEmpty,
              let expiry = SleepWidgetActionStore.parseDate(expiresAt),
              expiry > Date(),
              let url = URL(string: apiOrigin),
              url.scheme == "https", url.host != nil,
              (url.path.isEmpty || url.path == "/"),
              url.query == nil, url.fragment == nil,
              url.user == nil, url.password == nil else { return false }
        return true
    }

    func replacingTarget(_ active: SleepWidgetServerSnapshot.Active, state: String) -> SleepWidgetActionCredential {
        SleepWidgetActionCredential(
            token: token, expiresAt: expiresAt, apiOrigin: apiOrigin,
            sessionId: active.sessionId, revision: active.revision, state: state
        )
    }
}

enum SleepWidgetActionStore {
    private static let service = "com.protsenko.hub.sleep-widget.action"
    private static let account = "credential"

    static func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    private static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: SleepWidgetStore.groupID
        ]
    }

    static func read() -> SleepWidgetActionCredential? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(lookup as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let credential = try? JSONDecoder().decode(SleepWidgetActionCredential.self, from: data),
              credential.isUsable else { return nil }
        return credential
    }

    static func write(_ credential: SleepWidgetActionCredential) -> Bool {
        guard credential.isUsable,
              let data = try? JSONEncoder().encode(credential) else { return false }
        let updated = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if updated == errSecSuccess { return true }
        guard updated == errSecItemNotFound else { return false }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
    }

    static func clearIfCurrent(_ expected: SleepWidgetActionCredential) {
        guard let current = read(), current.token == expected.token else { return }
        clear()
        SleepWidgetStore.clear()
    }

    static func reference(for snapshot: SleepWidgetSnapshot?) -> SleepWidgetActionReference? {
        guard let snapshot,
              snapshot.notice == nil,
              ["sleeping", "paused"].contains(snapshot.state),
              let receivedAt = parseDate(snapshot.receivedAt),
              Date().timeIntervalSince(receivedAt) >= -5 * 60,
              Date().timeIntervalSince(receivedAt) < 45 * 60,
              let credential = read(),
              credential.state == snapshot.state else { return nil }
        return credential.reference
    }
}

private struct SleepWidgetActionResponse: Decodable {
    let snapshot: SleepWidgetServerSnapshot
}

enum SleepWidgetActionClient {
    static func perform(action: String, sessionId: String, revision: Int) async {
        defer { WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.kind) }
        guard ["pause", "resume"].contains(action),
              let credential = SleepWidgetActionStore.read(),
              credential.sessionId == sessionId,
              credential.revision == revision,
              credential.state == (action == "pause" ? "sleeping" : "paused"),
              SleepWidgetActionStore.reference(for: SleepWidgetStore.read()) != nil else {
            return
        }

        do {
            // Compare the live state with the card that was tapped before mutating anything.
            let live = try await requestSnapshot(credential)
            guard live.active?.sessionId == sessionId,
                  live.active?.revision == revision,
                  live.state == credential.state else {
                publish(live, using: credential, notice: "Стан оновлено")
                return
            }

            let result = try await requestAction(action, credential: credential)
            publish(result, using: credential, notice: nil)
        } catch let error as SleepWidgetActionError {
            switch error {
            case .unauthorized:
                SleepWidgetActionStore.clearIfCurrent(credential)
            case .conflict:
                do {
                    let refreshed = try await requestSnapshot(credential)
                    publish(refreshed, using: credential, notice: "Стан оновлено")
                } catch SleepWidgetActionError.unauthorized {
                    SleepWidgetActionStore.clearIfCurrent(credential)
                } catch {
                    showFailure("Оновіть у застосунку", using: credential)
                }
            case .invalidResponse, .server:
                showFailure("Оновіть у застосунку", using: credential)
            }
        } catch {
            showFailure("Немає зв’язку", using: credential)
        }
    }

    private static func publish(
        _ source: SleepWidgetServerSnapshot,
        using prior: SleepWidgetActionCredential,
        notice: String?
    ) {
        guard let current = SleepWidgetActionStore.read(),
              current.token == prior.token,
              current.sessionId == prior.sessionId,
              current.revision == prior.revision,
              current.state == prior.state else { return }
        guard var display = source.projected(at: Date()) else {
            showFailure("Оновіть у застосунку", using: prior)
            return
        }
        display.notice = notice
        guard SleepWidgetStore.write(display) else { return }
        if let active = source.active, ["sleeping", "paused"].contains(source.state) {
            if !SleepWidgetActionStore.write(prior.replacingTarget(active, state: source.state)) {
                SleepWidgetActionStore.clear()
            }
        } else {
            SleepWidgetActionStore.clear()
        }
    }

    private static func showFailure(_ message: String, using prior: SleepWidgetActionCredential) {
        guard let current = SleepWidgetActionStore.read(), current.token == prior.token else { return }
        guard var display = SleepWidgetStore.read() else { return }
        display.notice = message
        _ = SleepWidgetStore.write(display)
    }

    private static func requestSnapshot(_ credential: SleepWidgetActionCredential) async throws -> SleepWidgetServerSnapshot {
        let data = try await request("GET", path: "/api/v1/children/sleep/widget", credential: credential)
        guard let source = try? JSONDecoder().decode(SleepWidgetServerSnapshot.self, from: data),
              source.projected(at: Date()) != nil else { throw SleepWidgetActionError.invalidResponse }
        return source
    }

    private static func requestAction(
        _ action: String,
        credential: SleepWidgetActionCredential
    ) async throws -> SleepWidgetServerSnapshot {
        let body = try JSONSerialization.data(withJSONObject: [
            "action": action,
            "expectedSessionId": credential.sessionId,
            "expectedRevision": credential.revision
        ])
        let data = try await request(
            "POST", path: "/api/v1/children/sleep/widget/action", credential: credential, body: body
        )
        guard let result = try? JSONDecoder().decode(SleepWidgetActionResponse.self, from: data),
              result.snapshot.projected(at: Date()) != nil else { throw SleepWidgetActionError.invalidResponse }
        return result.snapshot
    }

    private static func request(
        _ method: String,
        path: String,
        credential: SleepWidgetActionCredential,
        body: Data? = nil
    ) async throws -> Data {
        guard credential.isUsable,
              let url = URL(string: credential.apiOrigin + path) else { throw SleepWidgetActionError.unauthorized }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 12
        request.setValue("Bearer \(credential.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let status = (response as? HTTPURLResponse)?.statusCode else {
            throw SleepWidgetActionError.invalidResponse
        }
        switch status {
        case 200..<300: return data
        case 401, 403: throw SleepWidgetActionError.unauthorized
        case 409: throw SleepWidgetActionError.conflict
        default: throw SleepWidgetActionError.server
        }
    }
}

private enum SleepWidgetActionError: Error {
    case unauthorized
    case conflict
    case invalidResponse
    case server
}

@available(iOS 17.0, *)
struct SleepToggleIntent: AppIntent {
    static var title: LocalizedStringResource = "Змінити стан сну"
    static var openAppWhenRun = false

    @Parameter(title: "Дія") var action: String
    @Parameter(title: "Сеанс") var sessionId: String
    @Parameter(title: "Версія") var revision: Int

    init() {}

    init(action: String, sessionId: String, revision: Int) {
        self.action = action
        self.sessionId = sessionId
        self.revision = revision
    }

    func perform() async throws -> some IntentResult {
        await SleepWidgetActionClient.perform(
            action: action, sessionId: sessionId, revision: revision
        )
        return .result()
    }
}
