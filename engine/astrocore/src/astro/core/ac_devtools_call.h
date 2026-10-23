// Copyright 2026 Oxy. Apache-2.0.

#ifndef ASTRO_CORE_AC_DEVTOOLS_CALL_H_
#define ASTRO_CORE_AC_DEVTOOLS_CALL_H_

#include <optional>
#include <string>

#include "base/functional/callback.h"
#include "base/time/time.h"
#include "base/values.h"

namespace content {
class WebContents;
}

namespace astrocore {

using DevToolsReply = base::OnceCallback<void(std::optional<base::DictValue> result,
                                              std::optional<std::string> error)>;
void CallDevTools(content::WebContents* contents,
                  const std::string& method,
                  base::DictValue params,
                  std::optional<base::TimeDelta> timeout,
                  DevToolsReply reply);

}

#endif
