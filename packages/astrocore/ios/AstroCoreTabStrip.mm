#import "AstroCoreTabStrip.h"

#import "AstroCoreInternal.h"
#import "AstroCoreWebView.h"
#import "AstroCoreEngineBridge.h"
#import "AstroCoreServices.h"

namespace {

void (^gHandler)(NSDictionary *);
int64_t gRev = 0;

NSMapTable<AstroCoreWindowController *, NSMutableDictionary<NSNumber *, NSString *> *> *KnownStrips() {
  static NSMapTable *known = [NSMapTable weakToStrongObjectsMapTable];
  return known;
}

void Remember(AstroCoreWindowController *controller, int strip, NSString *profile) {
  if (strip < 0) return;
  NSMutableDictionary *strips = [KnownStrips() objectForKey:controller];
  if (!strips) {
    strips = [NSMutableDictionary dictionary];
    [KnownStrips() setObject:strips forKey:controller];
  }
  strips[@(strip)] = profile;
}
NSNumber *gCommand;
__weak AstroCoreWindowController *gCommandWindow;
__weak AstroCoreProfile *gCommandProfile;

NSMutableDictionary<NSNumber *, NSDictionary *> *Sent() {
  static NSMutableDictionary *sent = [NSMutableDictionary dictionary];
  return sent;
}

void Send(NSDictionary *tx) {
  for (NSDictionary *strip in tx[@"strips"]) {
    if ([strip[@"closed"] boolValue]) [Sent() removeObjectForKey:strip[@"strip"]];
    else Sent()[strip[@"strip"]] = strip;
  }
  gHandler(tx);
}

NSMutableDictionary<NSNumber *, NSDictionary *> *Groups() {
  static NSMutableDictionary *groups = [NSMutableDictionary dictionary];
  return groups;
}

bool ReportsGroups() {
  static bool reports = [AstroCoreEngineBridge exports:@"ac_tabs_watch"];
  return reports;
}

NSMapTable<AstroCoreTab *, NSNumber *> *Pinned() {
  static NSMapTable *pinned = [NSMapTable weakToStrongObjectsMapTable];
  return pinned;
}

NSMapTable<AstroCoreProfile *, AstroCoreTab *> *ActiveTabs(AstroCoreWindowController *controller) {
  static NSMapTable *byWindow = [NSMapTable weakToStrongObjectsMapTable];
  NSMapTable *active = [byWindow objectForKey:controller];
  if (!active) {
    active = [NSMapTable weakToWeakObjectsMapTable];
    [byWindow setObject:active forKey:controller];
  }
  return active;
}

NSString *AppWindowOf(AstroCoreWindowController *controller) {
  NSMutableArray<NSView *> *views = [NSMutableArray array];
  if (controller.root) [views addObject:controller.root];
  for (NSUInteger i = 0; i < views.count && i < 16; i++) {
    NSView *view = views[i];
    if ([view respondsToSelector:NSSelectorFromString(@"appProperties")]) {
      id properties = [view valueForKey:@"appProperties"];
      id windowId = [properties isKindOfClass:NSDictionary.class] ? properties[@"windowId"] : nil;
      if ([windowId isKindOfClass:NSString.class]) return windowId;
    }
    [views addObjectsFromArray:view.subviews];
  }
  return nil;
}

NSDictionary *Strip(AstroCoreWindowController *controller, AstroCoreProfile *profile) {
  AstroCoreWindow *window = controller.coreWindow;
  NSMutableArray *tabs = [NSMutableArray array];
  NSArray<AstroCoreTab *> *live = [window tabsForProfile:profile];
  AstroCoreTab *active = [ActiveTabs(controller) objectForKey:profile];
  for (NSUInteger i = 0; i < live.count; i++) {
    AstroCoreTab *tab = live[i];
    NSString *key = [AstroCoreTabs viewForTab:tab].transferKey;
    [tabs addObject:@{
      @"key" : key.length ? key : NSNull.null,
      @"browser" : @(astrocore_host::BrowserId(tab)),
      @"index" : @(i),
      @"active" : @(tab == active || (!active && i == 0)),
      @"pinned" : @([[Pinned() objectForKey:tab] boolValue]),
    }];
    if (ReportsGroups()) {
      NSMutableDictionary *last = [tabs.lastObject mutableCopy];
      id group = Groups()[@([window chromeWindowIdForProfile:profile])][@"tabs"][@(tab.tabId)];
      last[@"group"] = group ?: NSNull.null;
      tabs[tabs.count - 1] = last;
    }
  }
  const int strip = [window chromeWindowIdForProfile:profile];
  NSString *name = astrocore_host::ProfileName(profile);
  Remember(controller, strip, name);
  NSMutableDictionary *state = [@{
    @"strip" : @(strip),
    @"window" : @(window.window.windowNumber),
    @"profile" : name,
    @"tabs" : tabs,
  } mutableCopy];
  if (ReportsGroups()) {
    state[@"groups"] = Groups()[@(strip)][@"groups"] ?: @[];
    if ([Groups()[@(strip)][@"activePickedOnClose"] boolValue]) state[@"activePickedOnClose"] = @YES;
  }
  if (NSString *appWindow = AppWindowOf(controller)) state[@"appWindow"] = appWindow;
  return state;
}

NSArray<AstroCoreProfile *> *ProfilesWithTabs(AstroCoreWindowController *controller) {
  NSMutableArray *profiles = [NSMutableArray array];
  for (AstroCoreProfile *profile in astrocore_host::LoadedProfiles())
    if ([controller.coreWindow chromeWindowIdForProfile:profile] >= 0) [profiles addObject:profile];
  return profiles;
}

}

@implementation AstroCoreTabStrip

+ (void)setHandler:(void (^)(NSDictionary<NSString *, id> *))handler {
  gHandler = [handler copy];
  static bool watching = false;
  if (watching || !ReportsGroups()) return;
  watching = true;
  [AstroCoreEngineBridge observe:@"tabs.strip"
                      handler:^(NSDictionary *strip) {
                        NSNumber *window = [strip[@"window"] isKindOfClass:NSNumber.class] ? strip[@"window"] : nil;
                        if (!window) return;
                        if ([strip[@"closed"] boolValue]) return (void)[Groups() removeObjectForKey:window];
                        NSMutableDictionary *byTab = [NSMutableDictionary dictionary];
                        for (NSDictionary *tab in strip[@"tabs"])
                          if ([tab isKindOfClass:NSDictionary.class] && tab[@"tab"]) byTab[tab[@"tab"]] = tab[@"group"] ?: NSNull.null;
                        NSDictionary *before = Groups()[window];
                        NSDictionary *now = @{
                          @"groups" : strip[@"groups"] ?: @[],
                          @"tabs" : byTab,
                          @"activePickedOnClose" : @([strip[@"activePickedOnClose"] boolValue]),
                        };
                        Groups()[window] = now;
                        if ([before isEqualToDictionary:now] || gCommand) return;
                        for (AstroCoreWindowController *c in AstroCoreWindowController.all)
                          for (AstroCoreProfile *p in astrocore_host::LoadedProfiles())
                            if ([c.coreWindow chromeWindowIdForProfile:p] == window.intValue)
                              [AstroCoreTabStrip changedInWindow:c profile:p cause:c.hostChanges > 0 ? @(-1) : NSNull.null];
                      }];
  [AstroCoreServices call:@"ac_tabs_watch" profile:@"" args:nil completion:^(NSDictionary *) {}];
}

+ (void)changedInWindow:(AstroCoreWindowController *)controller profile:(AstroCoreProfile *)profile {
  [self changedInWindow:controller profile:profile cause:nil];
}

+ (void)changedInWindow:(AstroCoreWindowController *)controller profile:(AstroCoreProfile *)profile cause:(id)cause {
  if (!gHandler || !controller || !profile || controller.standalone) return;
  if (gCommand && controller == gCommandWindow && profile == gCommandProfile) return;
  cause = cause ?: (gCommand ?: (controller.hostChanges > 0 ? @(-1) : NSNull.null));
  NSDictionary *strip = Strip(controller, profile);
  if ((cause == NSNull.null || [cause isEqual:@(-1)]) && [Sent()[strip[@"strip"]] isEqualToDictionary:strip]) return;
  Send(@{@"rev" : @(++gRev), @"cmd" : cause, @"strips" : @[ strip ]});
}

+ (void)windowClosed:(AstroCoreWindowController *)controller {
  NSDictionary<NSNumber *, NSString *> *strips = [KnownStrips() objectForKey:controller];
  [KnownStrips() removeObjectForKey:controller];
  if (!gHandler || !strips.count) return;
  NSMutableArray *closed = [NSMutableArray array];
  const NSInteger window = controller.coreWindow.window.windowNumber;
  for (NSNumber *strip in strips)
    [closed addObject:@{@"strip" : strip, @"window" : @(window), @"profile" : strips[strip], @"tabs" : @[], @"closed" : @YES}];
  Send(@{@"rev" : @(++gRev), @"cmd" : NSNull.null, @"strips" : closed});
}

+ (void)activated:(AstroCoreTab *)tab inWindow:(AstroCoreWindowController *)controller {
  AstroCoreProfile *profile = tab.profile;
  if (profile) [ActiveTabs(controller) setObject:tab forKey:profile];
}

+ (AstroCoreTab *)activeTabInWindow:(AstroCoreWindowController *)controller profile:(AstroCoreProfile *)profile {
  return profile ? [ActiveTabs(controller) objectForKey:profile] : nil;
}

+ (void)removed:(AstroCoreTab *)tab fromWindow:(AstroCoreWindowController *)controller {
  AstroCoreProfile *profile = tab.profile;
  if (profile && [ActiveTabs(controller) objectForKey:profile] == tab) [ActiveTabs(controller) removeObjectForKey:profile];
}

+ (void)setPinned:(BOOL)pinned tab:(AstroCoreTab *)tab {
  [Pinned() setObject:@(pinned) forKey:tab];
}

+ (NSDictionary<NSString *, id> *)allStrips {
  NSMutableArray *strips = [NSMutableArray array];
  for (AstroCoreWindowController *controller in AstroCoreWindowController.all)
    if (!controller.standalone)
      for (AstroCoreProfile *profile in ProfilesWithTabs(controller)) [strips addObject:Strip(controller, profile)];
  for (NSDictionary *strip in strips) Sent()[strip[@"strip"]] = strip;
  return @{@"rev" : @(gRev), @"cmd" : NSNull.null, @"strips" : strips};
}

+ (void)command:(NSInteger)commandId command:(NSDictionary<NSString *, id> *)command {
  NSString *op = command[@"op"];
  const int stripId = [command[@"strip"] intValue];
  AstroCoreWindowController *found = nil;
  AstroCoreProfile *profile = nil;
  for (AstroCoreWindowController *controller in AstroCoreWindowController.all)
    for (AstroCoreProfile *p in ProfilesWithTabs(controller))
      if ([controller.coreWindow chromeWindowIdForProfile:p] == stripId) found = controller, profile = p;
  NSMutableDictionary<NSString *, AstroCoreTab *> *byKey = [NSMutableDictionary dictionary];
  for (AstroCoreTab *tab in found ? [found.coreWindow tabsForProfile:profile] : @[]) {
    NSString *key = [AstroCoreTabs viewForTab:tab].transferKey;
    if (key.length) byKey[key] = tab;
  }
  BOOL rejected = !found;
  gCommand = @(commandId);
  gCommandWindow = found;
  gCommandProfile = profile;
  if (found && [op isEqualToString:@"activate"]) {
    AstroCoreTab *tab = byKey[command[@"key"]];
    if (tab) {
      [found.coreWindow activateTab:tab];
    } else {
      rejected = YES;
    }
  } else if (found && [op isEqualToString:@"arrange"]) {
    NSArray<NSString *> *keys = [command[@"keys"] isKindOfClass:NSArray.class] ? command[@"keys"] : @[];
    const NSInteger pinned = [command[@"pinned"] integerValue];
    int index = 0;
    rejected = keys.count > 0;
    for (NSString *key in keys)
      if (byKey[key]) rejected = NO;
    for (NSUInteger i = 0; i < keys.count; i++) {
      AstroCoreTab *tab = byKey[keys[i]];
      if (!tab) continue;
      [self setPinned:(NSInteger)i < pinned tab:tab];
      if ([found.coreWindow respondsToSelector:@selector(placeTab:index:pinned:)])
        [found.coreWindow placeTab:tab index:index pinned:(NSInteger)i < pinned];
      index++;
    }
  }
  if (found && [op isEqualToString:@"group"]) {
    NSMutableArray *ids = [NSMutableArray array];
    for (NSString *key in [command[@"keys"] isKindOfClass:NSArray.class] ? command[@"keys"] : @[])
      if (AstroCoreTab *tab = byKey[key]) [ids addObject:@(tab.tabId)];
    if (!ids.count) rejected = YES;
    else {
      NSMutableDictionary *args = [@{@"window" : @(stripId), @"tabs" : ids} mutableCopy];
      id group = command[@"group"];
      args[@"group"] = [group isKindOfClass:NSString.class] ? group : @"";
      for (NSString *key in @[ @"title", @"color" ])
        if ([command[key] isKindOfClass:NSString.class]) args[key] = command[key];
      if ([command[@"collapsed"] isKindOfClass:NSNumber.class]) args[@"collapsed"] = command[@"collapsed"];
      gCommand = nil;
      AstroCoreWindowController *controller = found;
      AstroCoreProfile *p = profile;
      [AstroCoreServices call:@"ac_tabs_group" profile:astrocore_host::ProfileName(profile) args:args completion:^(NSDictionary *result) {
        NSMutableDictionary *tx = [@{@"rev" : @(++gRev), @"cmd" : @(commandId), @"strips" : @[ Strip(controller, p) ]} mutableCopy];
        if (result[@"error"]) tx[@"rejected"] = @YES;
        if (gHandler) Send(tx);
      }];
      return;
    }
  }
  gCommand = nil;
  NSMutableDictionary *tx = [@{@"rev" : @(++gRev), @"cmd" : @(commandId), @"strips" : found ? @[ Strip(found, profile) ] : @[]} mutableCopy];
  if (rejected) tx[@"rejected"] = @YES;
  if (gHandler) Send(tx);
}

@end
