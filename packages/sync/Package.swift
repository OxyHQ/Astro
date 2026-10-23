// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "AstroSyncCore",
  platforms: [.macOS(.v14)],
  products: [
    .library(name: "AstroSyncCore", targets: ["AstroSyncCore"]),
    .executable(name: "legacy-migration", targets: ["LegacyMigrationTool"]),
  ],
  targets: [
    .target(name: "AstroSyncCore", path: "ios/Core"),
    .executableTarget(name: "LegacyMigrationTool", dependencies: ["AstroSyncCore"], path: "tools/legacy-migration"),
    .testTarget(name: "AstroSyncCoreTests", dependencies: ["AstroSyncCore"], path: "tests", exclude: ["fixtures"]),
  ]
)
