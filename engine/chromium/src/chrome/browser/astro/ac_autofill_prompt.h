// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_AUTOFILL_PROMPT_H_
#define CHROME_BROWSER_ASTRO_AC_AUTOFILL_PROMPT_H_

#include <optional>
#include <string>

#include "base/values.h"

namespace content {
class WebContents;
}

namespace astro {

void EnsureAutofillPrompts(content::WebContents* contents);
std::optional<base::DictValue> PendingAutofillPrompt(
    content::WebContents* contents);
void ResolveAutofillPrompt(content::WebContents* contents,
                           int prompt_id,
                           const std::string& action);

}

#endif
