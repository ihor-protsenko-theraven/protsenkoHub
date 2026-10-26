import AppIntents
import SwiftUI
import WidgetKit

private enum SleepWidgetClock {
    static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    static func time(_ date: Date?, timeZone: String) -> String {
        guard let date else { return "—" }
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

    static func humanDuration(_ milliseconds: Int64) -> String {
        let minutes = max(0, milliseconds) / 60_000
        if minutes >= 1_440 {
            return "\(minutes / 1_440) д \((minutes % 1_440) / 60) год \(minutes % 60) хв"
        }
        if minutes >= 60 { return "\(minutes / 60) год \(minutes % 60) хв" }
        return "\(minutes) хв"
    }

    static func since(_ date: Date?, now: Date) -> String {
        guard let date else { return "Ще немає сну" }
        let minutes = max(0, Int(now.timeIntervalSince(date) / 60))
        if minutes >= 1_440 {
            return "\(minutes / 1_440) д \((minutes % 1_440) / 60) год тому"
        }
        if minutes >= 60 {
            return "\(minutes / 60) год \(minutes % 60) хв тому"
        }
        return "\(max(1, minutes)) хв тому"
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
            childName: "Соломія", state: "idle", nextSleepAt: nil,
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
        let expiry = SleepWidgetActionStore.read().flatMap {
            SleepWidgetActionStore.parseDate($0.expiresAt)
        }
        var entries = (0...4).map { offset in
            let date = now.addingTimeInterval(Double(offset) * 15 * 60)
            return SleepEntry(date: date, snapshot: snapshot,
                              action: (expiry.map { date < $0 } ?? false) ? action : nil)
        }
        if let expiry, expiry > now, expiry < now.addingTimeInterval(60 * 60) {
            entries.append(SleepEntry(date: expiry, snapshot: snapshot, action: nil))
        }
        completion(Timeline(entries: entries.sorted { $0.date < $1.date },
                            policy: .after(now.addingTimeInterval(60 * 60))))
    }
}

private struct SleepWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SleepEntry

    private let lavender = Color(red: 0.71, green: 0.66, blue: 1.0)
    private let background = Color(red: 0.19, green: 0.18, blue: 0.21)
    private let buttonBackground = Color(red: 0.29, green: 0.28, blue: 0.35)
    private var compact: Bool { family == .systemSmall }
    private var snapshot: SleepWidgetSnapshot? { entry.snapshot }
    private var active: Bool { snapshot?.state == "sleeping" || snapshot?.state == "paused" }
    private var isStale: Bool { snapshot?.state == "stale" }
    private var destination: URL { URL(string: "protsenkohub://sleep")! }

    private var childName: String {
        let name = snapshot?.childName.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Сон дитини" : name
    }

    private var activeDetail: String {
        guard let snapshot else { return "" }
        let started = SleepWidgetClock.time(
            SleepWidgetClock.parse(snapshot.startedAt), timeZone: snapshot.timeZone
        )
        return "✎ \(started)   Ⅱ \(snapshot.pauseCount ?? 0)"
    }

    private var lastDetail: String {
        guard let snapshot, let last = snapshot.lastSleep else { return "Почніть перший запис" }
        let start = SleepWidgetClock.time(
            SleepWidgetClock.parse(last.startedAt), timeZone: snapshot.timeZone
        )
        let end = SleepWidgetClock.time(
            SleepWidgetClock.parse(last.endedAt), timeZone: snapshot.timeZone
        )
        let icon = last.kind == "NIGHT" ? "☾" : "☀"
        return "\(icon) \(start)–\(end) · \(SleepWidgetClock.humanDuration(last.asleepMs))"
    }

    @ViewBuilder
    private var elapsed: some View {
        if let snapshot, snapshot.state == "sleeping",
           let receivedAt = SleepWidgetClock.parse(snapshot.receivedAt) {
            let start = receivedAt.addingTimeInterval(-Double(snapshot.asleepMs) / 1000)
            Text(start, style: .timer)
        } else {
            Text(SleepWidgetClock.duration(snapshot?.asleepMs ?? 0))
        }
    }

    @ViewBuilder
    private func actionButton(
        _ action: String, symbol: String, label: String,
        size: CGFloat, filled: Bool = false
    ) -> some View {
        if #available(iOS 17.0, *), let target = entry.action {
            Button(intent: SleepToggleIntent(
                action: action, sessionId: target.sessionId, revision: target.revision
            )) {
                actionFace(symbol: symbol, size: size, filled: filled)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
        } else {
            Link(destination: destination) {
                actionFace(symbol: symbol, size: size, filled: filled)
            }
            .accessibilityLabel(label)
        }
    }

    private func actionFace(symbol: String, size: CGFloat, filled: Bool) -> some View {
        Image(systemName: symbol)
            .font(.system(size: size * (filled ? 0.38 : 0.40), weight: .bold))
            .foregroundStyle(filled ? Color.white : lavender)
            .frame(width: size, height: size)
            .background {
                if filled {
                    Circle().fill(lavender)
                } else if symbol == "pause.fill" || symbol == "play.fill" {
                    Circle().stroke(lavender, lineWidth: 3)
                } else {
                    Circle().fill(buttonBackground)
                }
            }
    }

    private var activeCard: some View {
        VStack(spacing: compact ? 3 : 6) {
            HStack(spacing: 6) {
                Text(snapshot?.kind == "NIGHT" ? "☾" : "☀")
                    .foregroundStyle(lavender)
                elapsed
            }
            .font(.system(size: compact ? 26 : 34, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .privacySensitive()
            Text(activeDetail)
                .font(.system(size: compact ? 11 : 14))
                .foregroundStyle(lavender)
                .lineLimit(1)
            Spacer(minLength: 0)
            actionButton(
                snapshot?.state == "paused" ? "resume" : "pause",
                symbol: snapshot?.state == "paused" ? "play.fill" : "pause.fill",
                label: snapshot?.state == "paused" ? "Продовжити сон" : "Пауза",
                size: compact ? 45 : 60
            )
            HStack(spacing: compact ? 34 : 70) {
                actionButton("delete", symbol: "trash.fill", label: "Видалити сон",
                             size: compact ? 35 : 49)
                actionButton("save", symbol: "square.and.arrow.down.fill",
                             label: "Зберегти сон", size: compact ? 35 : 49)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var idleCard: some View {
        VStack(spacing: compact ? 4 : 8) {
            Spacer(minLength: 0)
            Text(SleepWidgetClock.since(
                SleepWidgetClock.parse(snapshot?.lastSleep?.endedAt), now: entry.date
            ))
            .font(.system(size: compact ? 17 : 24, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .privacySensitive()
            Text(lastDetail)
                .font(.system(size: compact ? 10 : 13))
                .foregroundStyle(.white.opacity(0.85))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .privacySensitive()
            Spacer(minLength: 0)
            actionButton("start", symbol: "moon.zzz.fill", label: "Почати сон",
                         size: compact ? 57 : 76, filled: true)
        }
        .frame(maxWidth: .infinity)
    }

    private var content: some View {
        VStack(spacing: compact ? 4 : 8) {
            Text(childName)
                .font(.system(size: compact ? 11 : 14))
                .foregroundStyle(Color(red: 0.26, green: 0.25, blue: 0.30))
                .padding(.horizontal, compact ? 11 : 17)
                .frame(height: compact ? 22 : 28)
                .background(Color(red: 0.94, green: 0.93, blue: 0.96), in: Capsule())
                .lineLimit(1)
                .privacySensitive()
            if snapshot == nil || isStale {
                Spacer()
                Text(snapshot == nil ? "Потрібен вхід" : "Перевірте стан сну")
                    .font(.headline)
                    .foregroundStyle(.white)
                Link("Відкрити сон ›", destination: destination)
                    .font(.caption.bold())
                    .foregroundStyle(lavender)
                Spacer()
            } else if active {
                activeCard
            } else {
                idleCard
            }
            if let notice = snapshot?.notice {
                Text(notice)
                    .font(.system(size: 10))
                    .foregroundStyle(lavender)
                    .lineLimit(1)
            }
        }
        .padding(compact ? 7 : 12)
        .frame(maxWidth: 280)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(destination)
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
        .description("Початок, пауза та збереження сну")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
