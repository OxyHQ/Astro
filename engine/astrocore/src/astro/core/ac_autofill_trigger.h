#ifndef ASTRO_CORE_AC_AUTOFILL_TRIGGER_H_
#define ASTRO_CORE_AC_AUTOFILL_TRIGGER_H_

namespace content {
class WebContents;
}

namespace astrocore {

void TrackAutofillFocus(content::WebContents* contents);
bool ShowAutofillSuggestions(content::WebContents* contents, bool passwords);

}

#endif
