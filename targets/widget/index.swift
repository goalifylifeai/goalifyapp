import WidgetKit
import SwiftUI

// Keep in sync with lib/widget-bridge.ts and lib/widget-snapshot.ts.
private let appGroup = "group.com.goalifylife.app"
private let snapshotKey = "@goalify/widget_snapshot"

// Mirrors WidgetSnapshot in lib/widget-snapshot.ts.
struct GoalifySnapshot: Decodable {
  let date: String
  let oneText: String?
  let oneDone: Bool
  let streak: Int
  let focusSphere: String?
}

struct GoalifyEntry: TimelineEntry {
  let date: Date
  let snapshot: GoalifySnapshot?
}

private func readSnapshot() -> GoalifySnapshot? {
  guard
    let defaults = UserDefaults(suiteName: appGroup),
    let raw = defaults.string(forKey: snapshotKey),
    let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(GoalifySnapshot.self, from: data)
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> GoalifyEntry {
    GoalifyEntry(date: Date(), snapshot: nil)
  }
  func getSnapshot(in context: Context, completion: @escaping (GoalifyEntry) -> Void) {
    completion(GoalifyEntry(date: Date(), snapshot: readSnapshot()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<GoalifyEntry>) -> Void) {
    let entry = GoalifyEntry(date: Date(), snapshot: readSnapshot())
    // Refresh after local midnight so "today's One" rolls over even without app launch.
    let next = Calendar.current.nextDate(
      after: Date(), matching: DateComponents(hour: 0, minute: 5),
      matchingPolicy: .nextTime
    ) ?? Date().addingTimeInterval(3600)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

private func sphereColor(_ id: String?) -> Color {
  switch id {
  case "finance": return Color(red: 0.30, green: 0.48, blue: 0.34)
  case "health": return Color(red: 0.66, green: 0.39, blue: 0.20)
  case "career": return Color(red: 0.30, green: 0.37, blue: 0.61)
  case "relationships": return Color(red: 0.59, green: 0.25, blue: 0.38)
  default: return Color(red: 0.71, green: 0.44, blue: 0.23)
  }
}

private let paper = Color(red: 0.957, green: 0.937, blue: 0.902)
private let ink1 = Color(red: 0.122, green: 0.106, blue: 0.090)
private let ink3 = Color(red: 0.486, green: 0.443, blue: 0.400)

struct GoalifyWidgetView: View {
  var entry: GoalifyEntry

  var body: some View {
    let snap = entry.snapshot
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text("TODAY'S ONE")
          .font(.system(size: 10, weight: .medium, design: .monospaced))
          .tracking(2)
          .foregroundColor(ink3)
        Spacer()
        if let s = snap?.streak, s > 0 {
          Text("\(s)🔥")
            .font(.system(size: 12, weight: .semibold, design: .monospaced))
            .foregroundColor(ink1)
        }
      }
      Spacer(minLength: 8)
      if let one = snap?.oneText, !one.isEmpty {
        Text(one)
          .font(.system(size: 20, weight: .regular, design: .serif))
          .foregroundColor(ink1)
          .lineLimit(3)
          .strikethrough(snap?.oneDone == true, color: ink3)
      } else {
        Text("Open Goalify to set today's One.")
          .font(.system(size: 16, weight: .regular, design: .serif))
          .italic()
          .foregroundColor(ink3)
          .lineLimit(2)
      }
      Spacer(minLength: 8)
      HStack(spacing: 6) {
        Circle().fill(sphereColor(snap?.focusSphere)).frame(width: 8, height: 8)
        Text(snap?.oneDone == true ? "Done for today" : "Tap to complete")
          .font(.system(size: 11, design: .monospaced))
          .foregroundColor(ink3)
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(paper)
    .widgetURL(URL(string: "goalify://ritual/morning"))
  }
}

@main
struct GoalifyWidget: Widget {
  let kind = "GoalifyWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      if #available(iOS 17.0, *) {
        GoalifyWidgetView(entry: entry).containerBackground(paper, for: .widget)
      } else {
        GoalifyWidgetView(entry: entry)
      }
    }
    .configurationDisplayName("Today's One")
    .description("Your focus action and streak.")
    .supportedFamilies([.systemMedium])
  }
}
