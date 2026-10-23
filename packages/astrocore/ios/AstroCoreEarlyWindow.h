#import <AppKit/AppKit.h>

@class AstroCoreTab;

NS_ASSUME_NONNULL_BEGIN

@interface AstroCoreEarlyWindow : NSObject
@property(class, nonatomic, readonly) BOOL switchedOff;
+ (void)setDataDirectory:(nullable NSString *)directory;
+ (void)noteLayoutChangeIn:(nullable NSWindow *)window;
+ (void)recordNow;
+ (void)prefetchForSession:(NSDictionary *)session;
+ (void)discardPrefetch;
+ (BOOL)canShowWindow:(NSString *)windowId session:(NSDictionary *)session;
+ (BOOL)showWindow:(NSString *)windowId
             frame:(NSArray<NSNumber *> *)frame
               key:(NSString *)key
           profile:(NSString *)profile
          backdrop:(NSDictionary *)backdrop;
+ (void)attachPage:(AstroCoreTab *)tab key:(NSString *)key;
+ (BOOL)showLittleWindowForLink:(AstroCoreTab *)tab
                           mark:(NSString *)mark
                            url:(NSString *)url
                          frame:(NSArray<NSNumber *> *)frame
                        profile:(NSString *)profile
                       backdrop:(NSDictionary *)backdrop
                           like:(nullable NSString *)windowId;
+ (nullable NSWindow *)claimLittleWindowForLink:(NSString *)mark profile:(nullable NSString *)profile;
+ (void)forgetPictures;
+ (void)forgetPicturesNow;
+ (BOOL)holdsPage:(AstroCoreTab *)tab;
+ (nullable NSWindow *)claimForAppWindow:(nullable NSString *)windowId profile:(nullable NSString *)profile;
+ (BOOL)takeDismissed:(nullable NSString *)windowId;
+ (nullable NSView *)coverInWindow:(nullable NSWindow *)window;
+ (void)rootEmbedded:(NSView *)root inWindow:(NSWindow *)window;
+ (void)pageMoved:(AstroCoreTab *)tab;
+ (void)pageNavigated:(nullable AstroCoreTab *)tab launchURL:(nullable NSString *)launchURL;
+ (BOOL)veils:(nullable AstroCoreTab *)tab;
+ (void)requestFocus:(nullable AstroCoreTab *)tab;
+ (void)page:(nullable AstroCoreTab *)tab shownURL:(nullable NSString *)url;
+ (void)pageCommitted:(nullable AstroCoreTab *)tab shownURL:(nullable NSString *)url;
+ (void)page:(nullable AstroCoreTab *)tab emitted:(nullable NSString *)url;
+ (void)dropPage:(nullable AstroCoreTab *)tab;
@end

NS_ASSUME_NONNULL_END
