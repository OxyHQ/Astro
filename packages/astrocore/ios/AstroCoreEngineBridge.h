#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AstroCoreEngineBridge : NSObject
+ (void)call:(NSString *)name
       profile:(NSString *)profile
          args:(nullable NSString *)args
    completion:(void (^)(NSString *json))completion NS_SWIFT_NAME(call(_:profile:args:completion:));
+ (void)callWithSecret:(NSString *)name
               profile:(NSString *)profile
                  args:(NSMutableData *)args
            completion:(void (^)(NSString *json))completion NS_SWIFT_NAME(callWithSecret(_:profile:args:completion:));
+ (void)setEventHandler:(nullable void (^)(NSString *topic, NSString *json))handler;
+ (void)forwardTopics:(NSArray<NSString *> *)topics;
+ (void)observe:(NSString *)topic handler:(void (^)(NSDictionary<NSString *, id> *payload))handler;
+ (BOOL)exports:(NSString *)name;
@end

NS_ASSUME_NONNULL_END
