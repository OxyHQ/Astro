import ExpoModulesCore

public class ChromeUIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AstroChromeUI")
    Events("onDeviceChooser", "onCastDialog", "onCastRoutes", "onSidePanel", "onActionPopup", "onActionShortcut")

    OnCreate {
      AstroCoreHost.chromeUIHandler = { [weak self] name, payload in
        switch name {
        case "sidePanel": self?.sendEvent("onSidePanel", payload)
        case "actionPopup": self?.sendEvent("onActionPopup", payload)
        case "actionShortcut": self?.sendEvent("onActionShortcut", payload)
        case "deviceChooser": self?.sendEvent("onDeviceChooser", payload)
        case "castDialog": self?.sendEvent("onCastDialog", payload)
        case "castRoutes": self?.sendEvent("onCastRoutes", payload)
        default: break
        }
      }
    }

    AsyncFunction("selectDevice") { (id: Int, index: Int) in AstroCoreHost.deviceChooser(Int32(id), select: Int32(index)) }.runOnQueue(.main)
    AsyncFunction("cancelDeviceChooser") { (id: Int) in AstroCoreHost.deviceChooser(Int32(id), action: "cancel") }.runOnQueue(.main)
    AsyncFunction("refreshDeviceChooser") { (id: Int) in AstroCoreHost.deviceChooser(Int32(id), action: "refresh") }.runOnQueue(.main)
    AsyncFunction("openBluetoothSettings") { (id: Int) in AstroCoreHost.deviceChooser(Int32(id), action: "settings") }.runOnQueue(.main)
    AsyncFunction("devShowBluetoothChooser") { (browserId: Int, unauthorized: Bool) -> Bool in
      AstroCoreHost.devShowBluetoothChooser(browserId: Int32(browserId), unauthorized: unauthorized)
    }.runOnQueue(.main)
    AsyncFunction("devChooserEvents") { AstroCoreHost.testChooserEvents() }.runOnQueue(.main)

    AsyncFunction("showCastDialog") { (browserId: Int) in AstroCoreHost.showCastDialog(browserId: Int32(browserId)) }.runOnQueue(.main)
    AsyncFunction("startCasting") { (id: Int, sink: String, mode: Int) in
      AstroCoreHost.castDialog(Int32(id), start: sink, mode: Int32(mode))
    }.runOnQueue(.main)
    AsyncFunction("stopCasting") { (id: Int, route: String) in AstroCoreHost.castDialog(Int32(id), stop: route) }.runOnQueue(.main)
    AsyncFunction("closeCastDialog") { (id: Int) in AstroCoreHost.closeCastDialog(Int32(id)) }.runOnQueue(.main)
    AsyncFunction("watchCastRoutes") { (profile: String) in AstroCoreHost.watchCastRoutes(profile) }.runOnQueue(.main)
    AsyncFunction("terminateCastRoute") { (route: String) in AstroCoreHost.terminateCastRoute(route) }.runOnQueue(.main)

    AsyncFunction("actionStates") { (browserId: Int, ids: [String]) in
      AstroCoreHost.actionStates(browserId: Int32(browserId), extensions: ids)
    }.runOnQueue(.main)
    AsyncFunction("sidePanelURL") { (browserId: Int, extensionId: String) -> String? in
      AstroCoreHost.sidePanelURL(browserId: Int32(browserId), extension: extensionId)
    }.runOnQueue(.main)

    AsyncFunction("changeCaptureSource") { (capturer: Int, target: Int) -> Bool in
      AstroCoreHost.shareTabInstead(capturer: Int32(capturer), target: Int32(target))
    }.runOnQueue(.main)
    AsyncFunction("stopCapture") { (capturer: Int) in AstroCoreHost.stopCapture(browserId: Int32(capturer)) }.runOnQueue(.main)
    AsyncFunction("showAutofillSuggestions") { (browserId: Int, passwords: Bool) in
      AstroCoreHost.showAutofillSuggestions(browserId: Int32(browserId), passwords: passwords)
    }.runOnQueue(.main)
  }
}
