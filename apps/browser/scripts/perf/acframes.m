#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <mach/mach.h>
#import <dlfcn.h>
#import <objc/message.h>
#import <objc/runtime.h>
#import <pthread.h>
#include <stdatomic.h>
#include <time.h>

static FILE *gOut;
static NSString *gDir;

static double EpochMs(void) {
  struct timespec ts;
  clock_gettime(CLOCK_REALTIME, &ts);
  return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6;
}

typedef struct {
  char k, th;
  double a, b, c, d, e;
} Rec;
#define RING (1 << 17)
static Rec gRing[RING];
static _Atomic unsigned long gHead, gTail;

static void Push(char k, char th, double a, double b, double c, double d, double e) {
  unsigned long h = atomic_fetch_add(&gHead, 1);
  if (h - atomic_load(&gTail) >= RING) return;
  gRing[h % RING] = (Rec){k, th, a, b, c, d, e};
}

static void Flush(void) {
  unsigned long h = atomic_load(&gHead), t = atomic_load(&gTail);
  for (; t < h; t++) {
    Rec r = gRing[t % RING];
    switch (r.k) {
      case 'f': fprintf(gOut, "{\"k\":\"f\",\"ts\":%.3f,\"now\":%.3f,\"tgt\":%.3f,\"mc\":%.3f,\"jc\":%.3f}\n", r.a, r.b, r.c, r.d, r.e); break;
      case 'r': fprintf(gOut, "{\"k\":\"r\",\"th\":\"%c\",\"a\":%.3f,\"d\":%.3f}\n", r.th, r.a, r.b); break;
      case 'l': fprintf(gOut, "{\"k\":\"l\",\"a\":%.3f,\"d\":%.3f}\n", r.a, r.b); break;
      case 'k': fprintf(gOut, "{\"k\":\"key\",\"made\":%.3f,\"seen\":%.3f}\n", r.a, r.b); break;
    }
  }
  atomic_store(&gTail, t);
  fflush(gOut);
}

static _Atomic long gLayoutPasses, gMountBatches, gUIBlocks, gViewUpdates, gViewCreates, gTicks;

static void Swizzle(Class cls, SEL sel, id (^make)(IMP original)) {
  Method m = class_getInstanceMethod(cls, sel);
  if (!m) return;
  method_setImplementation(m, imp_implementationWithBlock(make(method_getImplementation(m))));
}

static void SwizzleUIManager(void) {
  Class cls = NSClassFromString(@"RCTUIManager");
  if (!cls) return;
  Swizzle(cls, NSSelectorFromString(@"_layoutAndMount"), ^id(IMP orig) {
    return ^(id self) {
      double a = EpochMs();
      ((void (*)(id, SEL))orig)(self, NSSelectorFromString(@"_layoutAndMount"));
      atomic_fetch_add(&gLayoutPasses, 1);
      Push('l', 0, a, EpochMs() - a, 0, 0, 0);
    };
  });
  Swizzle(cls, NSSelectorFromString(@"flushUIBlocksWithCompletion:"), ^id(IMP orig) {
    return ^(id self, id completion) {
      NSArray *pending = [self valueForKey:@"_pendingUIBlocks"];
      if (pending.count) {
        atomic_fetch_add(&gMountBatches, 1);
        atomic_fetch_add(&gUIBlocks, (long)pending.count);
      }
      ((void (*)(id, SEL, id))orig)(self, NSSelectorFromString(@"flushUIBlocksWithCompletion:"), completion);
    };
  });
  Swizzle(cls, NSSelectorFromString(@"updateView:viewName:props:"), ^id(IMP orig) {
    return ^(id self, NSNumber *tag, NSString *name, NSDictionary *props) {
      atomic_fetch_add(&gViewUpdates, 1);
      ((void (*)(id, SEL, id, id, id))orig)(self, NSSelectorFromString(@"updateView:viewName:props:"), tag, name, props);
    };
  });
  Swizzle(cls, NSSelectorFromString(@"createView:viewName:rootTag:props:"), ^id(IMP orig) {
    return ^(id self, NSNumber *tag, NSString *name, NSNumber *root, NSDictionary *props) {
      atomic_fetch_add(&gViewCreates, 1);
      ((void (*)(id, SEL, id, id, id, id))orig)(self, NSSelectorFromString(@"createView:viewName:rootTag:props:"), tag, name, root, props);
    };
  });
}

static mach_port_t gMainThread, gJSThread;
static double ThreadCpuMs(mach_port_t t) {
  if (!t) return -1;
  thread_basic_info_data_t i;
  mach_msg_type_number_t n = THREAD_BASIC_INFO_COUNT;
  if (thread_info(t, THREAD_BASIC_INFO, (thread_info_t)&i, &n) != KERN_SUCCESS) return -1;
  return (i.user_time.seconds + i.system_time.seconds) * 1e3 + (i.user_time.microseconds + i.system_time.microseconds) / 1e3;
}

typedef struct {
  char th;
  double start;
} LoopState;
static LoopState gMainLoop = {'m', 0}, gJSLoop = {'j', 0};

static void LoopActivity(CFRunLoopObserverRef observer, CFRunLoopActivity activity, void *info) {
  LoopState *st = info;
  if (activity == kCFRunLoopAfterWaiting) {
    st->start = EpochMs();
  } else if (st->start > 0) {
    double end = EpochMs();
    if (end - st->start >= 0.05) Push('r', st->th, st->start, end - st->start, 0, 0, 0);
    st->start = 0;
  }
}

static void ObserveLoop(CFRunLoopRef loop, LoopState *st) {
  CFRunLoopObserverContext ctx = {0, st, NULL, NULL, NULL};
  CFRunLoopObserverRef o = CFRunLoopObserverCreate(kCFAllocatorDefault, kCFRunLoopAfterWaiting | kCFRunLoopBeforeWaiting, true, 0x7FFFFFF0, LoopActivity, &ctx);
  CFRunLoopAddObserver(loop, o, kCFRunLoopCommonModes);
}

static BOOL gJSObserved;
static void FindJSThread(void) {
  if (gJSObserved) return;
  CFRunLoopRef (*loopFor)(pthread_t) = dlsym(RTLD_DEFAULT, "_CFRunLoopGet0");
  if (!loopFor) return;
  thread_act_array_t threads;
  mach_msg_type_number_t n;
  if (task_threads(mach_task_self(), &threads, &n) != KERN_SUCCESS) return;
  for (mach_msg_type_number_t i = 0; i < n; i++) {
    pthread_t p = pthread_from_mach_thread_np(threads[i]);
    char name[64] = {0};
    if (p && pthread_getname_np(p, name, sizeof name) == 0 && strcmp(name, "com.facebook.react.JavaScript") == 0) {
      CFRunLoopRef loop = loopFor(p);
      if (loop) {
        ObserveLoop(loop, &gJSLoop);
        gJSThread = threads[i];
        gJSObserved = YES;
      }
    }
  }
  for (mach_msg_type_number_t i = 0; i < n; i++)
    if (threads[i] != gJSThread) mach_port_deallocate(mach_task_self(), threads[i]);
  vm_deallocate(mach_task_self(), (vm_address_t)threads, n * sizeof *threads);
}

@interface ACFramesProbe : NSObject
+ (instancetype)shared;
@property(nonatomic, strong) CADisplayLink *link;
@property(nonatomic, copy) NSString *screenName;
@property(nonatomic) NSInteger maxFPS;
- (BOOL)booted;
- (void)boot;
@end

@implementation ACFramesProbe {
  void (^_step)(double ts, BOOL *done);
  NSString *_driverId;
  NSString *_driverOp;
  NSString *_lastCmd;
  BOOL _booted;
}

+ (instancetype)shared {
  static ACFramesProbe *p;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ p = [ACFramesProbe new]; });
  return p;
}

- (void)answer:(NSString *)cid with:(NSDictionary *)body {
  NSMutableDictionary *d = [body mutableCopy];
  d[@"id"] = cid;
  NSData *json = [NSJSONSerialization dataWithJSONObject:d options:0 error:nil];
  NSString *tmp = [gDir stringByAppendingPathComponent:@"bench-frames-result.tmp"];
  [json writeToFile:tmp atomically:NO];
  rename(tmp.UTF8String, [gDir stringByAppendingPathComponent:@"bench-frames-result.json"].UTF8String);
}

- (NSWindow *)appWindow {
  for (NSWindow *w in NSApp.windows)
    if (w.isVisible && w.frame.size.width >= 300 && w.frame.size.height >= 200) return w;
  return nil;
}

- (BOOL)booted {
  return _booted;
}

- (void)boot {
  NSWindow *w = NSApp ? [self appWindow] : nil;
  if (!w) return;
  if (_booted) return;
  _booted = YES;
  [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskKeyDown handler:^NSEvent *(NSEvent *event) {
    double now = EpochMs();
    Push('k', 0, now - (NSProcessInfo.processInfo.systemUptime - event.timestamp) * 1000, now, 0, 0, 0);
    return event;
  }];
  [self startOn:w];
}

- (void)startOn:(NSWindow *)w {
  NSScreen *screen = w.screen ?: NSScreen.screens.firstObject;
  self.screenName = screen.localizedName;
  self.maxFPS = screen.maximumFramesPerSecond;
  self.link = [screen displayLinkWithTarget:self selector:@selector(tick:)];
  self.link.preferredFrameRateRange = CAFrameRateRangeMake(self.maxFPS, self.maxFPS, self.maxFPS);
  [self.link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  SwizzleUIManager();
  ObserveLoop(CFRunLoopGetMain(), &gMainLoop);
  fprintf(gOut, "{\"k\":\"info\",\"screen\":\"%s\",\"maxFPS\":%ld,\"at\":%.3f}\n", self.screenName.UTF8String, (long)self.maxFPS, EpochMs());
  CFRunLoopTimerRef find = CFRunLoopTimerCreateWithHandler(kCFAllocatorDefault, CFAbsoluteTimeGetCurrent() + 0.25, 0.25, 0, 0, ^(CFRunLoopTimerRef t) {
    FindJSThread();
    if (gJSObserved) CFRunLoopTimerInvalidate(t);
  });
  CFRunLoopAddTimer(CFRunLoopGetMain(), find, kCFRunLoopCommonModes);
}

- (void)tick:(CADisplayLink *)l {
  double now = EpochMs();
  double off = now - CACurrentMediaTime() * 1000;
  double ts = l.timestamp * 1000 + off;
  if (gMainLoop.start > 0) {
    if (now - gMainLoop.start >= 0.05) Push('r', 'm', gMainLoop.start, now - gMainLoop.start, 0, 0, 0);
    gMainLoop.start = now;
  }
  Push('f', 0, ts, now, l.targetTimestamp * 1000 + off, ThreadCpuMs(gMainThread), ThreadCpuMs(gJSThread));
  atomic_fetch_add(&gTicks, 1);
  if (_step) {
    BOOL done = NO;
    _step(ts, &done);
    if (done) {
      _step = nil;
      [self answer:_driverId with:@{@"ok": @YES, @"op": _driverOp}];
    }
  }
}

- (NSScrollView *)tallestScrollView {
  NSScrollView *best = nil;
  CGFloat bestHeight = 0;
  for (NSWindow *w in NSApp.windows) {
    if (!w.isVisible || w.contentView == nil) continue;
    NSMutableArray<NSView *> *todo = [NSMutableArray arrayWithObject:w.contentView];
    while (todo.count) {
      NSView *v = todo.lastObject;
      [todo removeLastObject];
      if ([v isKindOfClass:NSScrollView.class]) {
        NSScrollView *sv = (NSScrollView *)v;
        CGFloat h = sv.documentView.frame.size.height;
        if (h > sv.contentView.bounds.size.height * 1.5 && h > bestHeight) (best = sv), (bestHeight = h);
      }
      [todo addObjectsFromArray:v.subviews];
    }
  }
  return best;
}

- (void)setScrollY:(CGFloat)y of:(NSScrollView *)sv {
  NSClipView *clip = sv.contentView;
  CGFloat docH = sv.documentView.frame.size.height, viewH = clip.bounds.size.height;
  y = MAX(0, MIN(y, docH - viewH));
  CGFloat originY = sv.documentView.isFlipped ? y : docH - viewH - y;
  [clip scrollToPoint:NSMakePoint(clip.bounds.origin.x, originY)];
  [sv reflectScrolledClipView:clip];
}

- (void)runScroll:(NSDictionary *)cmd id:(NSString *)cid {
  NSScrollView *sv = [self tallestScrollView];
  if (!sv) return [self answer:cid with:@{@"ok": @NO, @"error": @"no tall scroll view"}];
  double distance = [cmd[@"distance"] doubleValue] ?: 3000, secs = [cmd[@"seconds"] doubleValue] ?: 1;
  BOOL back = [cmd[@"back"] boolValue];
  [self setScrollY:0 of:sv];
  __block double t0 = 0;
  _driverId = cid;
  _driverOp = @"scroll";
  __weak ACFramesProbe *weak = self;
  _step = ^(double ts, BOOL *done) {
    if (t0 == 0) t0 = ts;
    double t = (ts - t0) / 1000, total = back ? secs * 2 : secs;
    double phase = t < secs ? t / secs : (t - secs) / secs;
    double eased = 1 - pow(1 - MIN(phase, 1), 3);
    double y = t < secs ? distance * eased : distance * (1 - eased);
    [weak setScrollY:y of:sv];
    if (t >= total) *done = YES;
  };
}

- (void)collectHoverViews:(NSView *)root into:(NSMutableArray<NSView *> *)out {
  SEL sel = NSSelectorFromString(@"onMouseEnter");
  for (NSView *v in root.subviews) {
    if ([v respondsToSelector:sel] && ((id (*)(id, SEL))objc_msgSend)(v, sel) != nil && v.window) [out addObject:v];
    [self collectHoverViews:v into:out];
  }
}

- (void)runHover:(NSDictionary *)cmd id:(NSString *)cid {
  NSScrollView *sv = [self tallestScrollView];
  NSMutableArray<NSView *> *views = [NSMutableArray array];
  [self collectHoverViews:(sv ?: self.appWindow.contentView) into:views];
  NSMutableArray<NSView *> *rows = [NSMutableArray array];
  for (NSView *v in views) {
    NSRect r = [v convertRect:v.bounds toView:nil];
    NSView *clip = sv.contentView;
    NSRect visible = clip ? [clip convertRect:clip.bounds toView:nil] : v.window.contentView.frame;
    if (NSIntersectsRect(r, visible) && r.size.height < 80) [rows addObject:v];
  }
  NSInteger want = [cmd[@"rows"] integerValue] ?: 20;
  if (rows.count > want) [rows removeObjectsInRange:NSMakeRange(want, rows.count - want)];
  if (rows.count < 2) return [self answer:cid with:@{@"ok": @NO, @"error": [NSString stringWithFormat:@"%lu hoverable rows", (unsigned long)rows.count]}];
  double gap = [cmd[@"gapMs"] doubleValue] ?: 60;
  __block double t0 = 0;
  __block NSInteger next = 0;
  __block NSView *over = nil;
  void (^send)(NSView *, NSEventType) = ^(NSView *v, NSEventType type) {
    NSPoint at = [v convertPoint:NSMakePoint(NSMidX(v.bounds), NSMidY(v.bounds)) toView:nil];
    NSEvent *e = [NSEvent enterExitEventWithType:type location:at modifierFlags:0 timestamp:NSProcessInfo.processInfo.systemUptime
                                    windowNumber:v.window.windowNumber context:nil eventNumber:0 trackingNumber:0 userData:NULL];
    if (type == NSEventTypeMouseEntered) [v mouseEntered:e]; else [v mouseExited:e];
  };
  _driverId = cid;
  _driverOp = @"hover";
  _step = ^(double ts, BOOL *done) {
    if (t0 == 0) t0 = ts;
    NSInteger due = (NSInteger)((ts - t0) / gap) + 1;
    while (next < due && next <= (NSInteger)rows.count) {
      if (over) send(over, NSEventTypeMouseExited), over = nil;
      if (next < (NSInteger)rows.count) send(over = rows[next], NSEventTypeMouseEntered);
      next++;
    }
    if (next > (NSInteger)rows.count && (ts - t0) > gap * (rows.count + 1)) *done = YES;
  };
}

- (void)handle:(NSDictionary *)cmd {
  NSString *cid = cmd[@"id"], *op = cmd[@"op"];
  if ([op isEqualToString:@"info"]) {
    return [self answer:cid with:@{@"ok": @YES, @"screen": self.screenName ?: @"", @"maxFPS": @(self.maxFPS), @"js": @(gJSObserved), @"link": @(self.link != nil)}];
  } else if ([op isEqualToString:@"counters"]) {
    return [self answer:cid with:@{@"ok": @YES, @"layoutPasses": @(gLayoutPasses), @"mountBatches": @(gMountBatches), @"uiBlocks": @(gUIBlocks),
                                   @"viewUpdates": @(gViewUpdates), @"viewCreates": @(gViewCreates), @"ticks": @(gTicks)}];
  } else if ([op isEqualToString:@"scroll"]) {
    return [self runScroll:cmd id:cid];
  } else if ([op isEqualToString:@"hover"]) {
    return [self runHover:cmd id:cid];
  }
  [self answer:cid with:@{@"ok": @NO, @"error": @"unknown op"}];
}

@end

__attribute__((constructor)) static void Start(void) {
  const char *dir = getenv("ASTRO_DATA_DIR");
  if (!dir || !getenv("AC_BENCH_FRAMES")) return;
  if (![NSBundle.mainBundle.bundlePath hasSuffix:@".app"] || [NSBundle.mainBundle.bundlePath containsString:@"Helper"]) return;
  gMainThread = mach_thread_self();
  gDir = [NSString stringWithUTF8String:dir];
  gOut = fopen([gDir stringByAppendingPathComponent:@"bench-frames.jsonl"].UTF8String, "a");
  if (!gOut) return;
  static dispatch_queue_t q;
  static dispatch_source_t timer;
  q = dispatch_queue_create("acframes.writer", DISPATCH_QUEUE_SERIAL);
  timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, q);
  dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, 0), 5 * NSEC_PER_MSEC, 1 * NSEC_PER_MSEC);
  __block int n = 0;
  __block NSData *last = nil;
  NSString *cmdPath = [gDir stringByAppendingPathComponent:@"bench-frames-cmd.json"];
  dispatch_source_set_event_handler(timer, ^{
    if (++n % 10 == 0) Flush();
    NSData *data = [NSData dataWithContentsOfFile:cmdPath];
    if (data.length && ![data isEqualToData:last]) {
      NSDictionary *cmd = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
      if (cmd) {
        last = data;
        dispatch_async(dispatch_get_main_queue(), ^{ [ACFramesProbe.shared handle:cmd]; });
      }
    }
  });
  dispatch_resume(timer);
  CFRunLoopTimerRef boot = CFRunLoopTimerCreateWithHandler(kCFAllocatorDefault, CFAbsoluteTimeGetCurrent() + 0.1, 0.1, 0, 0, ^(CFRunLoopTimerRef t) {
    [ACFramesProbe.shared boot];
    if ([ACFramesProbe.shared booted]) CFRunLoopTimerInvalidate(t);
  });
  CFRunLoopAddTimer(CFRunLoopGetMain(), boot, kCFRunLoopCommonModes);
}
