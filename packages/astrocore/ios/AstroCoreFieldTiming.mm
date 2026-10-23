#import "AstroCoreFieldTiming.h"

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <React/RCTBridge.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUIManager.h>
#import <React/RCTUIManagerUtils.h>
#import <os/lock.h>

#include <atomic>
#include <cmath>

@interface CATransaction (ACFieldTimingPrivate)
+ (void)addCommitHandler:(void (^)(void))block forPhase:(unsigned int)phase;
@end

namespace {

constexpr NSUInteger kMaxMarks = 512;
constexpr unsigned int kPostCommit = 2;

std::atomic<bool> gEnabled{false};
std::atomic<uintptr_t> gOwner{0};
std::atomic<double> gLastInputAt{0};
std::atomic<int> gLastInputKind{0};
os_unfair_lock gLock = OS_UNFAIR_LOCK_INIT;
NSMutableArray<NSArray *> *gMarks;
id gInputMonitor;

double EventTime(NSEvent *event) {
  return ACFieldNow() - (NSProcessInfo.processInfo.systemUptime - event.timestamp) * 1000;
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
    AstroCoreWebViewsSetFieldTiming(gEnabled);
  });
  if (enabled) return;
  os_unfair_lock_lock(&gLock);
  [gMarks removeAllObjects];
  os_unfair_lock_unlock(&gLock);
}

}

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

@interface ACFieldTimingModule : NSObject <RCTBridgeModule, RCTInvalidating>
@end

@implementation ACFieldTimingModule

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE(ACFieldTiming)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (dispatch_queue_t)methodQueue {
  return RCTGetUIManagerQueue();
}

RCT_EXPORT_METHOD(setEnabled : (BOOL)enabled) {
  gOwner = (uintptr_t)(__bridge void *)self;
  SetEnabled(enabled);
}

- (void)invalidate {
  uintptr_t me = (uintptr_t)(__bridge void *)self;
  if (gOwner.compare_exchange_strong(me, 0)) SetEnabled(false);
}

RCT_EXPORT_METHOD(markFrame : (NSString *)key kind : (NSString *)kind) {
  if (!gEnabled) return;
  NSString *k = [key copy], *what = [kind copy];
  [_bridge.uiManager addUIBlock:^(__unused RCTUIManager *manager, __unused NSDictionary *registry) {
    ACFieldMarkAtCommit(k, what);
  }];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(lastInput) {
  return @[ @(round(gLastInputAt.load() * 10) / 10), @(gLastInputKind.load()) ];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(drain) {
  os_unfair_lock_lock(&gLock);
  NSArray *marks = gMarks.copy ?: @[];
  [gMarks removeAllObjects];
  os_unfair_lock_unlock(&gLock);
  return marks;
}

@end
