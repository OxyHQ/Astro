// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_AUTOFILL_TRIGGER_H_
#define CHROME_BROWSER_ASTRO_AC_AUTOFILL_TRIGGER_H_

namespace content {
class WebContents;
}

namespace astro {

void TrackAutofillFocus(content::WebContents* contents);
bool ShowAutofillSuggestions(content::WebContents* contents, bool passwords);

}

#endif
