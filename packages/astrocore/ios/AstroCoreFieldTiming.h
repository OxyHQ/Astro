#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#ifdef __cplusplus
extern "C" {
#endif

BOOL ACFieldTimingEnabled(void);
double ACFieldNow(void);
void ACFieldMark(NSString *_Nullable key, NSString *kind, double at);
void ACFieldMarkNow(NSString *_Nullable key, NSString *kind);
void ACFieldMarkAtCommit(NSString *_Nullable key, NSString *kind);
void AstroCoreWebViewsSetFieldTiming(BOOL on);

#ifdef __cplusplus
}
#endif

@interface ACFieldTiming : NSObject

+ (void)setEnabled:(BOOL)enabled owner:(id)owner NS_SWIFT_NAME(setEnabled(_:owner:));
+ (void)releaseOwner:(id)owner NS_SWIFT_NAME(releaseOwner(_:));
+ (void)markFrame:(NSString *)key kind:(NSString *)kind NS_SWIFT_NAME(markFrame(_:kind:));
+ (NSArray<NSNumber *> *)lastInput;
+ (NSArray<NSArray *> *)drain;

@end

NS_ASSUME_NONNULL_END
