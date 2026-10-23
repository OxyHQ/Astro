import Foundation
import Sparkle

let pairs = CommandLine.arguments.dropFirst().map { $0.split(separator: "=", maxSplits: 1).map(String.init) }
guard pairs.count >= 2, pairs.allSatisfy({ $0.count == 2 }) else {
  FileHandle.standardError.write("usage: version-order <label>=<sparkle:version> … (oldest first)\n".data(using: .utf8)!)
  exit(2)
}
let comparator = SUStandardVersionComparator.default
var ordered = true
for (older, newer) in zip(pairs, pairs.dropFirst()) {
  let result = comparator.compareVersion(older[1], toVersion: newer[1])
  let sign = result == .orderedAscending ? "<" : result == .orderedSame ? "=" : ">"
  print("      \(older[0]) (\(older[1])) \(sign) \(newer[0]) (\(newer[1]))")
  if result != .orderedAscending { ordered = false }
}
exit(ordered ? 0 : 1)
