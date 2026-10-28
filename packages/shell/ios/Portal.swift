import AppKit
import ExpoModulesCore

public final class PortalHostModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AstroPortalHost")
    View(PortalHostView.self) {
      Prop("name") { (view: PortalHostView, name: String?) in
        view.name = name
      }
    }
  }
}

public final class PortalModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AstroPortal")
    View(PortalView.self) {
      Prop("host") { (view: PortalView, host: String?) in
        view.hostName = host
      }
    }
  }
}

private final class WeakHost {
  weak var view: PortalHostView?
  init(_ view: PortalHostView) { self.view = view }
}

final class PortalRegistry {
  static let shared = PortalRegistry()
  private var hosts: [String: [WeakHost]] = [:]
  private let portals = NSHashTable<PortalView>.weakObjects()

  func host(named name: String) -> PortalHostView? { hosts[name]?.last(where: { $0.view != nil })?.view }

  func register(_ host: PortalHostView, as name: String) {
    hosts[name] = (hosts[name] ?? []).filter { $0.view != nil && $0.view !== host } + [WeakHost(host)]
    relink(name)
  }

  func unregister(_ host: PortalHostView, as name: String) {
    let remaining = (hosts[name] ?? []).filter { $0.view != nil && $0.view !== host }
    hosts[name] = remaining.isEmpty ? nil : remaining
    relink(name)
  }

  func add(_ portal: PortalView) { portals.add(portal) }
  func remove(_ portal: PortalView) { portals.remove(portal) }

  func hostResized(_ name: String) {
    for portal in portals.allObjects where portal.hostName == name { portal.followHostSize() }
  }

  private func relink(_ name: String) {
    for portal in portals.allObjects where portal.hostName == name { portal.attach() }
  }
}

public final class PortalHostView: ExpoView {
  var name: String? {
    didSet {
      guard oldValue != name else { return }
      if let oldValue { PortalRegistry.shared.unregister(self, as: oldValue) }
      if let name { PortalRegistry.shared.register(self, as: name) }
    }
  }

  public override func setFrameSize(_ newSize: NSSize) {
    let changed = newSize != frame.size
    super.setFrameSize(newSize)
    if changed, let name { PortalRegistry.shared.hostResized(name) }
  }

  deinit {
    if let name { PortalRegistry.shared.unregister(self, as: name) }
  }
}

private final class PortalContentView: NSView {
  override var isFlipped: Bool { true }

  override func hitTest(_ point: NSPoint) -> NSView? {
    let hit = super.hitTest(point)
    return hit === self ? nil : hit
  }
}

public final class PortalView: ExpoView {
  private let content = PortalContentView()

  var hostName: String? {
    didSet {
      guard oldValue != hostName else { return }
      attach()
    }
  }

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    content.wantsLayer = true
    content.autoresizingMask = [.width, .height]
    PortalRegistry.shared.add(self)
  }

  deinit {
    PortalRegistry.shared.remove(self)
    content.removeFromSuperview()
  }

  public override func hitTest(_ point: NSPoint) -> NSView? { nil }

  public override func mountChildComponentView(_ childComponentView: UIView, index: Int) {
    content.subviews.insert(childComponentView, at: min(index, content.subviews.count))
  }

  public override func unmountChildComponentView(_ childComponentView: UIView, index: Int) {
    childComponentView.removeFromSuperview()
  }

  func attach() {
    guard let host = hostName.flatMap({ PortalRegistry.shared.host(named: $0) }) else {
      content.removeFromSuperview()
      return
    }
    if content.superview !== host {
      content.frame = host.bounds
      host.addSubview(content)
    }
    followHostSize()
  }

  func followHostSize() {
    guard let host = content.superview else { return }
    content.frame = host.bounds
    setStyleSize(NSNumber(value: Double(host.bounds.width)), height: NSNumber(value: Double(host.bounds.height)))
  }
}
