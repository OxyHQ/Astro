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

NS_ASSUME_NONNULL_END
