#import "AstroCoreInternal.h"
#import "AstroCoreWebView.h"

NS_ASSUME_NONNULL_BEGIN

@interface AstroCoreWebView ()
- (void)openedTab:(AstroCoreTab *)tab adoptId:(NSString *)adoptId disposition:(NSString *)disposition;
- (void)tabRemovedFromWindow:(AstroCoreWindow *)window;
- (void)tabActivatedByChrome:(BOOL)chromes;
- (void)requestFocusRestore;
- (void)requestFocusRestoreIn:(NSWindow *)window;
- (void)devToolsChanged:(nullable NSView *)devToolsView;
- (void)emit:(NSString *)name payload:(NSDictionary<NSString *, id> *)payload;
- (void)exitPictureInPictureInFrame:(nullable NSString *)frameId;
+ (void)keepTransfersOfWindow:(NSWindow *)window;
@property(class, nonatomic, readonly, nullable) AstroCoreTab *launchTab;
@property(class, nonatomic, readonly, nullable) AstroCoreTab *firstLinkTab;
+ (nullable NSString *)linkMarkForTab:(AstroCoreTab *)tab;
+ (void)dismissLinkTab:(AstroCoreTab *)tab;
@end

NS_ASSUME_NONNULL_END
