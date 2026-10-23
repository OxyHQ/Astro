import AppKit
#if canImport(Sparkle)
import Sparkle
#endif

public final class AppUpdater: NSObject {
  public static let shared = AppUpdater()

  static var feedOverride: String? {
    let env = ProcessInfo.processInfo.environment
    if let feed = env["ASTRO_UPDATE_FEED_URL"] ?? UserDefaults.standard.string(forKey: "ACUpdateFeedURL") { return feed }
    return env["ASTRO_BACKGROUND"] == "1" ? "https://github.com/OxyHQ/Astro/releases/latest/download/appcast.xml" : nil
  }

  public static let channels = ["stable", "nightly"]
  static let channelDefaultsKey = "ACUpdateChannel"

  static var buildChannel: String {
    Bundle.main.object(forInfoDictionaryKey: "ACUpdateChannel") as? String == "nightly" ? "nightly" : "stable"
  }

  public var channel: String {
    let chosen = UserDefaults.standard.string(forKey: Self.channelDefaultsKey) ?? ""
    return Self.channels.contains(chosen) ? chosen : Self.buildChannel
  }

  public func setChannel(_ channel: String) {
    guard Self.channels.contains(channel) else { return }
    UserDefaults.standard.set(channel, forKey: Self.channelDefaultsKey)
  }

  private func rememberChannel() {
    guard !Self.channels.contains(UserDefaults.standard.string(forKey: Self.channelDefaultsKey) ?? "") else { return }
    UserDefaults.standard.set(Self.buildChannel, forKey: Self.channelDefaultsKey)
  }

  public static var displayVersion: String {
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    guard let range = version.range(of: #"-nightly\.(\d+)$"#, options: .regularExpression) else { return version }
    let number = version[range].split(separator: ".").last.map(String.init) ?? ""
    return "\(version[..<range.lowerBound]) Nightly \(number)"
  }

  static let aboutNotice = "© 2026 Oxy. Astro is free software under the GNU General Public License v3, with ABSOLUTELY NO WARRANTY. Its source is at the link below. It's built on Chromium and uBlock Origin, each under its own license."

  @objc public func showAbout(_ sender: Any?) {
    NSApp.orderFrontStandardAboutPanel(options: [.applicationVersion: Self.displayVersion, .credits: Self.aboutCredits])
  }

  private static var aboutCredits: NSAttributedString {
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    let repository = "https://github.com/OxyHQ/Astro"
    let centered = NSMutableParagraphStyle()
    centered.alignment = .center
    let plain: [NSAttributedString.Key: Any] = [
      .font: NSFont.systemFont(ofSize: NSFont.smallSystemFontSize),
      .foregroundColor: NSColor.secondaryLabelColor,
      .paragraphStyle: centered,
    ]
    let links = [
      ("Source code", "\(repository)/tree/v\(version)"),
      ("License", "\(repository)/blob/v\(version)/LICENSE"),
      ("Credits", "\(repository)/blob/v\(version)/NOTICE"),
    ]
    let credits = NSMutableAttributedString(string: "\(aboutNotice)\n\n", attributes: plain)
    for (index, (title, url)) in links.enumerated() {
      if index > 0 { credits.append(NSAttributedString(string: "  ·  ", attributes: plain)) }
      var linked = plain
      linked[.link] = URL(string: url)
      credits.append(NSAttributedString(string: title, attributes: linked))
    }
    return credits
  }

  private static var isOff: Bool {
    ACIsolatedDataDirectory() != nil && ProcessInfo.processInfo.environment["ASTRO_UPDATE_FEED_URL"] == nil
  }

  #if canImport(Sparkle)
  private lazy var controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: self)
  private var deferredUpdate = false
  private var deferredRelaunch: (() -> Void)?
  private var firstCheckPending = false
  #endif
  private var started = false

  public var isAvailable: Bool {
    #if canImport(Sparkle)
    true
    #else
    false
    #endif
  }

  public var isConfigured: Bool {
    guard isAvailable, !Self.isOff else { return false }
    let info = Bundle.main.infoDictionary ?? [:]
    let feed = (Self.feedOverride ?? info["SUFeedURL"] as? String ?? "").trimmingCharacters(in: .whitespaces)
    let key = (info["SUPublicEDKey"] as? String ?? "").trimmingCharacters(in: .whitespaces)
    guard let scheme = URL(string: feed)?.scheme?.lowercased() else { return false }
    return (scheme == "https" || scheme == "http") && !key.isEmpty
  }

  public func start() {
    #if canImport(Sparkle)
    rememberChannel()
    guard !started, isConfigured else { return }
    started = true
    firstCheckPending = controller.updater.lastUpdateCheckDate == nil
    do {
      try controller.updater.start()
    } catch {
      NSLog("Astro: couldn't start the updater: \(error.localizedDescription)")
    }
    NotificationCenter.default.addObserver(self, selector: #selector(fullScreenChanged), name: NSWindow.didExitFullScreenNotification, object: nil)
    #endif
  }

  @objc public func checkForUpdates(_ sender: Any?) {
    #if canImport(Sparkle)
    guard isConfigured else {
      if ProcessInfo.processInfo.environment["ASTRO_BACKGROUND"] == "1" {
        return NSLog("Astro: update checks are off in this instance")
      }
      return showNotSetUp()
    }
    start()
    controller.checkForUpdates(sender)
    #endif
  }

  public var state: [String: Any] {
    #if canImport(Sparkle)
    let updater = controller.updater
    return [
      "available": true,
      "configured": isConfigured,
      "automaticChecks": updater.automaticallyChecksForUpdates,
      "automaticDownloads": updater.automaticallyDownloadsUpdates,
      "canCheck": updater.canCheckForUpdates,
      "sessionInProgress": updater.sessionInProgress,
      "feedURL": updater.feedURL?.absoluteString as Any,
      "lastCheck": updater.lastUpdateCheckDate.map { $0.timeIntervalSince1970 * 1000 } as Any,
      "version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as Any,
      "displayVersion": Self.displayVersion,
      "channel": channel,
      "buildChannel": Self.buildChannel,
    ]
    #else
    return ["available": false]
    #endif
  }

  public func setAutomaticChecks(_ on: Bool) {
    #if canImport(Sparkle)
    controller.updater.automaticallyChecksForUpdates = on
    #endif
  }

  public func setAutomaticDownloads(_ on: Bool) {
    #if canImport(Sparkle)
    controller.updater.automaticallyDownloadsUpdates = on
    #endif
  }

  private func showNotSetUp() {
    let alert = NSAlert()
    let name = ProcessInfo.processInfo.processName
    alert.messageText = "Updates aren't set up for this build"
    alert.informativeText = "This copy of \(name) doesn't have an update feed, so it can't check for new versions. Get newer versions from wherever you got this one."
    alert.addButton(withTitle: "OK")
    if let window = NSApp.keyWindow, window.attachedSheet == nil {
      alert.beginSheetModal(for: window)
    } else {
      alert.runModal()
    }
  }

  static var isPresentingFullScreen: Bool {
    NSApp.windows.contains { $0.isVisible && $0.styleMask.contains(.fullScreen) }
  }

  #if canImport(Sparkle)
  @objc private func fullScreenChanged() {
    DispatchQueue.main.async { [self] in
      guard !Self.isPresentingFullScreen else { return }
      if let relaunch = deferredRelaunch {
        deferredRelaunch = nil
        relaunch()
      } else if deferredUpdate {
        deferredUpdate = false
        controller.checkForUpdates(nil)
      }
    }
  }
  #endif
}

#if canImport(Sparkle)
extension AppUpdater: SPUUpdaterDelegate {
  public func feedURLString(for updater: SPUUpdater) -> String? { Self.feedOverride }

  public func allowedChannels(for updater: SPUUpdater) -> Set<String> {
    channel == "nightly" ? ["nightly"] : []
  }

  public func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
    NSLog("Astro: update found: \(item.displayVersionString) (build \(item.versionString)\(item.channel.map { ", \($0)" } ?? "")) on the \(channel) channel")
  }

  public func updaterDidNotFindUpdate(_ updater: SPUUpdater, error: Error) {
    NSLog("Astro: no update on the \(channel) channel")
  }

  public func feedParameters(for updater: SPUUpdater, sendingSystemProfile sendingProfile: Bool) -> [[String: String]] {
    guard firstCheckPending else { return [] }
    firstCheckPending = false
    return [["key": "first", "value": "1"]]
  }

  public func updater(_ updater: SPUUpdater, willInstallUpdateOnQuit item: SUAppcastItem, immediateInstallationBlock immediateInstallHandler: @escaping () -> Void) -> Bool {
    if KillSwitch.isOn("updatePrewarm") { UpdatePrewarm.start(version: item.versionString) }
    return false
  }

  public func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem, untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
    guard Self.isPresentingFullScreen else { return false }
    deferredRelaunch = installHandler
    return true
  }
}

enum KillSwitch {
  static let cacheDocument = "switches-cache.json"

  static func isOn(
    _ name: String,
    environment: [String: String] = ProcessInfo.processInfo.environment,
    cache: () -> String? = { DocumentStore.read(cacheDocument) }
  ) -> Bool {
    for part in (environment["ASTRO_SWITCHES"] ?? "").split(separator: ",") {
      let pair = part.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
      guard pair.count == 2, pair[0] == name else { continue }
      if ["off", "0", "false"].contains(pair[1]) { return false }
      if ["on", "1", "true"].contains(pair[1]) { return true }
    }
    guard let data = cache()?.data(using: .utf8),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let switches = json["switches"] as? [String: Any],
      let value = switches[name] as? NSNumber, CFGetTypeID(value) == CFBooleanGetTypeID()
    else { return true }
    return value.boolValue
  }
}

enum UpdatePrewarm {
  static let timeout: TimeInterval = 90
  private static var started = Set<String>()
  private static var running: pid_t = 0

  static func start(version: String) {
    guard !started.contains(version), let executable = stagedApp(version: version)?.executableURL else { return }
    started.insert(version)
    NotificationCenter.default.addObserver(forName: NSApplication.willTerminateNotification, object: nil, queue: .main) { _ in stop() }
    DispatchQueue.global(qos: .utility).async {
      let task = Process()
      task.executableURL = executable
      var env = ProcessInfo.processInfo.environment.filter { !$0.key.hasPrefix("ASTRO_") && !$0.key.hasPrefix("DYLD_") }
      env["ASTRO_PREWARM"] = "1"
      task.environment = env
      task.standardInput = FileHandle.nullDevice
      task.standardOutput = FileHandle.nullDevice
      task.standardError = FileHandle.nullDevice
      let began = Date()
      task.terminationHandler = { ended in
        DispatchQueue.main.async {
          if running == ended.processIdentifier { running = 0 }
          NSLog("Astro: prewarmed update \(version) in \(Int(Date().timeIntervalSince(began) * 1000)) ms (status \(ended.terminationStatus))")
        }
      }
      do {
        try task.run()
      } catch {
        return NSLog("Astro: couldn't prewarm update \(version): \(error.localizedDescription)")
      }
      let pid = task.processIdentifier
      DispatchQueue.main.async {
        if task.isRunning { running = pid }
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) {
          guard running == pid, task.isRunning else { return }
          NSLog("Astro: update prewarm still running after \(Int(timeout)) s; stopping it")
          stop()
        }
      }
    }
  }

  static func stop() {
    guard running != 0 else { return }
    kill(running, SIGKILL)
    running = 0
  }

  static func stagedApp(version: String, bundleId: String? = Bundle.main.bundleIdentifier, root: URL? = nil) -> Bundle? {
    guard let bundleId,
      let root = root ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
        .appendingPathComponent(bundleId).appendingPathComponent("org.sparkle-project.Sparkle/Installation")
    else { return nil }
    guard let walk = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.contentModificationDateKey],
                                                     options: [.skipsHiddenFiles, .skipsPackageDescendants]) else { return nil }
    var found: [(Bundle, Date)] = []
    for case let url as URL in walk {
      if walk.level > 4 { walk.skipDescendants(); continue }
      guard url.pathExtension == "app", let bundle = Bundle(url: url), let info = bundle.infoDictionary,
        info["CFBundleIdentifier"] as? String == bundleId, info["CFBundleVersion"] as? String == version,
        let executable = bundle.executableURL, FileManager.default.isExecutableFile(atPath: executable.path)
      else { continue }
      let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
      found.append((bundle, date))
    }
    return found.max { $0.1 < $1.1 }?.0
  }
}

extension AppUpdater: SPUStandardUserDriverDelegate {
  public var supportsGentleScheduledUpdateReminders: Bool { true }

  public func standardUserDriverShouldHandleShowingScheduledUpdate(_ update: SUAppcastItem, andInImmediateFocus immediateFocus: Bool) -> Bool {
    !Self.isPresentingFullScreen
  }

  public func standardUserDriverWillHandleShowingUpdate(_ handleShowingUpdate: Bool, forUpdate update: SUAppcastItem, state: SPUUserUpdateState) {
    if !handleShowingUpdate { deferredUpdate = true }
  }

  public func standardUserDriverWillFinishUpdateSession() {
    deferredUpdate = false
  }

  @objc(standardUserDriverShowVersionHistoryForAppcastItem:)
  public func standardUserDriverShowVersionHistory(for item: SUAppcastItem) {
    guard let page = item.fullReleaseNotesURL else { return }
    var components = URLComponents(url: page, resolvingAgainstBaseURL: false)
    components?.fragment = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    OpenURLInbox.receive([components?.url ?? page])
  }
}
#endif
