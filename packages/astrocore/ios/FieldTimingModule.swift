import ExpoModulesCore

public class FieldTimingModule: Module {
  private let owner = NSObject()

  public func definition() -> ModuleDefinition {
    let owner = self.owner
    Name("ACFieldTiming")

    Function("setEnabled") { (enabled: Bool) in ACFieldTiming.setEnabled(enabled, owner: owner) }
    Function("markFrame") { (key: String, kind: String) in ACFieldTiming.markFrame(key, kind: kind) }
    Function("lastInput") { ACFieldTiming.lastInput() }
    Function("drain") { ACFieldTiming.drain() }

    OnDestroy { ACFieldTiming.releaseOwner(owner) }
  }
}
