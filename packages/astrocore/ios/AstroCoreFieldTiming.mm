#import "AstroCoreFieldTiming.h"

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <os/lock.h>

#include <atomic>
#include <cmath>
#include <vector>

@interface CATransaction (ACFieldTimingPrivate)
+ (void)addCommitHandler:(void (^)(void))block forPhase:(unsigned int)phase;
@end

@protocol ACFieldMountedSurfaces <NSObject>
- (void)addObserver:(id)observer;
@end

@interface ACFieldMountObserver : NSObject
- (void)willMountComponentsWithRootTag:(NSInteger)rootTag;
- (void)didMountComponentsWithRootTag:(NSInteger)rootTag;
@end

namespace {

constexpr NSUInteger kMaxMarks = 512;
constexpr unsigned int kPostCommit = 2;

struct Frame {
  NSString *key;
  NSString *kind;
  uint64_t sequence;
};

std::atomic<bool> gEnabled{false};
std::atomic<uintptr_t> gOwner{0};
std::atomic<double> gLastInputAt{0};
std::atomic<int> gLastInputKind{0};
os_unfair_lock gLock = OS_UNFAIR_LOCK_INIT;
NSMutableArray<NSArray *> *gMarks;
std::vector<Frame> gFrames;
uint64_t gFrameSequence;
id gInputMonitor;
ACFieldMountObserver *gMountObserver;
__weak id gObservedSurfaces;

double EventTime(NSEvent *event) {
  return ACFieldNow() - (NSProcessInfo.processInfo.systemUptime - event.timestamp) * 1000;
}

uint64_t LatestFrame() {
  os_unfair_lock_lock(&gLock);
  const uint64_t latest = gFrameSequence;
  os_unfair_lock_unlock(&gLock);
  return latest;
}

void MarkFramesThrough(uint64_t through) {
  std::vector<Frame> due;
  os_unfair_lock_lock(&gLock);
  auto end = gFrames.begin();
  while (end != gFrames.end() && end->sequence <= through) ++end;
  due.assign(std::make_move_iterator(gFrames.begin()), std::make_move_iterator(end));
  gFrames.erase(gFrames.begin(), end);
  os_unfair_lock_unlock(&gLock);
  for (const Frame &frame : due) ACFieldMarkAtCommit(frame.key, frame.kind);
}

void ObserveMounts() {
  NSObject *delegate = (NSObject *)NSApp.delegate;
  id surfaces = nil;
  @try {
    surfaces = [delegate valueForKeyPath:@"factory.rootViewFactory.reactHost.surfacePresenter"];
  } @catch (NSException *) {
  }
  if (!surfaces || surfaces == gObservedSurfaces || ![surfaces respondsToSelector:@selector(addObserver:)]) return;
  if (!gMountObserver) gMountObserver = [ACFieldMountObserver new];
  [(id<ACFieldMountedSurfaces>)surfaces addObserver:gMountObserver];
  gObservedSurfaces = surfaces;
}

void SetEnabled(bool enabled) {
  gEnabled = enabled;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (enabled && !gInputMonitor) {
      gInputMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskKeyDown | NSEventMaskLeftMouseDown | NSEventMaskLeftMouseUp
                                                            handler:^NSEvent *(NSEvent *event) {
        gLastInputAt = EventTime(event);
        gLastInputKind = event.type == NSEventTypeKeyDown ? 1 : 2;
        return event;
      }];
    } else if (!enabled && gInputMonitor) {
      [NSEvent removeMonitor:gInputMonitor];
      gInputMonitor = nil;
    }
    if (enabled) ObserveMounts();
    AstroCoreWebViewsSetFieldTiming(gEnabled);
  });
  if (enabled) return;
  os_unfair_lock_lock(&gLock);
  [gMarks removeAllObjects];
  gFrames.clear();
  os_unfair_lock_unlock(&gLock);
}

}

@implementation ACFieldMountObserver {
  uint64_t _mounting;
}

- (void)willMountComponentsWithRootTag:(NSInteger)rootTag {
  _mounting = LatestFrame();
}

- (void)didMountComponentsWithRootTag:(NSInteger)rootTag {
  MarkFramesThrough(_mounting);
}

@end

BOOL ACFieldTimingEnabled(void) {
  return gEnabled;
}

double ACFieldNow(void) {
  return NSDate.date.timeIntervalSince1970 * 1000;
}

void ACFieldMark(NSString *key, NSString *kind, double at) {
  if (!gEnabled || !key.length || !std::isfinite(at)) return;
  NSArray *mark = @[ key, kind, @(round(at * 10) / 10) ];
  os_unfair_lock_lock(&gLock);
  if (!gMarks) gMarks = [NSMutableArray array];
  if (gMarks.count >= kMaxMarks) [gMarks removeObjectAtIndex:0];
  [gMarks addObject:mark];
  os_unfair_lock_unlock(&gLock);
}

void ACFieldMarkNow(NSString *key, NSString *kind) {
  if (gEnabled) ACFieldMark(key, kind, ACFieldNow());
}

void ACFieldMarkAtCommit(NSString *key, NSString *kind) {
  if (!gEnabled || !key.length) return;
  NSString *k = [key copy];
  if ([CATransaction respondsToSelector:@selector(addCommitHandler:forPhase:)])
    [CATransaction addCommitHandler:^{ ACFieldMark(k, kind, ACFieldNow()); } forPhase:kPostCommit];
  else
    ACFieldMark(k, kind, ACFieldNow());
}

@implementation ACFieldTiming

+ (void)setEnabled:(BOOL)enabled owner:(id)owner {
  gOwner = (uintptr_t)(__bridge void *)owner;
  SetEnabled(enabled);
}

+ (void)releaseOwner:(id)owner {
  uintptr_t expected = (uintptr_t)(__bridge void *)owner;
  if (gOwner.compare_exchange_strong(expected, 0)) SetEnabled(false);
}

+ (void)markFrame:(NSString *)key kind:(NSString *)kind {
  if (!gEnabled || !key.length) return;
  os_unfair_lock_lock(&gLock);
  const uint64_t sequence = ++gFrameSequence;
  NSString *frameKey = [key copy], *frameKind = [kind copy];
  gFrames.push_back(Frame{frameKey, frameKind, sequence});
  os_unfair_lock_unlock(&gLock);
  CFRunLoopRef javaScript = CFRunLoopGetCurrent();
  CFRunLoopPerformBlock(javaScript, kCFRunLoopCommonModes, ^{
    dispatch_async(dispatch_get_main_queue(), ^{ MarkFramesThrough(sequence); });
  });
  CFRunLoopWakeUp(javaScript);
}

+ (NSArray<NSNumber *> *)lastInput {
  return @[ @(round(gLastInputAt.load() * 10) / 10), @(gLastInputKind.load()) ];
}

+ (NSArray<NSArray *> *)drain {
  os_unfair_lock_lock(&gLock);
  NSArray *marks = gMarks.copy ?: @[];
  [gMarks removeAllObjects];
  os_unfair_lock_unlock(&gLock);
  return marks;
}

@end
