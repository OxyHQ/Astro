#import "AstroCoreEngineBridge.h"

#import "AstroCoreInternal.h"

#import <dlfcn.h>
#include <stdlib.h>

#include "../../../engine/chromium/src/chrome/browser/astro/public/ac_engine.h"

namespace {

void (^gEventHandler)(NSString *, NSString *);
NSSet<NSString *> *gForwardedTopics;
NSMutableArray<NSArray *> *gPendingForwards;

void *Symbol(const char *name) {
  return dlsym(RTLD_DEFAULT, name);
}

NSString *JSON(id value) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"{}";
}

void Replied(void *context, const char *json) {
  void (^completion)(NSString *) = (__bridge_transfer void (^)(NSString *))context;
  completion(json ? @(json) : JSON(@{@"error" : @"bad reply from the engine"}));
}

NSString *RealPath(NSString *path) {
  char resolved[PATH_MAX];
  return realpath(path.fileSystemRepresentation, resolved) ? @(resolved) : path;
}

NSString *ProfileNamed(NSString *dir) {
  NSString *real = RealPath(dir);
  for (AstroCoreProfile *profile in astrocore_host::LoadedProfiles())
    if (!([profile respondsToSelector:@selector(offTheRecord)] && profile.offTheRecord) && [RealPath(profile.path) isEqualToString:real]) return astrocore_host::ProfileName(profile);
  NSString *name = real.lastPathComponent;
  return [name hasPrefix:@"Profile "] ? [name substringFromIndex:8] : @"";
}

int EngineABI() {
  static int abi = [] {
    auto version = (ac_engine_abi_version_t)Symbol("ac_engine_abi_version");
    return version ? version() : 0;
  }();
  return abi;
}

NSMutableDictionary<NSString *, NSMutableArray *> *Observers() {
  static NSMutableDictionary *observers = [NSMutableDictionary dictionary];
  return observers;
}

bool ForwardsEveryEngineEvent() {
  static const bool every = [] {
    const char *value = getenv("ASTRO_ENGINE_EVENT_FORWARD");
    return value && !strcmp(value, "all");
  }();
  return every;
}

bool Forwarded(NSString *topic) {
  return gEventHandler && (ForwardsEveryEngineEvent() || !gForwardedTopics || [gForwardedTopics containsObject:topic]);
}

void FlushForwards() {
  NSArray<NSArray *> *events = gPendingForwards;
  gPendingForwards = nil;
  for (NSArray *event in events)
    if (gEventHandler) gEventHandler(event[0], JSON(event[1]));
}

void Forward(NSString *topic, NSDictionary *payload) {
  if (ForwardsEveryEngineEvent()) return gEventHandler(topic, JSON(payload));
  NSArray *event = @[ topic, [payload copy] ];
  if (gPendingForwards) {
    if (![gPendingForwards.lastObject isEqualToArray:event]) [gPendingForwards addObject:event];
    return;
  }
  gPendingForwards = [NSMutableArray arrayWithObject:event];
  dispatch_async(dispatch_get_main_queue(), ^{
    FlushForwards();
  });
}

void Dispatch(void *, const char *topic, const char *json) {
  if (!topic) return;
  NSString *name = @(topic);
  NSArray *observers = [Observers()[name] copy];
  bool forwarded = Forwarded(name);
  if (!observers.count && !forwarded) return;
  NSData *data = [@(json ?: "{}") dataUsingEncoding:NSUTF8StringEncoding];
  NSMutableDictionary *payload = [[NSJSONSerialization JSONObjectWithData:data options:0 error:nil] mutableCopy] ?: [NSMutableDictionary dictionary];
  if ([payload[@"profile"] isKindOfClass:NSString.class]) payload[@"profile"] = ProfileNamed(payload[@"profile"]);
  for (void (^observer)(NSDictionary *) in observers) observer(payload);
  if (forwarded) Forward(name, payload);
}

void InstallSink() {
  static bool installed = false;
  if (installed) return;
  auto sink = (ac_engine_set_event_sink_t)Symbol("ac_engine_set_event_sink");
  if (!sink) return;
  installed = true;
  sink(Dispatch, nullptr);
}

}

@implementation AstroCoreEngineBridge

+ (void)call:(NSString *)name profile:(NSString *)profile args:(NSString *)args completion:(void (^)(NSString *))completion {
  auto call = (ac_engine_call_t)Symbol(name.UTF8String);
  if (!call) return completion(JSON(@{@"error" : [NSString stringWithFormat:@"the engine has no %@", name]}));
  if (astrocore_host::IsIncognito(profile)) {
    static NSSet<NSString *> *session = [NSSet setWithArray:@[
      @"ac_site_settings_get", @"ac_site_settings_origins", @"ac_site_settings_set", @"ac_site_settings_reset",
      @"ac_site_data_clear", @"ac_zoom_list", @"ac_zoom_set"
    ]];
    static NSSet<NSString *> *changes = [NSSet setWithArray:@[
      @"ac_site_settings_set", @"ac_site_settings_reset", @"ac_site_data_clear", @"ac_zoom_set", @"ac_external_apps_remove",
      @"ac_browsing_data_clear"
    ]];
    if ([session containsObject:name] && EngineABI() >= 2) {
      NSData *bytes = [(args.length ? args : @"{}") dataUsingEncoding:NSUTF8StringEncoding];
      NSMutableDictionary *parsed = [[NSJSONSerialization JSONObjectWithData:bytes options:0 error:nil] mutableCopy];
      if (![parsed isKindOfClass:NSMutableDictionary.class]) return completion(JSON(@{@"error" : @"bad arguments"}));
      parsed[@"offTheRecord"] = @YES;
      args = JSON(parsed);
    } else if ([changes containsObject:name]) {
      return completion(JSON(@{@"error" : @"private profile"}));
    }
  }
  NSString *data = astrocore_host::OriginalProfileName(profile);
  void (^done)(NSString *) = [completion copy];
  NSString *argsCopy = [args copy];
  astrocore_host::WithProfile(data, ^(AstroCoreProfile *p) {
    if (!p || !AstroCoreHost.isStarted) return done(JSON(@{@"error" : @"profile not loaded"}));
    call(p.path.UTF8String, argsCopy.UTF8String, Replied, (__bridge_retained void *)done);
  });
}

+ (void)callWithSecret:(NSString *)name profile:(NSString *)profile args:(NSMutableData *)args completion:(void (^)(NSString *))completion {
  NSMutableData *secret = args;
  void (^wipe)(void) = ^{
    volatile unsigned char *bytes = (volatile unsigned char *)secret.mutableBytes;
    for (NSUInteger i = 0; i < secret.length; i++) bytes[i] = 0;
  };
  auto call = (ac_engine_call_t)Symbol(name.UTF8String);
  const char *bytes = (const char *)secret.bytes;
  if (!call || astrocore_host::IsIncognito(profile) || !secret.length || bytes[secret.length - 1] != 0) {
    wipe();
    return completion(JSON(@{@"error" : !call ? [NSString stringWithFormat:@"the engine has no %@", name]
                                     : astrocore_host::IsIncognito(profile) ? @"private profile" : @"bad arguments"}));
  }
  void (^done)(NSString *) = [completion copy];
  astrocore_host::WithProfile(profile ?: @"", ^(AstroCoreProfile *p) {
    if (!p || !AstroCoreHost.isStarted || ([p respondsToSelector:@selector(offTheRecord)] && p.offTheRecord)) {
      wipe();
      return done(JSON(@{@"error" : @"profile not loaded"}));
    }
    call(p.path.UTF8String, (const char *)secret.mutableBytes, Replied, (__bridge_retained void *)done);
    wipe();
  });
}

+ (void)setEventHandler:(void (^)(NSString *, NSString *))handler {
  gEventHandler = [handler copy];
  InstallSink();
}

+ (void)forwardTopics:(NSArray<NSString *> *)topics {
  gForwardedTopics = [NSSet setWithArray:topics];
}

+ (void)observe:(NSString *)topic handler:(void (^)(NSDictionary<NSString *, id> *))handler {
  if (!Observers()[topic]) Observers()[topic] = [NSMutableArray array];
  [Observers()[topic] addObject:[handler copy]];
  InstallSink();
}

+ (BOOL)exports:(NSString *)name {
  return Symbol(name.UTF8String) != nullptr;
}

@end
