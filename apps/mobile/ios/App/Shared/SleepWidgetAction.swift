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

    func replacingTarget(_ source: SleepWidgetServerSnapshot) -> SleepWidgetActionCredential {
        SleepWidgetActionCredential(
            token: token, expiresAt: expiresAt, apiOrigin: apiOrigin,
            sessionId: source.active?.sessionId ?? "",
            revision: source.active?.revision ?? -1, state: source.state
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
              ["idle", "sleeping", "paused"].contains(snapshot.state),
              let credential = read(),
              matches(snapshot, credential: credential) else { return nil }
        return credential.reference
    }

    static func matches(_ snapshot: SleepWidgetSnapshot?, credential: SleepWidgetActionCredential) -> Bool {
        guard let snapshot else { return false }
        return snapshot.notice == nil
            && snapshot.state == credential.state
            && (snapshot.sessionId ?? "") == credential.sessionId
            && (snapshot.revision ?? -1) == credential.revision
    }
}

private struct SleepWidgetActionResponse: Decodable {
    let snapshot: SleepWidgetServerSnapshot
}

enum SleepWidgetActionClient {
    static func perform(action: String, sessionId: String, revision: Int) async {
        defer { WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.kind) }
        guard ["start", "pause", "resume", "save", "delete"].contains(action),
              let credential = SleepWidgetActionStore.read(),
              credential.sessionId == sessionId,
              credential.revision == revision,
              ((action == "start" && credential.state == "idle")
                || (action == "pause" && credential.state == "sleeping")
                || (action == "resume" && credential.state == "paused")
                || (["save", "delete"].contains(action)
                    && ["sleeping", "paused"].contains(credential.state))),
              SleepWidgetActionStore.reference(for: SleepWidgetStore.read()) != nil else {
            return
        }

        do {
            // Compare the live state with the card that was tapped before mutating anything.
            let live = try await requestSnapshot(credential)
            let matchesLive = action == "start"
                ? live.active == nil && live.state == "idle"
                : live.active?.sessionId == sessionId
                    && live.active?.revision == revision
                    && live.state == credential.state
            guard matchesLive else {
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
              current.state == prior.state,
              SleepWidgetActionStore.matches(SleepWidgetStore.read(), credential: prior) else { return }
        guard var display = source.projected(at: Date()) else {
            showFailure("Оновіть у застосунку", using: prior)
            return
        }
        display.notice = notice
        guard SleepWidgetActionStore.write(prior.replacingTarget(source)) else { return }
        _ = SleepWidgetStore.write(display)
    }

    private static func showFailure(_ message: String, using prior: SleepWidgetActionCredential) {
        guard let current = SleepWidgetActionStore.read(),
              current.token == prior.token,
              current.sessionId == prior.sessionId,
              current.revision == prior.revision,
              current.state == prior.state else { return }
        guard var display = SleepWidgetStore.read(),
              SleepWidgetActionStore.matches(display, credential: prior) else { return }
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
        var parameters: [String: Any] = ["action": action]
        if action != "start" {
            parameters["expectedSessionId"] = credential.sessionId
            parameters["expectedRevision"] = credential.revision
        }
        let body = try JSONSerialization.data(withJSONObject: parameters)
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
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 12
        request.setValue("Bearer \(credential.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request, delegate: SleepNoRedirectDelegate())
        guard let status = (response as? HTTPURLResponse)?.statusCode else {
            throw SleepWidgetActionError.invalidResponse
        }
        guard data.count <= 65_536 else { throw SleepWidgetActionError.invalidResponse }
        switch status {
        case 200..<300: return data
        case 401, 403: throw SleepWidgetActionError.unauthorized
        case 409: throw SleepWidgetActionError.conflict
        default: throw SleepWidgetActionError.server
        }
    }
}

private final class SleepNoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
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
