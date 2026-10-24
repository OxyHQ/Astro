// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_WINDOW_TITLE_H_
#define CHROME_BROWSER_ASTRO_AC_WINDOW_TITLE_H_

namespace content {
class WebContents;
}

namespace astro {

void FollowPageTitle(content::WebContents* page);

}

#endif
