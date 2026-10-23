// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "AstroImportCore",
  platforms: [.macOS(.v14)],
  products: [.library(name: "AstroImportCore", targets: ["AstroImportCore"])],
  targets: [
    .target(name: "AstroImportCore", path: "ios/Core", linkerSettings: [.linkedLibrary("sqlite3")]),
    .testTarget(
      name: "AstroImportCoreTests",
      dependencies: ["AstroImportCore"],
      path: "tests"
    ),
  ]
)
