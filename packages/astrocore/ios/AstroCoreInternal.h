#import <AppKit/AppKit.h>

#import "AstroCore.h"
#import "AstroCoreHost.h"
#import "AstroCoreTabStrip.h"

@class AstroCoreWebView;

NS_ASSUME_NONNULL_BEGIN

namespace astrocore_host {

AstroCoreProfile *_Nullable LoadedProfile(NSString *name);
bool IsDeletedProfile(NSString *name);
void WithProfile(NSString *name, void (^completion)(AstroCoreProfile *_Nullable profile));
NSString *ProfileName(AstroCoreProfile *_Nullable profile);
AstroCoreProfile *_Nullable PersonalIfLoaded(AstroCoreEngine *engine);
bool IsIncognito(NSString *name);
NSString *OriginalProfileName(NSString *_Nullable name);
NSString *OriginalProfileNameOf(AstroCoreProfile *_Nullable profile);
bool IsOffTheRecordOf(AstroCoreProfile *_Nullable profile, NSString *_Nullable name);
NSArray<NSString *> *LoadedProfileNames();

int BrowserId(AstroCoreTab *tab);
AstroCoreTab *_Nullable TabWithBrowserId(int browserId);

NSString *AppDisposition(NSString *chromeDisposition);

void InstallActivationGuardsEarly();
void InstallActivationGuardsLate();
bool Background();
void LogActivation(NSString *what);
void SetAppActive(bool active);
void ActToggleFullScreen(NSWindow *window);
void InstallTestCrashGuard(NSString *_Nullable dataDir);

void OpenPopupWindow(AstroCoreTab *tab, AstroCoreWebView *_Nullable opener);
bool IsReservedKeyEvent(NSEvent *event);
bool IsReservedBinding(NSString *key, NSString *unshiftedKey, NSEventModifierFlags modifiers);
NSUInteger PopupWindowCount();

}

@interface AstroCoreWindowController : NSObject <AstroCoreWindowDelegate>
+ (nullable AstroCoreWindowController *)forNSWindow:(nullable NSWindow *)window;
+ (NSArray<AstroCoreWindowController *> *)all;
@property(nonatomic, readonly) AstroCoreWindow *coreWindow;
@property(nonatomic, strong, nullable) NSView *root;
@property(nonatomic) NSInteger hostChanges;
@property(nonatomic, copy, nullable) NSString *appWindowId;
+ (AstroCoreWindowController *)strayWindowForProfile:(AstroCoreProfile *)profile;
+ (nullable AstroCoreWindowController *)chromeMadeWindowForProfile:(AstroCoreProfile *)profile;
@property(nonatomic, readonly) BOOL stray;
+ (AstroCoreWindowController *)standaloneWindowForProfile:(AstroCoreProfile *)profile;
@property(nonatomic, readonly) BOOL standalone;
- (void)noteClosing:(AstroCoreTab *)tab;
+ (nullable AstroCoreWindowController *)holding:(AstroCoreTab *)tab;
+ (nullable AstroCoreWebView *)hostingViewForProfile:(nullable AstroCoreProfile *)profile;
+ (BOOL)userSees:(nullable NSWindow *)window;
@end
extern NSNotificationName const AstroCoreWindowSeenDidChange;

@interface AstroCoreTabStrip (Engine)
+ (void)changedInWindow:(AstroCoreWindowController *)controller profile:(AstroCoreProfile *)profile;
+ (void)changedInWindow:(AstroCoreWindowController *)controller profile:(AstroCoreProfile *)profile cause:(nullable id)cause;
+ (void)windowClosed:(AstroCoreWindowController *)controller;
+ (void)activated:(AstroCoreTab *)tab inWindow:(AstroCoreWindowController *)controller;
+ (nullable AstroCoreTab *)activeTabInWindow:(AstroCoreWindowController *)controller profile:(AstroCoreProfile *)profile;
+ (void)removed:(AstroCoreTab *)tab fromWindow:(AstroCoreWindowController *)controller;
+ (void)setPinned:(BOOL)pinned tab:(AstroCoreTab *)tab;
@end

@interface AstroCoreProfile (Pending)
- (nullable NSString *)loadComponentExtension:(NSString *)path;
- (void)releaseNavigationHoldReady;
- (void)unloadComponentExtension:(NSString *)extensionId;
@end

namespace astrocore_host {
NSArray<AstroCoreProfile *> *LoadedProfiles();
void LoadContentBlocker(NSString *profile);
void PrepareContentBlocker();
bool EngineHasTabModel();
}

@interface AstroCoreTabs : NSObject
+ (void)setView:(nullable AstroCoreWebView *)view forTab:(AstroCoreTab *)tab;
+ (nullable AstroCoreWebView *)viewForTab:(AstroCoreTab *)tab;
+ (NSString *)offerTab:(AstroCoreTab *)tab;
+ (NSString *)offerTab:(AstroCoreTab *)tab prefix:(NSString *)prefix;
+ (nullable AstroCoreTab *)takeOffered:(NSString *)adoptId;
+ (nullable AstroCoreTab *)offeredTab:(NSString *)adoptId;
+ (void)forget:(AstroCoreTab *)tab;
@end

@interface AstroCoreFavicons (Tabs)
+ (void)noteImage:(nullable NSImage *)image forURL:(nullable NSString *)url profile:(nullable NSString *)profile;
@end

NS_ASSUME_NONNULL_END
