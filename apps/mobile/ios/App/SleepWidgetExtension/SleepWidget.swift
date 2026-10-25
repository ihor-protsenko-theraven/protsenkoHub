import AppIntents
import SwiftUI
import WidgetKit

private enum SleepWidgetClock {
    static let staleAfter: TimeInterval = 45 * 60
    static let clockTolerance: TimeInterval = 5 * 60

    static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value)
    }

    static func label(_ date: Date, timeZone: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "uk_UA")
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    static func duration(_ milliseconds: Int64) -> String {
        let minutes = max(0, milliseconds) / 60_000
        return String(format: "%d:%02d", minutes / 60, minutes % 60)
    }
}

private struct SleepEntry: TimelineEntry {
    let date: Date
    let snapshot: SleepWidgetSnapshot?
    let action: SleepWidgetActionReference?
}

private struct SleepProvider: TimelineProvider {
    func placeholder(in context: Context) -> SleepEntry {
        SleepEntry(date: Date(), snapshot: SleepWidgetSnapshot(
            childName: "Дитина", state: "idle", nextSleepAt: nil,
            receivedAt: "", asleepMs: 0, timeZone: "Europe/Kyiv"
        ), action: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SleepEntry) -> Void) {
        let snapshot = SleepWidgetStore.read()
        completion(SleepEntry(
            date: Date(), snapshot: snapshot,
            action: SleepWidgetActionStore.reference(for: snapshot)
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SleepEntry>) -> Void) {
        let now = Date()
        let snapshot = SleepWidgetStore.read()
        let action = SleepWidgetActionStore.reference(for: snapshot)
        var entries = [SleepEntry(date: now, snapshot: snapshot, action: action)]
        var refresh = now.addingTimeInterval(15 * 60)
        if action != nil,
           let credential = SleepWidgetActionStore.read(),
           let expiry = SleepWidgetActionStore.parseDate(credential.expiresAt),
           expiry > now, expiry < refresh {
            entries.append(SleepEntry(date: expiry, snapshot: snapshot, action: nil))
            refresh = expiry.addingTimeInterval(15 * 60)
        }
        if let snapshot,
           snapshot.state != "stale",
           let receivedAt = SleepWidgetClock.parse(snapshot.receivedAt),
           receivedAt <= now.addingTimeInterval(SleepWidgetClock.clockTolerance) {
            let staleAt = receivedAt.addingTimeInterval(SleepWidgetClock.staleAfter)
            if staleAt > now {
                entries.append(SleepEntry(date: staleAt, snapshot: snapshot, action: nil))
                refresh = staleAt.addingTimeInterval(15 * 60)
            }
        }
        completion(Timeline(entries: entries.sorted { $0.date < $1.date }, policy: .after(refresh)))
    }
}

private struct SleepWidgetView: View {
    let entry: SleepEntry

    private let lavender = Color(red: 0.71, green: 0.66, blue: 1.0)
    private let background = Color(red: 0.19, green: 0.18, blue: 0.21)

    private var receivedAt: Date? {
        SleepWidgetClock.parse(entry.snapshot?.receivedAt)
    }

    private var isStale: Bool {
        guard let receivedAt else { return true }
        let age = entry.date.timeIntervalSince(receivedAt)
        return (age >= SleepWidgetClock.staleAfter
            || age < -SleepWidgetClock.clockTolerance
            || entry.snapshot?.state == "stale")
    }

    private var childName: String {
        let name = entry.snapshot?.childName.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Сон дитини" : name
    }

    private var stateLabel: String {
        guard let snapshot = entry.snapshot else { return "Потрібен вхід" }
        if isStale { return "Перевірте стан" }
        switch snapshot.state {
        case "sleeping": return "Зараз спить"
        case "paused": return "Пауза сну"
        default: return "Наступний сон"
        }
    }

    @ViewBuilder
    private var primaryValue: some View {
        if let snapshot = entry.snapshot, !isStale {
            if snapshot.state == "sleeping", let receivedAt {
                let timerStart = receivedAt.addingTimeInterval(-Double(snapshot.asleepMs) / 1000)
                Text(timerStart, style: .timer)
            } else if snapshot.state == "paused" {
                Text(SleepWidgetClock.duration(snapshot.asleepMs))
            } else if let next = SleepWidgetClock.parse(snapshot.nextSleepAt) {
                Text(SleepWidgetClock.label(next, timeZone: snapshot.timeZone))
            } else {
                Text("—")
            }
        } else {
            Text("Відкрити сон")
                .font(.headline)
        }
    }

    private var updatedLabel: String {
        if let notice = entry.snapshot?.notice { return notice }
        guard let snapshot = entry.snapshot, let receivedAt else { return "Дані приховано" }
        let time = SleepWidgetClock.label(receivedAt, timeZone: snapshot.timeZone)
        return isStale ? "Застаріло · дані на \(time)" : "Дані на \(time)"
    }

    private var content: some View {
        VStack(spacing: 5) {
            Text(childName)
                .font(.caption)
                .privacySensitive()
                .foregroundColor(Color(red: 0.24, green: 0.23, blue: 0.27))
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(Color(red: 0.94, green: 0.93, blue: 0.96), in: Capsule())
                .lineLimit(1)
            Spacer(minLength: 0)
            Text(stateLabel)
                .font(.subheadline.bold())
                .foregroundColor(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            primaryValue
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .privacySensitive()
                .foregroundColor(lavender)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            Spacer(minLength: 0)
            if #available(iOS 17.0, *),
               let action = entry.action,
               !isStale,
               entry.snapshot?.notice == nil {
                let shouldPause = action.state == "sleeping"
                Button(intent: SleepToggleIntent(
                    action: shouldPause ? "pause" : "resume",
                    sessionId: action.sessionId,
                    revision: action.revision
                )) {
                    Label(shouldPause ? "Пауза" : "Продовжити", systemImage: shouldPause ? "pause.fill" : "play.fill")
                        .font(.caption2.bold())
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .foregroundColor(background)
                        .background(lavender, in: Capsule())
                }
                .buttonStyle(.plain)
            } else {
                Text("Відкрити сон ›")
                    .font(.caption2.bold())
                    .foregroundColor(lavender)
            }
            Text(updatedLabel)
                .font(.system(size: 10))
                .foregroundColor(Color(red: 0.78, green: 0.76, blue: 0.83))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(12)
        .widgetURL(URL(string: "protsenkohub://sleep"))
    }

    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                content.containerBackground(background, for: .widget)
            } else {
                content.background(background)
            }
        }
    }
}

@main
struct SleepWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: SleepWidgetStore.kind, provider: SleepProvider()) { entry in
            SleepWidgetView(entry: entry)
        }
        .configurationDisplayName("Сон дитини")
        .description("Стан сну та швидкий перехід до запису")
        .supportedFamilies([.systemSmall])
    }
}
