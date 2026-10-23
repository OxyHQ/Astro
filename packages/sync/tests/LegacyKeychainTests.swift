import CommonCrypto
import Foundation
import Security
import XCTest
@testable import AstroSyncCore

final class LegacyKeychainTests: XCTestCase {
  var dir: URL!
  var keychain: SecKeychain!
  var searchListBefore: [String] = []

  static func searchList() -> [String] {
    var list: CFArray?
    SecKeychainCopySearchList(&list)
    return ((list as? [SecKeychain]) ?? []).map { kc in
      var length: UInt32 = 1024
      var path = [CChar](repeating: 0, count: 1024)
      SecKeychainGetPath(kc, &length, &path)
      return String(cString: path)
    }
  }

  override func setUpWithError() throws {
    searchListBefore = Self.searchList()
    dir = URL(fileURLWithPath: "/tmp/ac-astro-mig/keychain-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let password = "throwaway"
    var kc: SecKeychain?
    let status = SecKeychainCreate(dir.appendingPathComponent("test.keychain-db").path, UInt32(password.utf8.count), password,
                                   false, nil, &kc)
    XCTAssertEqual(status, errSecSuccess)
    keychain = try XCTUnwrap(kc)
    XCTAssertEqual(Self.searchList(), searchListBefore, "the throwaway keychain stays out of the search list")
  }

  override func tearDownWithError() throws {
    if let keychain { SecKeychainDelete(keychain) }
    try? FileManager.default.removeItem(at: dir)
    XCTAssertEqual(Self.searchList(), searchListBefore)
  }

  let item = Renamed.KeychainItem(
    oldService: "Astro Migration Test Old Safe Storage", newService: "Astro Migration Test New Safe Storage",
    account: ("Old", "New"), label: { _ in "Astro Migration Test New Safe Storage" }, accessible: nil, critical: true)

  static func crypt(_ op: CCOperation, _ secret: Data, _ input: Data) -> Data? {
    var key = [UInt8](repeating: 0, count: 16)
    let salt = Array("saltysalt".utf8)
    _ = secret.withUnsafeBytes { s in
      CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), s.bindMemory(to: CChar.self).baseAddress, secret.count, salt, salt.count,
                           CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1), 1003, &key, 16)
    }
    let iv = [UInt8](repeating: 0x20, count: 16)
    var out = [UInt8](repeating: 0, count: input.count + 16)
    var moved = 0
    let status = input.withUnsafeBytes { i in
      CCCrypt(op, CCAlgorithm(kCCAlgorithmAES128), CCOptions(kCCOptionPKCS7Padding), key, 16, iv, i.baseAddress, input.count,
              &out, out.count, &moved)
    }
    return status == kCCSuccess ? Data(out.prefix(moved)) : nil
  }

  func testTheKeyComesAcrossAndStillDecryptsWhatItEncrypted() throws {
    let store = LoginKeychain(only: keychain)
    let secret = Data("throwaway safe storage secret".utf8)
    XCTAssertEqual(store.accounts(service: item.oldService), [])
    XCTAssertTrue(store.write(service: item.oldService, account: "Old", label: "old", accessible: nil, data: secret))
    let cookie = Data("v10".utf8) + Self.crypt(CCOperation(kCCEncrypt), secret, Data("session=kept".utf8))!

    let migrator = LegacyMigrator(LegacyMigrator.Context(
      oldData: dir.appendingPathComponent("old"), newData: dir.appendingPathComponent("new"),
      oldDefaults: PreferencesDomain(id: dir.appendingPathComponent("old-prefs").path),
      newDefaults: PreferencesDomain(id: dir.appendingPathComponent("new-prefs").path),
      oldSecrets: store, newSecrets: store, oldAppRunning: { false }, ask: { _, _, _ in nil }))
    guard case let .copied(results) = migrator.copySecrets(item, from: store, to: store) else { return XCTFail("not copied") }
    XCTAssertEqual(results, ["\(item.newService)/New": "copied"])
    XCTAssertEqual(store.accounts(service: item.newService), ["New"])
    guard case let .found(carried) = store.read(service: item.newService, account: "New") else { return XCTFail("no new item") }
    XCTAssertEqual(Self.crypt(CCOperation(kCCDecrypt), carried, cookie.dropFirst(3)), Data("session=kept".utf8))
    XCTAssertEqual(store.read(service: item.oldService, account: "Old"), .found(secret), "the old item stays")

    XCTAssertTrue(store.write(service: item.newService, account: "New", label: "x", accessible: nil, data: Data("other".utf8)))
    guard case .copied = migrator.copySecrets(item, from: store, to: store) else { return XCTFail("not copied") }
    XCTAssertEqual(store.read(service: item.newService, account: "New"), .found(secret))
    XCTAssertEqual(store.accounts(service: item.newService), ["New"])

    let accounts = Renamed.KeychainItem(oldService: item.oldService, newService: item.newService, account: nil,
                                        label: { $0 }, accessible: nil, critical: false)
    XCTAssertTrue(store.write(service: item.newService, account: "Old", label: "x", accessible: nil, data: Data("newer".utf8)))
    let present = Set(try XCTUnwrap(store.accounts(service: item.newService)))
    guard case let .copied(retried) = migrator.copySecrets(accounts, from: store, to: store, skip: present) else {
      return XCTFail("not copied")
    }
    XCTAssertTrue(retried.isEmpty)
    XCTAssertEqual(store.read(service: item.newService, account: "Old"), .found(Data("newer".utf8)))
  }

  func testAMissingOldItemIsMissingNotAnError() {
    let store = LoginKeychain(only: keychain)
    XCTAssertEqual(store.accounts(service: item.oldService), [])
    XCTAssertEqual(store.read(service: item.oldService, account: "Old"), .missing)
  }
}
