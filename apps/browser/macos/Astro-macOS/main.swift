import AppKit
import AstroCore
import AstroSync

if getenv("ASTRO_PREWARM") != nil { exit(0) }

LegacyMigration.moveToNewName()

if !LegacyMigration.runAtLaunch() { exit(0) }

exit(AstroCoreHost.run(argc: CommandLine.argc, argv: CommandLine.unsafeArgv) { AppDelegate() })
