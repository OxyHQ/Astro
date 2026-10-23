#import <AppKit/AppKit.h>

#define ASTROCORE_EXPORT __attribute__((visibility("default")))

NS_ASSUME_NONNULL_BEGIN

@class AstroCoreEngine;
@class AstroCoreProfile;
@class AstroCoreTab;
@class AstroCoreWindow;

@protocol AstroCoreEngineDelegate <NSObject>
- (void)engineDidStart;
@optional
- (void)engineWillShutDown;
- (void)engineQuitCancelled;
- (nullable AstroCoreWindow*)engineWindowForNewBrowserOfProfile:(AstroCoreProfile*)profile
                                                        type:(NSString*)type;
- (void)engine:(AstroCoreEngine*)engine
    permissionRequest:(NSDictionary<NSString*, id>*)request
                  tab:(AstroCoreTab*)tab;
- (void)engine:(AstroCoreEngine*)engine permissionRequestDismissed:(NSString*)requestId;
- (void)engine:(AstroCoreEngine*)engine
    extensionSidePanel:(NSDictionary<NSString*, id>*)panel
                   tab:(AstroCoreTab*)tab;
- (BOOL)engine:(AstroCoreEngine*)engine
    extensionActionPopup:(NSDictionary<NSString*, id>*)popup
                     tab:(AstroCoreTab*)tab;
- (BOOL)engine:(AstroCoreEngine*)engine
    extensionActionShortcut:(NSDictionary<NSString*, id>*)shortcut
                        tab:(AstroCoreTab*)tab;
- (BOOL)engineIsReservedKeyEvent:(NSEvent*)event;
- (BOOL)engineIsReservedKey:(NSString*)key
               unshiftedKey:(NSString*)unshiftedKey
                  modifiers:(NSEventModifierFlags)modifiers;
- (void)engine:(AstroCoreEngine*)engine
    extensionInstallPrompt:(NSDictionary<NSString*, id>*)prompt
                       tab:(nullable AstroCoreTab*)tab;
- (void)engine:(AstroCoreEngine*)engine
    deviceChooser:(NSDictionary<NSString*, id>*)chooser
              tab:(AstroCoreTab*)tab;
- (void)engine:(AstroCoreEngine*)engine
    castDialog:(NSDictionary<NSString*, id>*)dialog
           tab:(AstroCoreTab*)tab;
- (void)engine:(AstroCoreEngine*)engine
    castRoutes:(NSArray<NSDictionary<NSString*, NSString*>*>*)routes
       profile:(AstroCoreProfile*)profile;
@end

ASTROCORE_EXPORT
@interface AstroCoreEngine : NSObject
+ (int)runWithArgc:(int)argc
              argv:(const char* _Nonnull* _Nonnull)argv
          delegate:(id<AstroCoreEngineDelegate>)delegate;
@property(class, readonly, nullable) AstroCoreEngine* sharedEngine;

@property(readonly) AstroCoreProfile* defaultProfile;
- (void)loadProfile:(NSString*)directoryName
         completion:(void (^)(AstroCoreProfile* _Nullable profile))completion;
- (void)quit;
@property(nonatomic, copy, nullable) NSString* pageScript;
- (void)resolvePermission:(NSString*)requestId
                   result:(NSString*)result
                 remember:(BOOL)remember;
+ (void)resolveExtensionInstallPrompt:(NSString*)requestId accepted:(BOOL)accepted;
+ (void)startCasting:(int)dialogId sink:(NSString*)sinkId mode:(int)castMode;
+ (void)stopCasting:(int)dialogId route:(NSString*)routeId;
+ (void)closeCastDialog:(int)dialogId;
+ (void)terminateCastRoute:(NSString*)routeId;
+ (void)setAutoPictureInPicture:(BOOL)enabled;
+ (void)setVideoUpscaling:(BOOL)enabled;
+ (void)setVideoUpscalingTestConditions:(NSDictionary<NSString*, NSNumber*>*)conditions;
@property(class, readonly) NSDictionary<NSString*, id>* videoUpscalingState;
+ (void)reservedShortcutsChanged;
+ (BOOL)isReservedGlobalShortcut:(NSString*)shortcut;
+ (void)selectDevice:(int)chooserId index:(int)index;
+ (void)cancelDeviceChooser:(int)chooserId;
+ (void)refreshDeviceChooser:(int)chooserId;
+ (void)openDeviceChooserSettings:(int)chooserId;
+ (void)beginTracing:(void (^)(BOOL started))completion;
+ (void)endTracing:(BOOL)keep completion:(void (^)(NSString* _Nullable path))completion;
@property(class, readonly) BOOL isTracing;
- (void)deleteProfile:(AstroCoreProfile*)profile
           completion:(nullable void (^)(BOOL deleted))completion;
- (void)releaseProfile:(AstroCoreProfile*)profile;
+ (void)resolveExternalApp:(NSString*)requestId open:(BOOL)open remember:(BOOL)remember;
@property(class, readonly) NSArray<NSDictionary*>* testExternalLaunches;
@property(class, readonly) NSArray<NSDictionary*>* testChooserEvents;
+ (void)allowDesktopCapture:(NSString*)sourceId
                        tab:(AstroCoreTab*)tab
                      frame:(nullable NSString*)frameId
                     origin:(nullable NSString*)origin;
- (void)offTheRecordProfileFor:(AstroCoreProfile*)profile
                    completion:(void (^)(AstroCoreProfile* _Nullable offTheRecord,
                                         NSString* _Nullable error))completion;
@property(readonly) NSString* chromiumVersion;
@property(readonly) NSString* keepAliveState;
@end

ASTROCORE_EXPORT
@interface AstroCoreProfile : NSObject
@property(readonly) NSString* name;
@property(readonly) NSString* path;
@property(readonly) BOOL offTheRecord;
@property(readonly) BOOL destroyed;
- (nullable NSString*)loadComponentExtension:(NSString*)path;
- (void)unloadComponentExtension:(NSString*)extensionId;
- (void)warmSpareRenderer;
- (void)holdNavigationsUntilRulesetsOf:(NSString*)extensionId;
- (void)releaseNavigationHold:(NSString*)reason;
- (void)releaseNavigationHoldReady;
- (void)watchCastRoutes;
@property(readonly) NSArray<NSDictionary<NSString*, id>*>* extensions;
- (nullable NSNumber*)boolPreference:(NSString*)name;
- (void)setBoolPreference:(NSString*)name value:(BOOL)value;
- (void)clearBrowsingData:(NSArray<NSString*>*)types
                    since:(nullable NSDate*)since
               completion:(nullable void (^)(void))completion;
@end

@interface AstroCoreProfile (Icons)
- (void)fetchIcon:(NSString*)url
         maxBytes:(NSUInteger)maxBytes
       completion:(void (^)(NSData* _Nullable body))completion;
@end

@protocol AstroCoreWindowDelegate <NSObject>
@optional
- (void)window:(AstroCoreWindow*)window
    didInsertTab:(AstroCoreTab*)tab
          opener:(nullable AstroCoreTab*)opener
     disposition:(NSString*)disposition;
- (void)window:(AstroCoreWindow*)window didRemoveTab:(AstroCoreTab*)tab;
- (void)window:(AstroCoreWindow*)window didActivateTab:(AstroCoreTab*)tab;
- (void)window:(AstroCoreWindow*)window
    devToolsDidChangeForTab:(AstroCoreTab*)tab
                       view:(nullable NSView*)devToolsView;
- (void)window:(AstroCoreWindow*)window
                    tab:(AstroCoreTab*)tab
    didChangeFullscreen:(BOOL)fullscreen;
- (void)window:(AstroCoreWindow*)window
    passwordPrompt:(NSDictionary<NSString*, id>*)prompt
            forTab:(AstroCoreTab*)tab;
- (void)window:(AstroCoreWindow*)window
    autofillPrompt:(NSDictionary<NSString*, id>*)prompt
            forTab:(AstroCoreTab*)tab;
- (void)window:(AstroCoreWindow*)window
    passwordSavePromptForTab:(AstroCoreTab*)tab
                    username:(NSString*)username
                      origin:(NSString*)origin;
- (void)window:(AstroCoreWindow*)window showRequestedActive:(BOOL)active;
- (BOOL)windowShouldClose:(AstroCoreWindow*)window;
- (void)windowDidCancelClose:(AstroCoreWindow*)window;
- (void)window:(AstroCoreWindow*)window
    confirmCloseWithDownloads:(int)count
                   completion:(void (^)(BOOL closeAnyway))completion;
- (BOOL)window:(AstroCoreWindow*)window preHandleKeyEvent:(NSEvent*)event;
- (BOOL)window:(AstroCoreWindow*)window handleKeyEvent:(NSEvent*)event;
@end

ASTROCORE_EXPORT
@interface AstroCoreWindow : NSObject
- (instancetype)initWithContentRect:(NSRect)rect;
@property(readonly) NSWindow* window;
@property(readonly) NSView* hostView;
@property(weak, nullable) id<AstroCoreWindowDelegate> delegate;

- (AstroCoreTab*)openTab:(NSString*)url
              profile:(AstroCoreProfile*)profile
           foreground:(BOOL)foreground;
- (nullable AstroCoreTab*)openExtensionView:(NSString*)url
                                 profile:(AstroCoreProfile*)profile
                                    kind:(NSString*)kind;
@property(nonatomic, nullable) AstroCoreProfile* activeProfile;
- (void)activateTab:(AstroCoreTab*)tab;
- (NSArray<AstroCoreTab*>*)tabsForProfile:(AstroCoreProfile*)profile;
- (int)chromeWindowIdForProfile:(AstroCoreProfile*)profile;
- (BOOL)executeChromeCommand:(int)commandId profile:(AstroCoreProfile*)profile;
- (void)showInactive;
@property(nonatomic) BOOL actedFullScreen;
- (void)close;

- (void)prepareProfile:(AstroCoreProfile*)profile;
- (void)adoptTab:(AstroCoreTab*)tab;
- (nullable AstroCoreTab*)restoreTab:(nullable NSString*)state
                          profile:(AstroCoreProfile*)profile
                       foreground:(BOOL)foreground;
- (nullable AstroCoreTab*)duplicateTab:(AstroCoreTab*)source
                            profile:(AstroCoreProfile*)profile
                         foreground:(BOOL)foreground;
- (void)placeTab:(AstroCoreTab*)tab index:(int)index pinned:(BOOL)pinned;
@property(nonatomic) BOOL internal;
@end

@protocol AstroCoreTabDelegate <NSObject>
@optional
- (void)tabDidChangeTitle:(AstroCoreTab*)tab;
- (void)tabDidChangeURL:(AstroCoreTab*)tab;
- (void)tabDidChangeLoading:(AstroCoreTab*)tab;
- (void)tabDidChangeProgress:(AstroCoreTab*)tab;
- (void)tabDidChangeFavicon:(AstroCoreTab*)tab;
- (void)tabDidChangeNavigationState:(AstroCoreTab*)tab;
- (void)tab:(AstroCoreTab*)tab didFindMatches:(int)count active:(int)active final:(BOOL)final;
- (void)tab:(AstroCoreTab*)tab didReceivePageMessage:(NSString*)kind json:(NSString*)json;
- (void)tab:(AstroCoreTab*)tab
    didReceivePageMessage:(NSString*)kind
                     json:(NSString*)json
                    frame:(NSString*)frameId
                     main:(BOOL)main;
- (void)tabWillClose:(AstroCoreTab*)tab;
- (void)tab:(AstroCoreTab*)tab rendererGone:(NSString*)status code:(int)code;
- (void)tab:(AstroCoreTab*)tab didFailLoad:(NSString*)url code:(int)code description:(NSString*)text;
- (void)tab:(AstroCoreTab*)tab didChangeStatusText:(NSString*)text;
- (void)tab:(AstroCoreTab*)tab didRequestAppURL:(NSString*)url userGesture:(BOOL)userGesture;
- (void)tabDidChangeThemeColor:(AstroCoreTab*)tab;
- (void)tabDidCommitDocument:(AstroCoreTab*)tab;
- (void)tabDidGainFocus:(AstroCoreTab*)tab;
- (void)tabDidChangeAudio:(AstroCoreTab*)tab;
- (void)tabDidChangeSecurity:(AstroCoreTab*)tab;
- (void)tabDidChangeZoom:(AstroCoreTab*)tab;
- (void)tab:(AstroCoreTab*)tab didBlockPopup:(NSDictionary<NSString*, NSString*>*)popup;
- (void)tab:(AstroCoreTab*)tab preferredSizeDidChange:(NSSize)size;
- (void)tab:(AstroCoreTab*)tab externalAppRequest:(NSDictionary<NSString*, id>*)request;
- (void)tab:(AstroCoreTab*)tab requestsActivation:(NSString*)reason;
- (void)tab:(AstroCoreTab*)tab didChangePictureInPicture:(NSDictionary<NSString*, id>*)state;
- (void)tab:(AstroCoreTab*)tab didShowAutofillSuggestions:(NSArray<NSDictionary<NSString*, NSString*>*>*)items;
- (void)tab:(AstroCoreTab*)tab didBlockRequests:(int)count lastURL:(NSString*)url;
- (NSArray<NSDictionary<NSString*, NSString*>*>*)tab:(AstroCoreTab*)tab
                         contextMenuItemsForSelection:(NSString*)text;
- (void)tab:(AstroCoreTab*)tab
    contextMenuCommand:(NSString*)itemId
                  text:(NSString*)selection
             modifiers:(NSDictionary<NSString*, NSNumber*>*)modifiers;
- (void)tab:(AstroCoreTab*)tab didShowContextMenu:(NSArray<NSDictionary*>*)items;
- (nullable NSDictionary<NSString*, id>*)tab:(AstroCoreTab*)tab
                              runContextMenu:(NSDictionary<NSString*, id>*)menu;
- (void)tab:(AstroCoreTab*)tab navigationBecameDownload:(NSString*)url;
- (void)tabDidChangeDiscarded:(AstroCoreTab*)tab;
- (void)tabBecameUnresponsive:(AstroCoreTab*)tab;
- (void)tabBecameResponsive:(AstroCoreTab*)tab;
- (void)tab:(AstroCoreTab*)tab didChangeMediaAccess:(NSDictionary<NSString*, NSNumber*>*)access;
@end

ASTROCORE_EXPORT
@interface AstroCoreTab : NSObject
@property(readonly) NSView* view;
@property(readonly, weak) AstroCoreProfile* profile;
@property(readonly) int tabId;
@property(readonly) NSString* url;
@property(readonly) NSString* title;
@property(readonly) BOOL loading;
@property(readonly) double progress;
@property(readonly, nullable) NSImage* favicon;
@property(readonly) BOOL canGoBack;
@property(readonly) BOOL canGoForward;
@property(readonly) BOOL closed;
@property(weak, nullable) id<AstroCoreTabDelegate> delegate;

- (void)loadURL:(NSString*)url;
- (void)focus;
- (void)find:(NSString*)text forward:(BOOL)forward;
- (void)stopFinding;
- (void)goBack;
- (void)goForward;
- (void)reload;
- (void)stop;
- (void)close;
- (void)showDevTools;
- (void)closeDevTools;
@property(readonly, nullable) NSView* devToolsView;
- (void)devToolsLayoutForSize:(NSSize)size
                     devTools:(NSRect*)devToolsFrame
                         page:(NSRect*)pageFrame;
@property(readonly, nullable) NSDictionary<NSString*, id>* passwordPrompt;
- (void)resolvePasswordPrompt:(NSString*)action
                     username:(nullable NSString*)username
                     password:(nullable NSString*)password;
@property(readonly, nullable) NSDictionary<NSString*, id>* autofillPrompt;
- (void)resolveAutofillPrompt:(NSInteger)promptId action:(NSString*)action;

@property(readonly, nullable) NSString* faviconURL;
@property(readonly, nullable) NSString* themeColor;
@property(readonly) BOOL audible;
@property(nonatomic) BOOL muted;
@property(readonly) int browserId;
@property(readonly, nullable) NSString* committedOrigin;
+ (nullable NSString*)originForURL:(NSString*)url;
@property(readonly) BOOL initialDocumentAccessed;
@property(readonly) BOOL committedInitial;
- (nullable id)suppressInput;
- (void)loadURL:(NSString*)url userInitiated:(BOOL)userInitiated;
- (void)goToOffset:(int)offset;
- (void)reloadIgnoringCache;
- (void)closeNow;
@property(readonly) NSArray<NSDictionary<NSString*, id>*>* navigationEntries;
- (void)executeJavaScript:(NSString*)code;
- (void)executeJavaScript:(NSString*)code userGesture:(BOOL)userGesture;
- (void)executeJavaScript:(NSString*)code frame:(NSString*)frameId;
- (void)evaluate:(NSString*)code completion:(void (^)(NSString* _Nullable json))completion;
- (void)evaluate:(NSString*)code
     userGesture:(BOOL)userGesture
      completion:(void (^)(NSString* _Nullable json))completion;
- (void)callPage:(NSString*)kind json:(NSString*)json;

@property(readonly) NSDictionary<NSString*, id>* securityInfo;
@property(nonatomic) double zoomFactor;
- (void)zoomStep:(int)direction;
@property(readonly) double pinchScale;
- (BOOL)executeChromeCommand:(int)command;
- (void)openBlockedPopup:(NSString*)popupId always:(BOOL)always;
- (BOOL)discard;
@property(readonly) BOOL discarded;
@property(nonatomic) BOOL frozen;
- (void)resolveUnresponsive:(BOOL)terminate;
@property(nonatomic, nullable) NSColor* pageBackgroundColor;
@property(nonatomic, copy, nullable) NSString* pageColor;
@property(nonatomic, nullable) NSColor* contentsBackgroundColor;
- (NSString*)executeExtensionAction:(NSString*)extensionId;
- (NSDictionary<NSString*, NSDictionary*>*)actionStatesForExtensions:(NSArray<NSString*>*)extensionIds;
- (nullable NSString*)sidePanelURLForExtension:(NSString*)extensionId;
@property(readonly, nullable) NSString* mediaCaptureSourceId;
- (void)copyPicture:(NSTimeInterval)timeout completion:(void (^)(CGImageRef _Nullable picture))completion;
- (BOOL)stopCapture;
@property(readonly) BOOL autoPictureInPictureIsChromes;
- (void)noteShownByHost:(BOOL)shown;
- (void)exitFullscreen;
- (void)exitExclusiveAccess;
- (void)tracePictureInPicture:(NSString*)line withInputs:(BOOL)withInputs;
- (void)devToolsCall:(NSString*)method
              params:(nullable NSDictionary*)params
          completion:(void (^)(NSDictionary* _Nullable result,
                               NSString* _Nullable error))completion;
- (void)devToolsCall:(NSString*)method
              params:(nullable NSDictionary*)params
             timeout:(NSTimeInterval)timeout
          completion:(void (^)(NSDictionary* _Nullable result,
                               NSString* _Nullable error))completion;
- (BOOL)canShareThisTabInsteadFor:(AstroCoreTab*)capturer;
- (BOOL)shareThisTabInsteadFor:(AstroCoreTab*)capturer;
- (BOOL)showAutofillSuggestions:(BOOL)passwords;
- (BOOL)showCastDialog;
- (BOOL)devShowBluetoothChooser:(BOOL)unauthorized;
@property(readonly, nullable) NSDictionary<NSString*, NSNumber*>* popupFeatures;
@property(readonly) NSSize preferredSize;
- (void)callFrame:(NSString*)frameId kind:(NSString*)kind json:(NSString*)json;
@end

NS_ASSUME_NONNULL_END
