import AppKit
import ScreenCaptureKit

let usage = "usage: demo-rec <pid> <max seconds> <out.mov> [--rect x,y,w,h] [--bg RRGGBB] [--fps N]\n"
var positional: [String] = []
var rectArg: CGRect?
var background = CGColor(red: 0, green: 0, blue: 0, alpha: 0)
var fps = 60
var argIndex = 1
let argv = CommandLine.arguments
while argIndex < argv.count {
  let a = argv[argIndex]
  if a == "--rect", argIndex + 1 < argv.count {
    let n = argv[argIndex + 1].split(separator: ",").compactMap { Double($0) }
    if n.count == 4 { rectArg = CGRect(x: n[0], y: n[1], width: n[2], height: n[3]) }
    argIndex += 2
  } else if a == "--bg", argIndex + 1 < argv.count, let v = UInt32(argv[argIndex + 1], radix: 16) {
    background = CGColor(red: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
    argIndex += 2
  } else if a == "--fps", argIndex + 1 < argv.count, let v = Int(argv[argIndex + 1]) {
    fps = v
    argIndex += 2
  } else {
    positional.append(a)
    argIndex += 1
  }
}
guard positional.count == 3, let pid = Int32(positional[0]), let seconds = Double(positional[1]) else {
  FileHandle.standardError.write(usage.data(using: .utf8)!)
  exit(2)
}
let outURL = URL(fileURLWithPath: positional[2])
try? FileManager.default.removeItem(at: outURL)

final class Session: NSObject, SCRecordingOutputDelegate, SCStreamOutput {
  var started = false
  func recordingOutputDidStartRecording(_ recordingOutput: SCRecordingOutput) {
    started = true
    print("recording \(Int(Date().timeIntervalSince1970 * 1000))")
    fflush(stdout)
  }
  func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) {
    print("finished")
    fflush(stdout)
    exit(0)
  }
  func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) {
    print("error \(error)")
    fflush(stdout)
    exit(1)
  }
  func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {}
}

let session = Session()
var stopRequested = false
for sig in [SIGINT, SIGTERM] {
  signal(sig, SIG_IGN)
  let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
  source.setEventHandler { stopRequested = true }
  source.resume()
  objc_setAssociatedObject(session, "\(sig)", source, .OBJC_ASSOCIATION_RETAIN)
}

Task {
  do {
    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
    let mine = { (all: [SCWindow]) in all.filter { $0.owningApplication?.processID == pid && $0.frame.width > 1 && $0.frame.height > 1 } }
    let windows = mine(content.windows)
    guard let largest = windows.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else {
      print("no window for pid \(pid)")
      exit(1)
    }
    let rect = (rectArg ?? largest.frame).integral
    guard let display = content.displays.first(where: { $0.frame.intersects(rect) }) ?? content.displays.first else {
      print("no display")
      exit(1)
    }
    let filter = SCContentFilter(display: display, including: windows)
    let scale = CGFloat(filter.pointPixelScale)
    let local = rect.offsetBy(dx: -display.frame.minX, dy: -display.frame.minY)
    let config = SCStreamConfiguration()
    config.sourceRect = local
    config.width = Int(local.width * scale)
    config.height = Int(local.height * scale)
    config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(fps))
    config.showsCursor = false
    config.captureResolution = .best
    config.queueDepth = 8
    config.backgroundColor = background
    config.colorSpaceName = CGColorSpace.sRGB
    let stream = SCStream(filter: filter, configuration: config, delegate: nil)
    try stream.addStreamOutput(session, type: .screen, sampleHandlerQueue: DispatchQueue(label: "frames"))
    let recording = SCRecordingOutputConfiguration()
    recording.outputURL = outURL
    recording.outputFileType = .mov
    recording.videoCodecType = .h264
    let output = SCRecordingOutput(configuration: recording, delegate: session)
    try stream.addRecordingOutput(output)
    try await stream.startCapture()
    print("rect \(Int(rect.minX)),\(Int(rect.minY)),\(Int(rect.width)),\(Int(rect.height)) scale \(scale) size \(config.width)x\(config.height)")
    fflush(stdout)
    var known = Set(windows.map(\.windowID))
    let end = Date().addingTimeInterval(seconds)
    while Date() < end && !stopRequested {
      try await Task.sleep(nanoseconds: 30_000_000)
      guard let now = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true) else { continue }
      let current = mine(now.windows)
      let ids = Set(current.map(\.windowID))
      if ids != known, !current.isEmpty {
        known = ids
        try? await stream.updateContentFilter(SCContentFilter(display: display, including: current))
      }
    }
    try await stream.stopCapture()
    try? await Task.sleep(nanoseconds: 3_000_000_000)
    print("stopped without finish")
    exit(session.started ? 0 : 1)
  } catch {
    print("error \(error)")
    exit(1)
  }
}
RunLoop.main.run()
