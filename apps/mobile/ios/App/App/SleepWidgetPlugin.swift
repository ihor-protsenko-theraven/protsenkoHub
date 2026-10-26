import Capacitor
import Foundation
import WidgetKit

@objc(SleepWidgetPlugin)
public class SleepWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SleepWidgetPlugin"
    public let jsName = "SleepWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let raw = call.getString("snapshot"),
              raw.utf8.count <= 16_384,
              let data = raw.data(using: .utf8),
              let source = try? JSONDecoder().decode(SleepWidgetServerSnapshot.self, from: data),
              let snapshot = source.projected(at: Date()) else {
            call.reject("Invalid sleep widget snapshot")
            return
        }

        guard FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SleepWidgetStore.groupID
        ) != nil else {
            call.reject("Sleep widget App Group is unavailable")
            return
        }

        var credential: SleepWidgetActionCredential?
        if let action = call.getObject("actionCredential") {
            let active = source.active
            let isIdle = source.state == "idle" && active == nil
            guard isIdle || (["sleeping", "paused"].contains(source.state)
                    && active != nil && !active!.sessionId.isEmpty && active!.revision >= 0),
                  let token = action["token"] as? String, token.utf8.count <= 8_192,
                  let expiresAt = action["expiresAt"] as? String,
                  let apiOrigin = call.getString("apiOrigin"),
                  let expiry = SleepWidgetActionStore.parseDate(expiresAt),
                  expiry <= Date().addingTimeInterval(31 * 24 * 60 * 60) else {
                SleepWidgetActionStore.clear()
                WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.kind)
                call.reject("Invalid sleep widget action credential")
                return
            }
            credential = SleepWidgetActionCredential(
                token: token, expiresAt: expiresAt, apiOrigin: apiOrigin,
                sessionId: active?.sessionId ?? "", revision: active?.revision ?? -1,
                state: source.state
            )
        }

        if let credential {
            guard SleepWidgetActionStore.write(credential) else {
                SleepWidgetActionStore.clear()
                WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.kind)
                call.reject("Could not save the sleep widget action credential")
                return
            }
        } else {
            SleepWidgetActionStore.clear()
        }

        guard SleepWidgetStore.write(snapshot) else {
            SleepWidgetActionStore.clear()
            WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.kind)
            call.reject("Could not save the sleep widget snapshot")
            return
        }
        WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.kind)
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        SleepWidgetActionStore.clear()
        SleepWidgetStore.clear()
        WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.kind)
        call.resolve()
    }
}
