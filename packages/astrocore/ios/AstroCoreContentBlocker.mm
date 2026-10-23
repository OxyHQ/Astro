#import "AstroCoreServices.h"
#import "AstroCoreInternal.h"

#include <utility>

namespace {
NSString *ExtensionId() { return @"fajbdaomknpkicfjcpipdmcpoamdmilh"; }
NSString *const kLiteId = @"bnjeokpoejhioagiokhkhmdogkhbnbki";
NSString *const kBundledName = @"ublock";
NSString *const kLiteReaderName = @"ublock-lite-settings";
NSString *const kLiteMovedMarker = @"uBlock Origin Lite settings moved";
bool gFailNextMessage = false;
double gDelayNextLoadMs = 0;
}

@interface ACContentBlockerPage : NSObject <AstroCoreTabDelegate>
@property(readonly) AstroCoreTab *tab;
@property(readonly) NSString *origin;
@property(readonly) BOOL dead;
@end

@implementation ACContentBlockerPage {
  NSMutableArray<NSArray *> *_calls;
  void (^_inflight)(id value, NSString *error);
  BOOL _started;
  BOOL _loaded;
  BOOL _busy;
}

- (instancetype)initWithTab:(AstroCoreTab *)tab origin:(NSString *)origin {
  if ((self = [super init])) {
    _tab = tab;
    _origin = origin;
    _calls = [NSMutableArray array];
    _started = tab.loading;
    tab.delegate = self;
  }
  return self;
}

- (BOOL)onOwnPage {
  return !_dead && [_tab.url hasPrefix:_origin];
}

- (void)run:(NSString *)script completion:(void (^)(id value, NSString *error))completion {
  if (_dead) return completion(nil, @"closed");
  [_calls addObject:@[ script, [completion copy] ]];
  [self next];
}

- (void)leftOwnPage {
  [self fail:[@"not the extension page: " stringByAppendingString:_tab.url ?: @""]];
}

- (void)next {
  if (_dead || !_loaded || _busy || !_calls.count) return;
  if (!self.onOwnPage) return [self leftOwnPage];
  NSArray *call = _calls.firstObject;
  [_calls removeObjectAtIndex:0];
  _inflight = call[1];
  _busy = YES;
  [_tab evaluate:call[0]
      completion:^(NSString *json) {
        void (^completion)(id, NSString *) = self->_inflight;
        if (!completion) return;
        if (!self.onOwnPage) return [self leftOwnPage];
        self->_inflight = nil;
        self->_busy = NO;
        NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
        NSDictionary *answer = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        NSString *error = ![answer isKindOfClass:NSDictionary.class] ? @"no answer"
                          : [answer[@"error"] isKindOfClass:NSString.class] ? answer[@"error"]
                                                                              : nil;
        id value = error || answer[@"value"] == NSNull.null ? nil : answer[@"value"];
        completion(value, error);
        [self next];
      }];
}

- (void)fail:(NSString *)error {
  if (_dead) return;
  _dead = YES;
  NSArray<NSArray *> *calls = _calls;
  _calls = nil;
  void (^inflight)(id, NSString *) = _inflight;
  _inflight = nil;
  AstroCoreTab *tab = _tab;
  dispatch_async(dispatch_get_main_queue(), ^{
    [tab closeNow];
    if (inflight) inflight(nil, error);
    for (NSArray *call in calls) ((void (^)(id, NSString *))call[1])(nil, error);
  });
}

- (void)tabDidChangeLoading:(AstroCoreTab *)tab {
  _started = _started || tab.loading;
  _loaded = _started && !tab.loading;
  [self next];
}

- (void)tabDidChangeURL:(AstroCoreTab *)tab {
  if (tab.url.length && !self.onOwnPage) [self leftOwnPage];
}

- (void)tabDidCommitDocument:(AstroCoreTab *)tab {
  if (!self.onOwnPage) [self leftOwnPage];
}

- (void)tabWillClose:(AstroCoreTab *)tab {
  [self fail:@"closed"];
}

- (void)tab:(AstroCoreTab *)tab rendererGone:(NSString *)status code:(int)code {
  [self fail:[@"renderer " stringByAppendingString:status]];
}

- (void)tab:(AstroCoreTab *)tab didFailLoad:(NSString *)url code:(int)code description:(NSString *)text {
  if (code != -3) [self fail:text];
}

@end

@interface ACContentBlockerOp : NSObject
@property(copy) NSString *profile;
@property(copy) NSString *expression;
@property(copy) void (^completion)(id value, NSString *error);
@property int attemptsLeft;
@property BOOL failNext;
@property NSTimeInterval deadline;
@property NSUInteger attempt;
@end

@implementation ACContentBlockerOp
@end

namespace {

NSString *ScriptWith(NSString *format, NSArray *args) {
  NSMutableString *out = [NSMutableString string];
  NSArray<NSString *> *parts = [format componentsSeparatedByString:@"%@"];
  for (NSUInteger i = 0; i < parts.count; i++) {
    [out appendString:parts[i]];
    if (i < args.count) {
      NSData *json = [NSJSONSerialization dataWithJSONObject:args[i] options:NSJSONWritingFragmentsAllowed error:nil];
      [out appendString:json ? [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding] : @"null"];
    }
  }
  return out;
}

NSString *const kProfile = @"";

NSMutableOrderedSet<NSString *> *LoadedProfiles() {
  static NSMutableOrderedSet<NSString *> *profiles = [NSMutableOrderedSet orderedSet];
  return profiles;
}

NSMutableDictionary<NSString *, AstroCoreWindow *> *PageWindows() {
  static NSMutableDictionary *windows = [NSMutableDictionary dictionary];
  return windows;
}

NSMutableDictionary<NSString *, ACContentBlockerPage *> *Pages() {
  static NSMutableDictionary *pages = [NSMutableDictionary dictionary];
  return pages;
}

NSString *OriginOf(NSString *extensionId) { return [NSString stringWithFormat:@"chrome-extension://%@/", extensionId]; }

ACContentBlockerPage *HiddenPage(NSString *key, NSString *profile, AstroCoreProfile *p, NSString *extensionId, NSString *file) {
  ACContentBlockerPage *page = Pages()[key];
  if (page.tab.closed) [page fail:@"closed"];
  if (page && !page.dead) return page;
  AstroCoreWindow *window = PageWindows()[profile];
  if (!window) {
    PageWindows()[profile] = window = [[AstroCoreWindow alloc] initWithContentRect:NSMakeRect(0, 0, 400, 300)];
    if ([window respondsToSelector:@selector(setInternal:)]) window.internal = YES;
  }
  AstroCoreTab *tab = [window openTab:[OriginOf(extensionId) stringByAppendingString:file] profile:p foreground:YES];
  return Pages()[key] = tab ? [[ACContentBlockerPage alloc] initWithTab:tab origin:OriginOf(extensionId)] : nil;
}

ACContentBlockerPage *PageFor(NSString *profile, AstroCoreProfile *p) {
  return HiddenPage(profile, profile, p, ExtensionId(), @"blank.html");
}

NSString *BundledExtension() {
  NSString *bundled = [NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:[@"Extensions" stringByAppendingPathComponent:kBundledName]];
  return [NSFileManager.defaultManager fileExistsAtPath:[bundled stringByAppendingPathComponent:@"manifest.json"]] ? bundled : nil;
}

NSString *gExtensionPath;

void StartPreparing() {
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    gExtensionPath = BundledExtension();
    NSString *oldCopies = [[AstroCoreHost.dataDirectory stringByDeletingLastPathComponent] stringByAppendingPathComponent:@"Built-in Extensions"];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
      if ([NSFileManager.defaultManager fileExistsAtPath:oldCopies]) [NSFileManager.defaultManager removeItemAtPath:oldCopies error:nil];
    });
  });
}

NSString *ExtensionPath() {
  StartPreparing();
  return gExtensionPath;
}

void FollowDefault(NSArray<NSString *> *profiles, void (^done)(NSString *error));
void WhenDefaultSettled(void (^then)(void));

void LoadIntoProfile(NSString *profile, void (^then)(NSString *error)) {
  then = [then copy];
  StartPreparing();
  void (^load)(void) = ^{
    if ([LoadedProfiles() containsObject:profile]) return then(nil);
    astrocore_host::WithProfile(profile, ^(AstroCoreProfile *p) {
      if ([LoadedProfiles() containsObject:profile]) return then(nil);
      NSString *path = gExtensionPath;
      if (!p || !path || ![p respondsToSelector:@selector(loadComponentExtension:)]) return then(@"not loaded");
      NSString *loaded = [p loadComponentExtension:path];
      if (![loaded isEqualToString:ExtensionId()]) {
        NSLog(@"[blocker] component load failed (%@)", loaded);
        return then(@"not loaded");
      }
      [LoadedProfiles() addObject:profile];
      then(nil);
    });
  };
  if (NSThread.isMainThread) load();
  else dispatch_async(dispatch_get_main_queue(), load);
}

NSString *const kOffDirective = @"/^(?:astro-blocking-off|)/";

bool gDefaultSettled = false;
bool gLaunching = true;
constexpr double kSettleAfterLaunchSeconds = 1.5;

bool SettleWithoutPage() {
  const char *pagelessSettle = getenv("ASTRO_BLOCKER_PAGELESS_SETTLE");
  return !(pagelessSettle && !strcmp(pagelessSettle, "off"));
}

constexpr int kAttempts = 40;
constexpr double kRetryMs = 250;
constexpr double kOpSeconds = 20;

NSString *const kPrelude =
    @"let failing = %@;"
     "const offDirective = %@;"
     "const extensionOrigin = %@;"
     "const deadline = Date.now() + %@;"
     "const left = () => Math.max(0, deadline - Date.now());"
     "let expired = false;"
     "const withDeadline = (promise, what) => new Promise((resolve, reject) => {"
     "  const timer = setTimeout(() => { expired = true; reject(new Error(`${what}: timed out`)); }, left());"
     "  promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });"
     "});"
     "const ready = () => new Promise((resolve, reject) => {"
     "  const look = () => {"
     "    const ublock = chrome.extension.getBackgroundPage()?.µBlock;"
     "    if (ublock?.isReadyPromise) return ublock.isReadyPromise.then(resolve, reject);"
     "    if (left() === 0) return reject(new Error('uBlock Origin never started'));"
     "    setTimeout(look, 10);"
     "  };"
     "  look();"
     "});"
     "const loadScript = (src) => new Promise((resolve, reject) => {"
     "  const element = document.createElement('script');"
     "  element.src = src;"
     "  element.onload = resolve;"
     "  element.onerror = () => reject(new Error(`${src} didn't load`));"
     "  document.head.append(element);"
     "});"
     "const client = () => self.vAPI?.messaging ? Promise.resolve()"
     "  : ['js/vapi.js', 'js/vapi-common.js', 'js/vapi-client.js'].reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve());"
     "const send = (message) => {"
     "  if (expired) return Promise.reject(new Error(`${message.what}: timed out`));"
     "  if (failing) { failing = false; return Promise.reject(new Error(`${message.what}: failed (dev)`)); }"
     "  return client().then(() => {"
     "    if (expired) throw new Error(`${message.what}: timed out`);"
     "    return vAPI.messaging.send('dashboard', message);"
     "  }).then((reply) => {"
     "    if (reply === undefined) throw new Error(`${message.what}: no reply`);"
     "    return reply;"
     "  });"
     "};"
     "const trusted = () => send({what: 'getWhitelist'}).then((t) => {"
     "  if (!t || !Array.isArray(t.whitelist)) throw new Error('getWhitelist: no answer');"
     "  return t;"
     "});"
     "const lists = () => send({what: 'getLists'}).then((l) => {"
     "  if (!l || !l.available || typeof l.available !== 'object') throw new Error('getLists: no answer');"
     "  return l;"
     "});"
     "const selected = (l) => Object.keys(l.available).filter((k) => l.available[k] && l.available[k].off !== true);"
     "const covers = (directive, host) => !directive.includes('/') && (host === directive || host.endsWith('.' + directive));"
     "const sameSet = (a, b) => [...a].sort().join('\\n') === [...b].sort().join('\\n');"
     "const storageCall = (name, arg) => expired ? Promise.reject(new Error(`storage ${name}: timed out`))"
     "  : new Promise((resolve, reject) => chrome.storage.local[name](arg, (v) =>"
     "    chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(v || {})));"
     "const local = {get: (k) => storageCall('get', k), set: (v) => storageCall('set', v), remove: (k) => storageCall('remove', k)};"
     "const reloadLists = () => send({what: 'reloadAllFilters'}).then(() => local.remove('astroReloadPending'));"
     "const applyLists = (toSelect) => local.set({astroReloadPending: true})"
     "  .then(() => send({what: 'applyFilterListSelection', toSelect})).then(reloadLists);"
     "const settlePending = () => local.get('astroReloadPending').then((b) => b.astroReloadPending ? reloadLists() : null);"
     "Promise.resolve().then(() => { if (location.origin !== extensionOrigin) throw new Error(`not the extension page: ${location.href}`); })"
     ".then(() => withDeadline(ready(), 'uBlock Origin'))"
     ".then(() => withDeadline(settlePending().then(() => (%@)), 'the call'))"
     ".then((v) => post('result', JSON.stringify({value: v === undefined ? null : v})),"
     "(e) => post('result', JSON.stringify({error: String(e && e.message || e)})))";

NSMutableDictionary<NSString *, NSMutableArray<ACContentBlockerOp *> *> *Queues() {
  static NSMutableDictionary *queues = [NSMutableDictionary dictionary];
  return queues;
}

NSMutableSet<NSString *> *BusyProfiles() {
  static NSMutableSet *busy = [NSMutableSet set];
  return busy;
}

void Pump(NSString *profile);

constexpr double kPageIdleSeconds = 30;

NSMutableDictionary<NSString *, NSNumber *> *Uses() {
  static NSMutableDictionary *uses = [NSMutableDictionary dictionary];
  return uses;
}

void CloseWhenIdle(NSString *profile) {
  const NSUInteger use = Uses()[profile].unsignedIntegerValue + 1;
  Uses()[profile] = @(use);
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kPageIdleSeconds * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    if (Uses()[profile].unsignedIntegerValue != use || [BusyProfiles() containsObject:profile] || Queues()[profile].count) return;
    [Pages()[profile] fail:@"idle"];
    [Pages() removeObjectForKey:profile];
  });
}

void Finish(ACContentBlockerOp *op, id value, NSString *error) {
  NSMutableArray *queue = Queues()[op.profile];
  if (queue.firstObject == op) [queue removeObjectAtIndex:0];
  [BusyProfiles() removeObject:op.profile];
  if (error) NSLog(@"[blocker] profile \"%@\": %@", op.profile, error);
  op.completion(value, error);
  Pump(op.profile);
  if (!Queues()[op.profile].count) CloseWhenIdle(op.profile);
}

bool Retriable(NSString *error, ACContentBlockerPage *page) {
  if (!page.onOwnPage) return true;
  for (NSString *sign in @[ @"no reply", @"no answer", @"context invalidated", @"not the extension page", @"renderer ", @"closed" ])
    if ([error containsString:sign]) return true;
  return false;
}

void Attempt(ACContentBlockerOp *op) {
  NSString *profile = op.profile;
  if (!AstroCoreHost.isStarted) return Finish(op, nil, @"unavailable");
  if (![LoadedProfiles() containsObject:profile]) {
    return LoadIntoProfile(profile, ^(NSString *error) {
      if (error) Finish(op, nil, error);
      else Attempt(op);
    });
  }
  AstroCoreProfile *p = astrocore_host::LoadedProfile(profile);
  ACContentBlockerPage *page = p ? PageFor(profile, p) : nil;
  if (!page) return Finish(op, nil, @"not loaded");
  const double leftMs = MAX(0, (op.deadline - NSDate.timeIntervalSinceReferenceDate) * 1000);
  NSString *script = [NSString stringWithFormat:kPrelude, op.failNext ? @"true" : @"false", ScriptWith(@"%@", @[ kOffDirective ]),
                                                ScriptWith(@"%@", @[ [@"chrome-extension://" stringByAppendingString:ExtensionId()] ]), @((long long)leftMs), op.expression];
  const NSUInteger attempt = ++op.attempt;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)((leftMs + 2000) * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
    if (op.attempt == attempt && Queues()[profile].firstObject == op) [page fail:@"the call timed out"];
  });
  [page run:script
      completion:^(id value, NSString *error) {
        if (op.attempt != attempt) return;
        if ([error hasSuffix:@"failed (dev)"]) op.failNext = NO;
        if ([error containsString:@"timed out"]) [page fail:error];
        const bool inTime = NSDate.timeIntervalSinceReferenceDate < op.deadline;
        if (error && op.attemptsLeft > 0 && inTime && Retriable(error, page) && [LoadedProfiles() containsObject:profile] &&
            !astrocore_host::IsDeletedProfile(profile)) {
          op.attemptsLeft--;
          [page fail:@"uBlock Origin restarted"];
          dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kRetryMs * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
            Attempt(op);
          });
          return;
        }
        Finish(op, value, error);
      }];
}

void Pump(NSString *profile) {
  if ([BusyProfiles() containsObject:profile]) return;
  ACContentBlockerOp *op = Queues()[profile].firstObject;
  if (!op) return;
  [BusyProfiles() addObject:profile];
  Attempt(op);
}

void Call(NSString *profile, NSString *expression, void (^completion)(id value, NSString *error)) {
  ACContentBlockerOp *op = [ACContentBlockerOp new];
  op.profile = profile;
  op.expression = expression;
  op.completion = completion;
  op.attemptsLeft = kAttempts;
  op.deadline = NSDate.timeIntervalSinceReferenceDate + kOpSeconds;
  if (gFailNextMessage && ![expression isEqualToString:@"null"]) {
    op.failNext = YES;
    gFailNextMessage = false;
  }
  NSMutableArray *queue = Queues()[profile] ?: (Queues()[profile] = [NSMutableArray array]);
  [queue addObject:op];
  Pump(profile);
}

NSString *const kRead =
    @"Promise.all([lists(), trusted()]).then(([l, t]) => ({lists: selected(l).sort(), whitelist: [...t.whitelist].sort(), autoUpdate: l.autoUpdate !== false}))";

NSString *const kFollow =
    @"Promise.all([lists(), trusted()]).then(([l, t]) => {"
     "  const want = %@;"
     "  if (!Array.isArray(want.lists) || !Array.isArray(want.whitelist)) throw new Error('no settings to copy');"
     "  let written = Promise.resolve(null);"
     "  if (!sameSet(selected(l), want.lists))"
     "    written = written.then(() => applyLists(want.lists));"
     "  if (!sameSet(t.whitelist, want.whitelist))"
     "    written = written.then(() => send({what: 'setWhitelist', whitelist: want.whitelist.join('\\n')}));"
     "  if ((l.autoUpdate !== false) !== (want.autoUpdate !== false))"
     "    written = written.then(() => send({what: 'userSettings', name: 'autoUpdate', value: want.autoUpdate !== false}));"
     "  return written.then(() => null);"
     "})";

void ForgetGoneProfiles() {
  for (NSString *profile in LoadedProfiles().array) {
    if (astrocore_host::LoadedProfile(profile) && !astrocore_host::IsDeletedProfile(profile)) continue;
    [LoadedProfiles() removeObject:profile];
    [Pages()[profile] fail:@"profile gone"];
    [Pages() removeObjectForKey:profile];
  }
}

void FollowDefault(NSArray<NSString *> *profiles, void (^done)(NSString *error)) {
  done = [done copy];
  if (!gDefaultSettled && AstroCoreHost.isStarted) return WhenDefaultSettled(^{ FollowDefault(profiles, done); });
  if (!profiles) ForgetGoneProfiles();
  profiles = [(profiles ?: LoadedProfiles().array) filteredArrayUsingPredicate:[NSPredicate predicateWithFormat:@"length > 0"]];
  if (!profiles.count) return done(nil);
  Call(kProfile, kRead, ^(NSDictionary *settings, NSString *error) {
    if (error) return done(error);
    if (![settings isKindOfClass:NSDictionary.class]) return done(@"no settings to copy");
    dispatch_group_t group = dispatch_group_create();
    __block NSString *failed;
    for (NSString *profile in profiles) {
      dispatch_group_enter(group);
      Call(profile, ScriptWith(kFollow, @[ settings ]), ^(id, NSString *error) {
        const bool gone = !astrocore_host::LoadedProfile(profile) || astrocore_host::IsDeletedProfile(profile);
        if (!gone) failed = failed ?: error;
        dispatch_group_leave(group);
      });
    }
    dispatch_group_notify(group, dispatch_get_main_queue(), ^{ done(failed); });
  });
}

NSDictionary<NSString *, NSArray<NSString *> *> *LiteListMap() {
  return @{
    @"ublock-filters" : @[ @"ublock-filters", @"ublock-unbreak", @"ublock-quick-fixes" ],
    @"pgl" : @[ @"plowe-0" ],
    @"urlhaus-full" : @[ @"urlhaus-1" ],
    @"annoyances-ai" : @[ @"fanboy-ai-suggestions" ],
    @"annoyances-cookies" : @[ @"fanboy-cookiemonster", @"ublock-cookies-easylist" ],
    @"annoyances-overlays" : @[ @"easylist-newsletters", @"ublock-annoyances" ],
    @"annoyances-social" : @[ @"fanboy-social" ],
    @"annoyances-widgets" : @[ @"easylist-chat" ],
    @"annoyances-others" : @[ @"easylist-annoyances" ],
    @"annoyances-notifications" : @[ @"easylist-notifications" ],
  };
}

NSString *const kMoveLite =
    @"Promise.all([lists(), trusted()]).then(([l, t]) => {"
     "  const lite = %@;"
     "  const map = %@;"
     "  const none = Array.isArray(lite.filteringModeDetails?.none) ? lite.filteringModeDetails.none : [];"
     "  const off = none.includes('all-urls');"
     "  const hosts = none.filter((h) => typeof h === 'string' && h !== 'all-urls' && /^[a-z0-9.\\-_[\\]:]+$/.test(h));"
     "  const enabled = Array.isArray(lite.rulesetConfig?.enabledRulesets) ? lite.rulesetConfig.enabledRulesets : null;"
     "  const defaults = Array.isArray(lite.defaultRulesetIds) ? lite.defaultRulesetIds : [];"
     "  const keys = Object.keys(l.available);"
     "  const lookup = (id) => (map[id] || keys.filter((k) => k.toLowerCase() === String(id).toLowerCase())).filter((k) => l.available[k]);"
     "  const pick = new Set(selected(l));"
     "  if (enabled) {"
     "    for (const id of defaults) if (!enabled.includes(id)) for (const k of lookup(id)) pick.delete(k);"
     "    for (const id of enabled) if (!defaults.includes(id)) for (const k of lookup(id)) pick.add(k);"
     "  }"
     "  const whitelist = [...new Set(t.whitelist.filter((d) => d !== offDirective).concat(hosts, off ? [offDirective] : []))];"
     "  let written = Promise.resolve(null);"
     "  if (!sameSet(pick, selected(l)))"
     "    written = written.then(() => applyLists([...pick]));"
     "  if (!sameSet(whitelist, t.whitelist))"
     "    written = written.then(() => send({what: 'setWhitelist', whitelist: whitelist.join('\\n')}));"
     "  if (off) written = written.then(() => send({what: 'userSettings', name: 'autoUpdate', value: false}));"
     "  return written.then(() => ({off, hosts: hosts.length, lists: pick.size}));"
     "})";

NSString *LiteReaderPath() {
  NSString *path = [NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:[@"Extensions" stringByAppendingPathComponent:kLiteReaderName]];
  return [NSFileManager.defaultManager fileExistsAtPath:[path stringByAppendingPathComponent:@"manifest.json"]] ? path : nil;
}

NSString *LiteMarker(AstroCoreProfile *p) {
  return p.path.length ? [p.path stringByAppendingPathComponent:kLiteMovedMarker] : nil;
}

bool LiteSettingsPending(AstroCoreProfile *p) {
  NSString *marker = LiteMarker(p);
  if (!marker || [NSFileManager.defaultManager fileExistsAtPath:marker]) return false;
  NSString *store = [p.path stringByAppendingPathComponent:[@"Local Extension Settings" stringByAppendingPathComponent:kLiteId]];
  return [NSFileManager.defaultManager fileExistsAtPath:store];
}

void MarkLiteSettingsMoved(AstroCoreProfile *p, NSString *summary) {
  NSLog(@"[blocker] uBlock Origin Lite's settings: %@", summary);
  [summary writeToFile:LiteMarker(p) atomically:YES encoding:NSUTF8StringEncoding error:nil];
}

constexpr double kLiteReadSeconds = 10;

void ReadLiteSettings(NSString *profile, AstroCoreProfile *p, void (^done)(NSDictionary *lite, NSString *error)) {
  done = [done copy];
  NSString *reader = LiteReaderPath();
  if (!reader) return done(nil, @"the reader isn't in the app");
  if (![[p loadComponentExtension:reader] isEqualToString:kLiteId]) return done(nil, @"the reader didn't load");
  NSString *key = [@"lite:" stringByAppendingString:profile];
  ACContentBlockerPage *page = HiddenPage(key, profile, p, kLiteId, @"read.html");
  __block bool answered = false;
  void (^finish)(NSDictionary *, NSString *) = ^(NSDictionary *lite, NSString *error) {
    if (answered) return;
    answered = true;
    [page fail:@"read"];
    [Pages() removeObjectForKey:key];
    if ([p respondsToSelector:@selector(unloadComponentExtension:)]) [p unloadComponentExtension:kLiteId];
    done(lite, error);
  };
  if (!page) return finish(nil, @"no reader page");
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kLiteReadSeconds * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    finish(nil, @"the reader timed out");
  });
  [page run:@"chrome.storage.local.get(['filteringModeDetails', 'rulesetConfig', 'defaultRulesetIds'])"
             ".then((v) => post('result', JSON.stringify({value: v})), (e) => post('result', JSON.stringify({error: String(e && e.message || e)})))"
      completion:^(NSDictionary *lite, NSString *error) {
        finish([lite isKindOfClass:NSDictionary.class] ? lite : nil, error ?: ([lite isKindOfClass:NSDictionary.class] ? nil : @"unreadable"));
      }];
}

bool LiteSettingsUsable(NSDictionary *lite) {
  NSDictionary *modes = lite[@"filteringModeDetails"], *config = lite[@"rulesetConfig"];
  const bool modesOk = [modes isKindOfClass:NSDictionary.class] && (!modes[@"none"] || [modes[@"none"] isKindOfClass:NSArray.class]);
  const bool configOk = [config isKindOfClass:NSDictionary.class] && (!config[@"enabledRulesets"] || [config[@"enabledRulesets"] isKindOfClass:NSArray.class]);
  return modesOk || configOk;
}

void MoveLiteSettings(NSString *profile, AstroCoreProfile *p, void (^done)(void)) {
  done = [done copy];
  if (!LiteSettingsPending(p)) return done();
  ReadLiteSettings(profile, p, ^(NSDictionary *lite, NSString *error) {
    if (error) {
      NSLog(@"[blocker] uBlock Origin Lite's settings weren't read (%@); trying again next launch", error);
      return done();
    }
    if (!LiteSettingsUsable(lite)) {
      NSLog(@"[blocker] uBlock Origin Lite's settings aren't in a shape we know (%@); trying again next launch", lite.allKeys);
      return done();
    }
    Call(profile, ScriptWith(kMoveLite, @[ lite, LiteListMap() ]), ^(NSDictionary *result, NSString *moveError) {
      if (moveError) {
        NSLog(@"[blocker] uBlock Origin Lite's settings didn't move (%@); trying again next launch", moveError);
        return done();
      }
      MarkLiteSettingsMoved(p, [NSString stringWithFormat:@"moved (%@)", result]);
      done();
    });
  });
}

NSMutableArray<void (^)(void)> *SettledWaiters() {
  static NSMutableArray *waiters = [NSMutableArray array];
  return waiters;
}

void WhenDefaultSettled(void (^then)(void)) {
  if (gDefaultSettled) return then();
  [SettledWaiters() addObject:[then copy]];
}

void DefaultSettled() {
  gDefaultSettled = true;
  gLaunching = false;
  NSArray<void (^)(void)> *waiters = [SettledWaiters() copy];
  [SettledWaiters() removeAllObjects];
  for (void (^waiter)(void) in waiters) waiter();
}

constexpr int kInheritAttempts = 6;

void Inherit(NSString *profile, int attempt, void (^first)(NSString *error)) {
  first = [first copy];
  FollowDefault(@[ profile ], ^(NSString *error) {
    if (first) first(error);
    const bool gone = !astrocore_host::LoadedProfile(profile) || astrocore_host::IsDeletedProfile(profile) ||
                      ![LoadedProfiles() containsObject:profile];
    if (!error || gone || attempt + 1 >= kInheritAttempts) {
      if (error && !gone) NSLog(@"[blocker] profile \"%@\" didn't take the default profile's settings: %@", profile, error);
      return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)((1 << attempt) * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      Inherit(profile, attempt + 1, nil);
    });
  });
}

void LoadHeld(NSString *profile) {
  AstroCoreProfile *p = astrocore_host::LoadedProfile(profile);
  const bool isDefault = profile.length == 0;
  const bool firstLoad = p && ![LoadedProfiles() containsObject:profile];
  const bool hold = firstLoad && [p respondsToSelector:@selector(holdNavigationsUntilRulesetsOf:)] &&
                    (isDefault ? LiteSettingsPending(p) : !gLaunching);
  if (hold) [p holdNavigationsUntilRulesetsOf:ExtensionId()];
  void (^release)(NSString *) = ^(NSString *why) {
    if (!hold) return;
    if (!why && [p respondsToSelector:@selector(releaseNavigationHoldReady)]) [p releaseNavigationHoldReady];
    else [p releaseNavigationHold:why ?: @"uBlock Origin is ready"];
  };
  void (^load)(void) = ^{
    LoadIntoProfile(profile, ^(NSString *error) {
      if (error) {
        if (isDefault) DefaultSettled();
        return release([@"the content blocker didn't load: " stringByAppendingString:error]);
      }
      if (!isDefault) {
        return WhenDefaultSettled(^{
          Inherit(profile, 0, ^(NSString *followError) {
            release(followError ? [@"the default profile's settings didn't apply: " stringByAppendingString:followError] : nil);
          });
        });
      }
      void (^settle)(void) = ^{
        AstroCoreProfile *current = astrocore_host::LoadedProfile(profile);
        if (!hold && current && SettleWithoutPage() && !LiteSettingsPending(current)) return DefaultSettled();
        Call(profile, @"null", ^(id, NSString *readyError) {
          AstroCoreProfile *loaded = astrocore_host::LoadedProfile(profile);
          if (readyError || !loaded) {
            DefaultSettled();
            return release(readyError ? [@"uBlock Origin isn't ready: " stringByAppendingString:readyError] : nil);
          }
          MoveLiteSettings(profile, loaded, ^{
            DefaultSettled();
            release(nil);
          });
        });
      };
      if (hold || !gLaunching) return settle();
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kSettleAfterLaunchSeconds * NSEC_PER_SEC)), dispatch_get_main_queue(), settle);
    });
  };
  const double delay = std::exchange(gDelayNextLoadMs, 0);
  if (delay > 0) dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_MSEC)), dispatch_get_main_queue(), load);
  else load();
}

NSString *Category(NSString *listId, NSString *group) {
  if ([group isEqual:@"regions"]) return @"regional";
  if ([listId containsString:@"cookie"]) return @"cookies";
  if ([group isEqual:@"privacy"] || [listId isEqual:@"ublock-privacy"]) return @"trackers";
  if ([group isEqual:@"malware"] || [listId isEqual:@"ublock-badware"]) return @"security";
  if ([group isEqual:@"annoyances"] || [group isEqual:@"social"]) return @"annoyances";
  return @"ads";
}

double Count(id value) { return [value isKindOfClass:NSNumber.class] ? [value doubleValue] : 0; }

NSString *BundledVersion() {
  NSString *path = [ExtensionPath() stringByAppendingPathComponent:@"manifest.json"];
  NSData *data = path ? [NSData dataWithContentsOfFile:path] : nil;
  NSDictionary *manifest = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if (![manifest isKindOfClass:NSDictionary.class]) return @"";
  for (NSString *key in @[ @"version_name", @"version" ])
    if ([manifest[key] isKindOfClass:NSString.class]) return manifest[key];
  return @"";
}

NSString *const kState =
    @"Promise.all([lists(), trusted(), fetch('/assets/assets.json').then((r) => r.json())]).then(([l, t, assets]) => {"
     "  const langs = new Set([chrome.i18n.getUILanguage(), ...(navigator.languages || [])].map((x) => (/^[a-z]+/.exec(x) || [])[0]).filter(Boolean));"
     "  const forLanguages = (lang) => typeof lang === 'string' && lang.split(/\\s+/).some((x) => langs.has(x));"
     "  const onByDefault = (id) => !!assets[id] && (assets[id].off !== true || forLanguages(assets[id].lang));"
     "  return {"
     "    lists: Object.entries(l.available)"
     "      .filter(([id, list]) => list && list.content === 'filters' && list.group !== 'user' && list.group !== 'custom')"
     "      .map(([id, list]) => ({id, title: list.title || id, group: list.group || '', enabled: list.off !== true,"
     "        defaultOn: onByDefault(id), filters: list.entryCount || 0})),"
     "    networkFilters: l.netFilterCount || 0,"
     "    cosmeticFilters: l.cosmeticFilterCount || 0,"
     "    enabled: !t.whitelist.includes(offDirective),"
     "    allowedHosts: t.whitelist.filter((d) => !d.includes('/') && !d.startsWith('#') && !(t.whitelistDefault || []).includes(d)),"
     "  };"
     "})";

void State(void (^completion)(NSDictionary *state)) {
  completion = [completion copy];
  if (!gDefaultSettled && AstroCoreHost.isStarted) return WhenDefaultSettled(^{ State(completion); });
  Call(kProfile, kState, ^(NSDictionary *read, NSString *error) {
    if (![read isKindOfClass:NSDictionary.class] || ![read[@"lists"] isKindOfClass:NSArray.class]) {
      return completion(@{
        @"enabled" : @NO, @"lists" : @[], @"allowedHosts" : @[], @"version" : BundledVersion(),
        @"stats" : @{@"ready" : @NO, @"enabled" : @NO, @"parseMs" : @0, @"lookups" : @0, @"averageLookupMicros" : @0,
                     @"maxLookupMicros" : @0, @"error" : error ?: @"unavailable"},
      });
    }
    NSMutableArray *lists = [NSMutableArray array];
    for (NSDictionary *l in read[@"lists"]) {
      if (![l isKindOfClass:NSDictionary.class] || ![l[@"id"] isKindOfClass:NSString.class]) continue;
      [lists addObject:@{
        @"id" : l[@"id"],
        @"title" : [l[@"title"] isKindOfClass:NSString.class] ? l[@"title"] : l[@"id"],
        @"category" : Category(l[@"id"], [l[@"group"] isKindOfClass:NSString.class] ? l[@"group"] : @""),
        @"enabled" : @([l[@"enabled"] boolValue]),
        @"defaultOn" : @([l[@"defaultOn"] boolValue]),
        @"filters" : @(Count(l[@"filters"])),
      }];
    }
    NSMutableArray *allowed = [NSMutableArray array];
    for (NSString *host in [read[@"allowedHosts"] isKindOfClass:NSArray.class] ? read[@"allowedHosts"] : @[])
      if ([host isKindOfClass:NSString.class]) [allowed addObject:host];
    const BOOL on = [read[@"enabled"] boolValue];
    completion(@{
      @"enabled" : @(on),
      @"version" : BundledVersion(),
      @"lists" : lists,
      @"allowedHosts" : allowed,
      @"stats" : @{
        @"ready" : @YES, @"enabled" : @(on), @"networkFilters" : @(Count(read[@"networkFilters"])),
        @"cosmeticFilters" : @(Count(read[@"cosmeticFilters"])), @"parseMs" : @0, @"lookups" : @0,
        @"averageLookupMicros" : @0, @"maxLookupMicros" : @0,
      },
    });
  });
}

void Changed(NSString *error, void (^completion)(NSString *error)) {
  if (error) return completion(error);
  completion = [completion copy];
  FollowDefault(nil, ^(NSString *followError) {
    State(^(NSDictionary *state) { if (AstroCoreHost.eventHandler) AstroCoreHost.eventHandler(@"contentBlocker", state[@"stats"]); });
    completion(followError);
  });
}

}

namespace astrocore_host {
void PrepareContentBlocker() {
  StartPreparing();
}

void LoadContentBlocker(NSString *profile) {
  if (!IsIncognito(profile)) LoadHeld(profile ?: @"");
}
}

@implementation AstroCoreContentBlocker

+ (void)state:(void (^)(NSDictionary<NSString *, id> *))completion {
  State(completion);
}

+ (void)setEnabled:(BOOL)enabled completion:(void (^)(NSString *))completion {
  NSString *script = @"trusted().then((t) => {"
                      "  const on = %@;"
                      "  const kept = t.whitelist.filter((d) => d !== offDirective);"
                      "  return send({what: 'setWhitelist', whitelist: (on ? kept : kept.concat([offDirective])).join('\\n')});"
                      "}).then(() => send({what: 'userSettings', name: 'autoUpdate', value: %@}))";
  Call(kProfile, ScriptWith(script, @[ @(enabled), @(enabled) ]), ^(id, NSString *error) {
    Changed(error, completion);
  });
}

+ (void)setList:(NSString *)listId enabled:(BOOL)enabled completion:(void (^)(NSString *))completion {
  NSString *script = @"lists().then((l) => {"
                      "  const [id, on] = [%@, %@];"
                      "  if (!l.available[id]) throw new Error(`no list ${id}`);"
                      "  const keep = selected(l).filter((x) => x !== id);"
                      "  return applyLists(on ? keep.concat([id]) : keep);"
                      "})";
  Call(kProfile, ScriptWith(script, @[ listId, @(enabled) ]), ^(id, NSString *error) {
    Changed(error, completion);
  });
}

+ (void)isAllowedOnHost:(NSString *)host completion:(void (^)(BOOL))completion {
  NSString *script = @"trusted().then((t) => t.whitelist.some((d) => covers(d, %@)))";
  Call(kProfile, ScriptWith(script, @[ host.lowercaseString ]), ^(id allowed, NSString *error) {
    completion(!error && [allowed isKindOfClass:NSNumber.class] && [allowed boolValue]);
  });
}

+ (void)setAllowed:(BOOL)allowed onHost:(NSString *)host completion:(void (^)(NSString *))completion {
  NSString *script = @"trusted().then((t) => {"
                      "  const [allowed, host] = [%@, %@];"
                      "  const kept = t.whitelist.filter((d) => allowed ? d !== host : !covers(d, host));"
                      "  return send({what: 'setWhitelist', whitelist: (allowed ? kept.concat([host]) : kept).join('\\n')});"
                      "})";
  Call(kProfile, ScriptWith(script, @[ @(allowed), host.lowercaseString ]), ^(id, NSString *error) {
    Changed(error, completion);
  });
}

+ (void)devFailNextMessage {
  gFailNextMessage = true;
}

+ (void)devDelayNextLoad:(double)ms {
  gDelayNextLoadMs = ms;
}

@end
