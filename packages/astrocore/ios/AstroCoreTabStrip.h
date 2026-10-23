#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AstroCoreTabStrip : NSObject
+ (void)setHandler:(nullable void (^)(NSDictionary<NSString *, id> *transaction))handler;
@property(class, readonly) NSDictionary<NSString *, id> *allStrips;
+ (void)command:(NSInteger)commandId command:(NSDictionary<NSString *, id> *)command NS_SWIFT_NAME(command(_:command:));
@end

NS_ASSUME_NONNULL_END
