#ifndef ASTRO_CORE_AC_TAB_INFO_H_
#define ASTRO_CORE_AC_TAB_INFO_H_

#import <Foundation/Foundation.h>

#include <string>

class GURL;

namespace content {
class WebContents;
}

namespace astrocore {

NSDictionary* SecurityInfoFor(content::WebContents* contents);

NSString* OriginOf(const GURL& url);

}

#endif
