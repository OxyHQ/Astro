import Foundation
import XCTest
@testable import AstroSyncCore

final class FakeKeychain: SecretStore {
  var items: [String: [String: Data]] = [:]
  var denials: [String: Int] = [:]
  var reads = 0
  var onRead: ((String) -> Void)?

  var listFails = false
  func accounts(service: String) -> [String]? { listFails ? nil : (items[service] ?? [:]).keys.sorted() }

  func read(service: String, account: String) -> SecretRead {
    reads += 1
    onRead?(service)
    if let left = denials[service], left > 0 {
      denials[service] = left - 1
      return .denied
    }
    return items[service]?[account].map(SecretRead.found) ?? .missing
  }

  func write(service: String, account: String, label: String, accessible: CFString?, data: Data) -> Bool {
    items[service, default: [:]][account] = data
    return true
  }
}

final class FailingGroups: AccessGroupMover {
  let status: OSStatus
  var tries = 0
  init(_ status: OSStatus) { self.status = status }
  func entitled(to groups: [String]) -> Bool { true }
  func move(from old: String, to new: String) -> (moved: Int, failure: OSStatus?) {
    tries += 1
    return (0, status)
  }
}

final class FakeGroups: AccessGroupMover {
  var isEntitled = true
  var moves: [(String, String)] = []
  func entitled(to groups: [String]) -> Bool { isEntitled }
  func move(from old: String, to new: String) -> (moved: Int, failure: OSStatus?) {
    moves.append((old, new))
    return (1, nil)
  }
}

func old(_ new: String) -> String { Renamed.jsonKeys.first { $0.value == new }!.key }
let oldScheme = Renamed.urls[2].old
let oldGame = Renamed.urls[0].old
let oldChromeGame = Renamed.urls[1].old
let oldPath = { (new: String) in Renamed.paths.first { $0.new == new }!.old }
let oldDefault = { (new: String) in Renamed.defaultsKeys.first { $0.value == new }!.key }

final class LegacyMigrationTests: XCTestCase {
  var root: URL!
  var oldData: URL { root.appendingPathComponent("old/\(LegacyName.bundleId)") }
  var newData: URL { root.appendingPathComponent("new/so.oxy.Astro") }
  var oldPrefs: URL { root.appendingPathComponent("prefs/\(LegacyName.bundleId)") }
  var newPrefs: URL { root.appendingPathComponent("prefs/so.oxy.Astro") }
  var oldKeychain = FakeKeychain()
  var newKeychain = FakeKeychain()
  var groups = FakeGroups()
  var answers: [Int?] = []
  var asked: [String] = []
  var oldRunning = false
  var runningAnswers: [Bool] = []
  var whileAsking: (() -> Void)?
  var extras: [(URL, URL)] = []

  let safeStorageKey = Data("old safe storage key 16".utf8)

  override func setUpWithError() throws {
    root = FileManager.default.temporaryDirectory.appendingPathComponent("legacy-migration-\(UUID().uuidString)")
    try seedOldInstall()
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: root)
  }

  func write(_ text: String, _ relative: String, in dir: URL? = nil) throws {
    let url = (dir ?? oldData).appendingPathComponent(relative)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data(text.utf8).write(to: url)
  }

  func seedOldInstall() throws {
    let session: [String: Any] = [
      "version": 2,
      "settings": [
        old("openLinksInLittleAstro"): false,
        old("littleAstroSize"): [700, 500],
        "shortcuts": [old("newLittleAstro"): ["cmd+opt+y"], "newTab": ["cmd+t"]],
        "syncFolderInside": oldData.appendingPathComponent("Astro Sync").path,
      ],
      "tabs": [
        ["id": "t1", "url": "\(oldScheme)history", "title": "History", "windowId": "w1"],
        ["id": "t2", "url": oldChromeGame, "title": "Play \(oldGame)", "windowId": "w1"],
        ["id": "t3", "url": "\(oldGame)/?level=2", "title": "Game", "windowId": "w1"],
        ["id": "t4", "url": "https://example.com/?next=\(oldScheme)history", "title": "Example", "windowId": "w1"],
        ["id": "t5", "url": "\(oldChromeGame)u", "title": "Not the game", "windowId": "w1"],
      ],
      "groups": [["id": "g1", "pinned": true, "tabIds": ["t1"], "windowId": "w1"]],
      "launchTab": ["id": "t1", "url": "\(oldScheme)history", "profile": "Default"],
      "weight": 0.1 + 0.2,
    ]
    try FileManager.default.createDirectory(at: oldData, withIntermediateDirectories: true)
    try JSONSerialization.data(withJSONObject: session).write(to: oldData.appendingPathComponent("session.json"))
    try write(#"{"version":2,"downloads":[]}"#, "downloads.json")
    try write("not json", "broken.json")
    try write(#"{"roots":{"bookmark_bar":{"children":[{"type":"url","name":"Handy: OLDdownloads","url":"OLDdownloads","meta_info":{"KEY":"bm-1"}}],"type":"folder"}},"version":1,"checksum":"x"}"#
      .replacingOccurrences(of: "OLD", with: oldScheme).replacingOccurrences(of: "KEY", with: old("ac_sync_key")), "Chromium/Default/Bookmarks")
    try write(#"{"profile":{"info_cache":{"Default":{}}}}"#, "Chromium/Local State")
    try write("<?xml version=\"1.0\"?><plist version=\"1.0\"><array><real>1</real></array></plist>", oldPath("Chromium/AstroPictureInPicture.plist"))
    try write(#"["com.1password.1password.json"]"#, oldPath("Chromium/NativeMessagingHosts/.astro-managed.json"))
    try write("png", oldPath("Chromium/*/Astro Favicons").replacingOccurrences(of: "*", with: "Default") + "/abc.png")
    try Data(repeating: 7, count: 300_000).write(to: oldData.appendingPathComponent("Chromium/Default/Cookies"))
    try FileManager.default.createSymbolicLink(atPath: oldData.appendingPathComponent("Chromium/SingletonLock").path, withDestinationPath: "host-999999")

    let prefs: [String: Any] = [
      oldDefault("ACAppIcon"): "plum",
      "\(Renamed.defaultsKeyPrefixes[0].0)Settings": "10 10 800 600",
      "NSUserKeyEquivalents": ["New \(Renamed.menuTitleWords[0].0) Window": "@~n", "Quit \(LegacyName.appName)": "@q"],
      "SUAutomaticallyUpdate": false,
      "SULastCheckTime": Date(timeIntervalSince1970: 1_800_000_000),
    ]
    try FileManager.default.createDirectory(at: oldPrefs.deletingLastPathComponent(), withIntermediateDirectories: true)
    try PropertyListSerialization.data(fromPropertyList: prefs, format: .binary, options: 0).write(to: oldPrefs.appendingPathExtension("plist"))

    oldKeychain.items = [
      Renamed.safeStorage.oldService: [Renamed.safeStorage.account!.old: safeStorageKey],
      Renamed.connectedAccounts.oldService: ["github": Data("gh-token".utf8), "google": Data("g-token".utf8)],
      Renamed.syncKey.oldService: ["device-1": Data(repeating: 1, count: 32)],
      "Chrome Safe Storage": ["Chrome": Data("someone else's".utf8)],
    ]
  }

  func context(crashAfter: String? = nil) -> LegacyMigrator.Context {
    LegacyMigrator.Context(
      oldData: oldData, newData: newData, extras: extras,
      oldDefaults: PreferencesDomain(id: oldPrefs.path), newDefaults: PreferencesDomain(id: newPrefs.path),
      oldSecrets: oldKeychain, newSecrets: newKeychain,
      accessGroups: [("T.\(LegacyName.bundleId).webauthn", "T.so.oxy.Astro.webauthn")], groupMover: groups,
      oldAppRunning: { [unowned self] in runningAnswers.isEmpty ? oldRunning : runningAnswers.removeFirst() },
      ask: { [unowned self] title, _, _ in
        asked.append(title)
        whileAsking?()
        return answers.isEmpty ? nil : answers.removeFirst()
      },
      crashAfter: crashAfter)
  }

  func run(crashAfter: String? = nil) -> LegacyMigrator.Outcome { LegacyMigrator(context(crashAfter: crashAfter)).run() }

  func json(_ relative: String) throws -> [String: Any] {
    try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: newData.appendingPathComponent(relative))) as? [String: Any])
  }

  func snapshot(_ dir: URL) -> [String: Data] {
    var files: [String: Data] = [:]
    for case let url as URL in FileManager.default.enumerator(at: dir, includingPropertiesForKeys: nil, options: [])! {
      if let data = try? Data(contentsOf: url) { files[String(url.path.dropFirst(dir.path.count))] = data }
      if let link = try? FileManager.default.destinationOfSymbolicLink(atPath: url.path) {
        files[String(url.path.dropFirst(dir.path.count))] = Data(link.utf8)
      }
    }
    return files
  }

  func assertMigrated() throws {
    let journal = try XCTUnwrap(LegacyMigrator(context()).readJournal())
    XCTAssertEqual(journal.phase, "done")
    XCTAssertEqual(journal.outcome, "migrated")

    let session = try json("session.json")
    let settings = try XCTUnwrap(session["settings"] as? [String: Any])
    XCTAssertEqual(settings["openLinksInLittleAstro"] as? Bool, false)
    XCTAssertNil(settings[old("openLinksInLittleAstro")])
    XCTAssertEqual(settings["littleAstroSize"] as? [Int], [700, 500])
    XCTAssertEqual(settings["shortcuts"] as? [String: [String]], ["newLittleAstro": ["cmd+opt+y"], "newTab": ["cmd+t"]])
    XCTAssertEqual(settings["syncFolderInside"] as? String, newData.appendingPathComponent("Astro Sync").path)
    let tabs = try XCTUnwrap(session["tabs"] as? [[String: Any]])
    XCTAssertEqual(tabs.map { $0["url"] as? String }, [
      "astro://history", "chrome://game", "astro://game/?level=2",
      "https://example.com/?next=\(oldScheme)history", "\(oldChromeGame)u",
    ])
    XCTAssertEqual(tabs[1]["title"] as? String, "Play \(oldGame)", "user text keeps what it says")
    XCTAssertEqual((session["groups"] as? [[String: Any]])?.first?["pinned"] as? Bool, true)
    XCTAssertEqual((session["launchTab"] as? [String: Any])?["url"] as? String, "astro://history")
    XCTAssertEqual(session["weight"] as? Double, 0.1 + 0.2)
    XCTAssertEqual(try String(contentsOf: newData.appendingPathComponent("broken.json")), "not json")
    XCTAssertEqual(try String(contentsOf: newData.appendingPathComponent("downloads.json")), #"{"version":2,"downloads":[]}"#,
                   "a document that doesn't change isn't rewritten")

    let bookmarks = try String(contentsOf: newData.appendingPathComponent("Chromium/Default/Bookmarks"))
    XCTAssertTrue(bookmarks.contains(#""url":"astro://downloads""#))
    XCTAssertTrue(bookmarks.contains(#""ac_sync_key":"bm-1""#))
    XCTAssertTrue(bookmarks.contains("\"name\":\"Handy: \(oldScheme)downloads\""))

    let fm = FileManager.default
    XCTAssertTrue(fm.fileExists(atPath: newData.appendingPathComponent("Chromium/AstroPictureInPicture.plist").path))
    XCTAssertTrue(fm.fileExists(atPath: newData.appendingPathComponent("Chromium/NativeMessagingHosts/.astro-managed.json").path))
    XCTAssertTrue(fm.fileExists(atPath: newData.appendingPathComponent("Chromium/Default/Astro Favicons/abc.png").path))
    XCTAssertEqual(try Data(contentsOf: newData.appendingPathComponent("Chromium/Default/Cookies")).count, 300_000)
    XCTAssertNil(try? fm.destinationOfSymbolicLink(atPath: newData.appendingPathComponent("Chromium/SingletonLock").path))
    XCTAssertFalse(fm.fileExists(atPath: newData.appendingPathComponent(LegacyMigrator.stagingName).path))

    XCTAssertEqual(newKeychain.items["Astro Safe Storage"], ["Astro": safeStorageKey])
    XCTAssertEqual(newKeychain.items["Astro Connected Accounts"], ["github": Data("gh-token".utf8), "google": Data("g-token".utf8)])
    XCTAssertEqual(newKeychain.items["Astro Sync Key"], ["device-1": Data(repeating: 1, count: 32)])
    XCTAssertNil(newKeychain.items["Chrome Safe Storage"])

    let prefs = PreferencesDomain(id: newPrefs.path).all()
    XCTAssertEqual(prefs["ACAppIcon"] as? String, "plum")
    XCTAssertNil(prefs[oldDefault("ACAppIcon")])
    XCTAssertEqual(prefs["NSWindow Frame AstroSettings"] as? String, "10 10 800 600")
    XCTAssertEqual(prefs["NSUserKeyEquivalents"] as? [String: String], ["New Little Astro Window": "@~n", "Quit Astro": "@q"])
    XCTAssertEqual(prefs["SUAutomaticallyUpdate"] as? Bool, false)
    XCTAssertEqual(prefs["SULastCheckTime"] as? Date, Date(timeIntervalSince1970: 1_800_000_000))
  }

  func testMigratesEverythingAndLeavesTheOldInstallAlone() throws {
    let before = snapshot(oldData)
    XCTAssertEqual(run(), .proceed)
    try assertMigrated()
    XCTAssertEqual(snapshot(oldData), before)
    XCTAssertEqual(groups.moves.map(\.0), ["T.\(LegacyName.bundleId).webauthn"])
  }

  func testRunsOnce() throws {
    XCTAssertEqual(run(), .proceed)
    try write(#"{"version":2,"tabs":[]}"#, "session.json", in: newData)
    let reads = oldKeychain.reads
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(try String(contentsOf: newData.appendingPathComponent("session.json")), #"{"version":2,"tabs":[]}"#)
    XCTAssertEqual(oldKeychain.reads, reads, "a finished migration reads no keychain item")
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
  }

  func testEveryCrashPointResumesToTheSameResult() throws {
    for step in ["staged", "secrets", "journal", "published", "defaults"] {
      try FileManager.default.removeItem(at: root)
      oldKeychain = FakeKeychain()
      newKeychain = FakeKeychain()
      try seedOldInstall()
      XCTAssertEqual(run(crashAfter: step), .quit, step)
      XCTAssertFalse(LegacyMigrator.Context.isDone(newData), step)
      XCTAssertEqual(run(), .proceed, step)
      try assertMigrated()
    }
  }

  func testOldAppStillRunningWaitsOrQuits() throws {
    oldRunning = true
    answers = [1]
    XCTAssertEqual(run(), .quit)
    XCTAssertEqual(asked.count, 1)
    XCTAssertFalse(FileManager.default.fileExists(atPath: newData.appendingPathComponent("session.json").path))
    XCTAssertFalse(LegacyMigrator.Context.isDone(newData))
    XCTAssertEqual(run(), .quit)
    oldRunning = false
    XCTAssertEqual(run(), .proceed)
    try assertMigrated()
  }

  func testDeniedSafeStorageRetriesOrQuitsWithoutMovingAnything() throws {
    oldKeychain.denials[Renamed.safeStorage.oldService] = 2
    answers = [0, 1]
    XCTAssertEqual(run(), .quit)
    XCTAssertEqual(asked.count, 2)
    XCTAssertFalse(FileManager.default.fileExists(atPath: newData.appendingPathComponent("session.json").path))
    XCTAssertFalse(FileManager.default.fileExists(atPath: newData.appendingPathComponent(LegacyMigrator.stagingName).path))
    XCTAssertNil(LegacyMigrator(context()).readJournal())
    XCTAssertEqual(run(), .proceed)
    try assertMigrated()
  }

  func testWithoutTheKeyNothingComesAcrossEncrypted() throws {
    oldKeychain.denials[Renamed.safeStorage.oldService] = 1
    answers = [2]
    XCTAssertEqual(run(), .proceed)
    XCTAssertNil(newKeychain.items["Astro Safe Storage"])
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.outcome, "fresh")
    XCTAssertFalse(FileManager.default.fileExists(atPath: newData.appendingPathComponent("Chromium").path))
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
  }

  func testAKeychainThatCantListAsksToo() throws {
    oldKeychain.listFails = true
    answers = [1]
    XCTAssertEqual(run(), .quit)
    XCTAssertFalse(FileManager.default.fileExists(atPath: newData.appendingPathComponent("session.json").path))
    oldKeychain.listFails = false
    XCTAssertEqual(run(), .proceed)
    try assertMigrated()
  }

  func testOldAppOpenedDuringTheCopyStartsOver() throws {
    runningAnswers = [false, true, true, false, false]
    answers = [0]
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(asked.count, 1)
    try assertMigrated()
  }

  func testFailedGroupMovesRetryThenStop() throws {
    let failing = FailingGroups(errSecDuplicateItem)
    var ctx = context()
    ctx.groupMover = failing
    XCTAssertEqual(LegacyMigrator(ctx).run(), .proceed)
    XCTAssertEqual(LegacyMigrator(ctx).readJournal()?.groups, "pending")
    for _ in 0..<6 { _ = LegacyMigrator(ctx).run() }
    XCTAssertEqual(LegacyMigrator(ctx).readJournal()?.groups, "failed")
    XCTAssertEqual(failing.tries, 5)
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
  }

  func testGroupMovesKeepTryingWhileTheKeychainIsUnavailable() throws {
    let locked = FailingGroups(errSecInteractionNotAllowed)
    var ctx = context()
    ctx.groupMover = locked
    for _ in 0..<8 { XCTAssertEqual(LegacyMigrator(ctx).run(), .proceed) }
    XCTAssertEqual(LegacyMigrator(ctx).readJournal()?.groups, "pending")
    XCTAssertEqual(locked.tries, 8)
    XCTAssertFalse(LegacyMigrator.Context.isDone(newData))
    ctx.groupMover = groups
    XCTAssertEqual(LegacyMigrator(ctx).run(), .proceed)
    XCTAssertEqual(LegacyMigrator(ctx).readJournal()?.groups, "moved 1")
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
  }

  func testDeniedAccountsAndSyncKeyAreAskedForAgain() throws {
    oldKeychain.denials[Renamed.connectedAccounts.oldService] = 1
    oldKeychain.denials[Renamed.syncKey.oldService] = 1
    XCTAssertEqual(run(), .proceed)
    XCTAssertTrue(asked.isEmpty, "only the Safe Storage key stops the launch")
    XCTAssertEqual(newKeychain.items["Astro Connected Accounts"], ["google": Data("g-token".utf8)])
    XCTAssertNil(newKeychain.items["Astro Sync Key"])
    XCTAssertFalse(LegacyMigrator.Context.isDone(newData))
    newKeychain.items["Astro Sync Key"] = ["device-1": Data("entered again".utf8)]

    let reads = oldKeychain.reads
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(oldKeychain.reads, reads + 1, "only what didn't come across, never the Safe Storage key")
    XCTAssertEqual(newKeychain.items["Astro Connected Accounts"], ["github": Data("gh-token".utf8), "google": Data("g-token".utf8)])
    XCTAssertEqual(newKeychain.items["Astro Sync Key"], ["device-1": Data("entered again".utf8)])
    let journal = try XCTUnwrap(LegacyMigrator(context()).readJournal())
    XCTAssertEqual(journal.secrets?["Astro Connected Accounts/github"], "copied")
    XCTAssertEqual(journal.secrets?["Astro Sync Key/device-1"], "present")
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(oldKeychain.reads, reads + 1)
  }

  func testDeniedEveryTimeStopsAskingAfterThreeLaunches() throws {
    oldKeychain.denials[Renamed.syncKey.oldService] = 100
    for _ in 0..<5 { XCTAssertEqual(run(), .proceed) }
    XCTAssertEqual(oldKeychain.denials[Renamed.syncKey.oldService], 97, "three launches ask, then no more")
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.secrets?["Astro Sync Key/device-1"], "denied")
  }

  func testNeverWritesThroughALinkIntoTheOldData() throws {
    let profile = oldData.appendingPathComponent("Chromium/Default")
    let elsewhere = root.appendingPathComponent("elsewhere/Default")
    try FileManager.default.createDirectory(at: elsewhere.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.moveItem(at: profile, to: elsewhere)
    try FileManager.default.createSymbolicLink(at: profile, withDestinationURL: elsewhere)
    let before = snapshot(elsewhere.deletingLastPathComponent()), oldBefore = snapshot(oldData)
    oldKeychain.denials[Renamed.safeStorage.oldService] = 1
    answers = [1]
    XCTAssertEqual(run(), .quit)
    XCTAssertEqual(snapshot(elsewhere.deletingLastPathComponent()), before)
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(snapshot(elsewhere.deletingLastPathComponent()), before)
    XCTAssertEqual(snapshot(oldData), oldBefore)
    XCTAssertEqual(try json("session.json")["version"] as? Int, 2)
  }

  func testALinkedDataFolderIsNeverWrittenThrough() throws {
    let real = root.appendingPathComponent("elsewhere/\(LegacyName.bundleId)")
    try FileManager.default.createDirectory(at: real.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.moveItem(at: oldData, to: real)
    try FileManager.default.createSymbolicLink(at: oldData, withDestinationURL: real)
    let before = snapshot(real)
    oldKeychain.denials[Renamed.safeStorage.oldService] = 1
    answers = [1]
    XCTAssertEqual(run(), .quit)
    XCTAssertEqual(snapshot(real), before)
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(snapshot(real), before)
    try assertMigrated()
  }

  func testARetryNeverOverwritesWhatItCantSee() throws {
    oldKeychain.denials[Renamed.syncKey.oldService] = 1
    XCTAssertEqual(run(), .proceed)
    newKeychain.items["Astro Sync Key"] = ["device-1": Data("entered again".utf8)]
    newKeychain.listFails = true
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(newKeychain.items["Astro Sync Key"], ["device-1": Data("entered again".utf8)])
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.secrets?["Astro Sync Key/device-1"], "denied")
    newKeychain.listFails = false
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(newKeychain.items["Astro Sync Key"], ["device-1": Data("entered again".utf8)])
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.secrets?["Astro Sync Key/device-1"], "present")
  }

  func testAPermanentGroupFailureLeavesTransientOnesTrying() throws {
    final class Mixed: AccessGroupMover {
      var lockedLaunches = 6
      var moved: [String] = []
      func entitled(to groups: [String]) -> Bool { true }
      func move(from old: String, to new: String) -> (moved: Int, failure: OSStatus?) {
        if old.hasSuffix(".dup") { return (0, errSecDuplicateItem) }
        if lockedLaunches > 0 { lockedLaunches -= 1; return (0, errSecInteractionNotAllowed) }
        moved.append(old)
        return (1, nil)
      }
    }
    let mixed = Mixed()
    var ctx = context()
    ctx.groupMover = mixed
    ctx.accessGroups = [("T.old.dup", "T.new.dup"), ("T.old.webauthn", "T.new.webauthn")]
    for _ in 0..<7 { XCTAssertEqual(LegacyMigrator(ctx).run(), .proceed) }
    XCTAssertEqual(mixed.moved, ["T.old.webauthn"])
    for _ in 0..<6 { _ = LegacyMigrator(ctx).run() }
    XCTAssertEqual(LegacyMigrator(ctx).readJournal()?.groups, "failed")
  }

  func testAResumeAfterPartOfThePublishFinishesIt() throws {
    XCTAssertEqual(run(crashAfter: "moved-one"), .quit)
    try write(#"{"version":2,"tabs":[],"note":"used again"}"#, "session.json")
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.outcome, "migrated")
    XCTAssertTrue(FileManager.default.fileExists(atPath: newData.appendingPathComponent("Chromium/Local State").path))
    XCTAssertEqual(try json("session.json")["version"] as? Int, 2)
    XCTAssertFalse(FileManager.default.fileExists(atPath: newData.appendingPathComponent(LegacyMigrator.stagingName).path))
  }

  func testPathsThroughALinkedDataFolderPointAtTheCopy() throws {
    let real = root.appendingPathComponent("elsewhere/\(LegacyName.bundleId)")
    try FileManager.default.createDirectory(at: real.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.moveItem(at: oldData, to: real)
    try FileManager.default.createSymbolicLink(at: oldData, withDestinationURL: real)
    let physical = real.resolvingSymlinksInPath().path
    try write(#"{"version":2,"tabs":[],"folder":"PATH/Astro Sync"}"#.replacingOccurrences(of: "PATH", with: physical), "sync.json")
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(try json("sync.json")["folder"] as? String, newData.appendingPathComponent("Astro Sync").path)
  }

  func testOldAppOpenedDuringTheKeychainStepIsWaitedForAndCopiedAgain() throws {
    oldKeychain.onRead = { [unowned self] service in
      guard service == Renamed.syncKey.oldService else { return }
      oldKeychain.onRead = nil
      oldKeychain.items[Renamed.syncKey.oldService]?["device-2"] = Data(repeating: 2, count: 32)
      try? write(#"{"version":2,"deviceId":"device-2","tabs":[]}"#, "session.json")
    }
    runningAnswers = [false, false, true, true]
    answers = [0]
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(asked, ["Quit \(LegacyName.appName) to continue"])
    XCTAssertEqual(try json("session.json")["deviceId"] as? String, "device-2")
    XCTAssertEqual(newKeychain.items["Astro Sync Key"], ["device-1": Data(repeating: 1, count: 32), "device-2": Data(repeating: 2, count: 32)])
    XCTAssertEqual(oldKeychain.reads, 4 + 1, "each item read once; only the new one after the second copy")
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
  }

  func testAKeyMadeDuringTheKeychainStepComesAcross() throws {
    oldKeychain.items[Renamed.safeStorage.oldService] = nil
    oldKeychain.onRead = { [unowned self] service in
      guard service == Renamed.syncKey.oldService else { return }
      oldKeychain.onRead = nil
      oldKeychain.items[Renamed.safeStorage.oldService] = [Renamed.safeStorage.account!.old: safeStorageKey]
    }
    runningAnswers = [false, false, true, true]
    answers = [0]
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(newKeychain.items["Astro Safe Storage"], ["Astro": safeStorageKey])
  }

  func testAResumePublishesTheVerifiedCopy() throws {
    for change in ["used again", "gone"] {
      try FileManager.default.removeItem(at: root)
      oldKeychain = FakeKeychain()
      newKeychain = FakeKeychain()
      try seedOldInstall()
      XCTAssertEqual(run(crashAfter: "journal"), .quit, change)
      if change == "gone" {
        try FileManager.default.removeItem(at: oldData)
      } else {
        try write(#"{"version":2,"tabs":[],"note":"used again"}"#, "session.json")
      }
      XCTAssertEqual(run(), .proceed, change)
      XCTAssertNil(try json("session.json")["note"], change)
      XCTAssertEqual(LegacyMigrator(context()).readJournal()?.outcome, "migrated", change)
      XCTAssertTrue(FileManager.default.fileExists(atPath: newData.appendingPathComponent("Chromium/Local State").path), change)
      XCTAssertFalse(FileManager.default.fileExists(atPath: newData.appendingPathComponent(LegacyMigrator.stagingName).path), change)
    }
  }

  func testARetryThatCantListTheOldItemsKeepsThemPending() throws {
    oldKeychain.denials[Renamed.connectedAccounts.oldService] = 1
    XCTAssertEqual(run(), .proceed)
    oldKeychain.listFails = true
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.secrets?["Astro Connected Accounts/github"], "denied")
    XCTAssertFalse(LegacyMigrator.Context.isDone(newData))
    oldKeychain.listFails = false
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(newKeychain.items["Astro Connected Accounts"]?["github"], Data("gh-token".utf8))
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.secrets?["Astro Connected Accounts/github"], "copied")
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
  }

  func testARetryKeepsWhatWasSavedWhileItAsked() throws {
    oldKeychain.denials[Renamed.syncKey.oldService] = 1
    XCTAssertEqual(run(), .proceed)
    oldKeychain.onRead = { [unowned self] service in
      guard service == Renamed.syncKey.oldService else { return }
      newKeychain.items["Astro Sync Key", default: [:]]["device-1"] = Data("saved meanwhile".utf8)
    }
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(newKeychain.items["Astro Sync Key"], ["device-1": Data("saved meanwhile".utf8)])
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.secrets?["Astro Sync Key/device-1"], "present")
  }

  func testARetryThatCantCheckTheNewKeychainTriesAgain() throws {
    oldKeychain.denials[Renamed.syncKey.oldService] = 1
    XCTAssertEqual(run(), .proceed)
    oldKeychain.onRead = { [unowned self] service in
      if service == Renamed.syncKey.oldService { newKeychain.listFails = true }
    }
    XCTAssertEqual(run(), .proceed)
    XCTAssertNil(newKeychain.items["Astro Sync Key"])
    XCTAssertFalse(LegacyMigrator.Context.isDone(newData))
    oldKeychain.onRead = nil
    newKeychain.listFails = false
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(newKeychain.items["Astro Sync Key"], ["device-1": Data(repeating: 1, count: 32)])
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
  }

  func testInterruptedCacheCopyIsDoneAgain() throws {
    let oldCache = root.appendingPathComponent("caches/old/Cache"), newCache = root.appendingPathComponent("caches/new/Cache")
    try write("cached", "a", in: oldCache)
    try write("cached too", "b/c", in: oldCache)
    extras = [(oldCache, newCache)]
    XCTAssertEqual(run(crashAfter: "extra"), .quit)
    XCTAssertFalse(FileManager.default.fileExists(atPath: newCache.path))
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(try String(contentsOf: newCache.appendingPathComponent("b/c")), "cached too")
    XCTAssertEqual(try String(contentsOf: newCache.appendingPathComponent("a")), "cached")
    XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: newCache.deletingLastPathComponent().path), ["Cache"])
  }

  func testLeavesAnExistingAstroInstallAlone() throws {
    try write(#"{"version":2,"tabs":[]}"#, "session.json", in: newData)
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.outcome, "existing")
    XCTAssertEqual(try String(contentsOf: newData.appendingPathComponent("session.json")), #"{"version":2,"tabs":[]}"#)
    XCTAssertTrue(newKeychain.items.isEmpty)
  }

  func testNothingToMigrate() throws {
    try FileManager.default.removeItem(at: oldData)
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.outcome, "nothing")
    XCTAssertEqual(oldKeychain.reads, 0)
  }

  func testWhatsInTheWayGoesAside() throws {
    try write("stray", "Chromium", in: newData)
    XCTAssertEqual(run(), .proceed)
    try assertMigrated()
    let aside = newData.appendingPathComponent("\(LegacyMigrator.asideName)/Chromium")
    XCTAssertEqual(try String(contentsOf: aside), "stray")
  }

  func testKeychainGroupsWaitForTheEntitlement() throws {
    groups.isEntitled = false
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.groups, "pending")
    XCTAssertFalse(LegacyMigrator.Context.isDone(newData))
    XCTAssertTrue(groups.moves.isEmpty)
    groups.isEntitled = true
    XCTAssertEqual(run(), .proceed)
    XCTAssertEqual(LegacyMigrator(context()).readJournal()?.groups, "moved 1")
    XCTAssertTrue(LegacyMigrator.Context.isDone(newData))
    try assertMigrated()
  }

  func testRewriterOnlyTouchesWhatsOurs() {
    let r = DocumentRewriter(oldData: "/old/dir", newData: "/new/dir")
    XCTAssertEqual(r.string(oldScheme.uppercased() + "Settings/sync"), "astro://Settings/sync")
    XCTAssertEqual(r.string("view-source:\(oldScheme)history"), "view-source:astro://history")
    XCTAssertEqual(r.string("\(oldGame)#top"), "astro://game#top")
    XCTAssertEqual(r.string("\(oldChromeGame)/"), "chrome://game/")
    XCTAssertEqual(r.string("chrome://settings"), "chrome://settings")
    XCTAssertEqual(r.string("/old/dir/Astro Sync"), "/new/dir/Astro Sync")
    XCTAssertEqual(r.string("/old/directory"), "/old/directory")
    XCTAssertEqual(r.string("see \(oldScheme)history"), "see \(oldScheme)history")
  }

  func testSyncFormatIsUnchanged() throws {
    let keys = SyncKeys(entropy: Data(repeating: 0, count: 32))
    XCTAssertEqual(keys.chainTag, "gbcx4r55mk3rlaegbggknyx4ta")
    XCTAssertEqual(keys.scopeTag("app"), "nr4ncp5iyqzqgjn6ol4zksqtne")
    let sealed = try XCTUnwrap(Data(base64Encoded: try String(contentsOf: URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().appendingPathComponent("fixtures/sealed-0.2.32.b64"), encoding: .utf8)
      .trimmingCharacters(in: .whitespacesAndNewlines)))
    XCTAssertEqual(try keys.open(sealed, scopeTag: keys.scopeTag("app"), fileId: "f1"), Data("from 0.2.32".utf8))
  }
}
