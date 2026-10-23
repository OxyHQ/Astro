#ifndef ASTRO_CORE_ASTROCORE_INTERNAL_H_
#define ASTRO_CORE_ASTROCORE_INTERNAL_H_

#import "astro/core/public/AstroCore.h"

class Profile;

namespace content {
class WebContents;
}

namespace astrocore {
class WindowHost;

void NoteProfileDying(Profile* profile);
bool IsProfileDying(const Profile* profile);
void NoteProfileDeleting(Profile* profile);
bool IsProfileDeleting(const Profile* profile);
}

@interface AstroCoreProfile ()
+ (AstroCoreProfile*)wrapperFor:(Profile*)profile;
@property(readonly) Profile* chromeProfile;
@end

@interface AstroCoreTab ()
- (instancetype)initWithContents:(content::WebContents*)contents;
@property(readonly) content::WebContents* contents;
- (void)contentsDestroyed;
- (void)notify:(SEL)selector;
@end

@interface AstroCoreWindow ()
@property(readonly) astrocore::WindowHost* host;
@end

#endif
