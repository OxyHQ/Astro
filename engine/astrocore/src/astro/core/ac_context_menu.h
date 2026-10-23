#ifndef ASTRO_CORE_AC_CONTEXT_MENU_H_
#define ASTRO_CORE_AC_CONTEXT_MENU_H_

#include <memory>

namespace content {
class WebContents;
class WebContentsViewDelegate;
}

namespace astrocore {

std::unique_ptr<content::WebContentsViewDelegate> CreateViewDelegate(
    content::WebContents* contents);

}

#endif
