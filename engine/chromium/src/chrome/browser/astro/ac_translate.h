// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_TRANSLATE_H_
#define CHROME_BROWSER_ASTRO_AC_TRANSLATE_H_

#include <optional>
#include <string>
#include <string_view>

#include "base/files/file_path.h"
#include "base/functional/callback_forward.h"
#include "base/values.h"

class Profile;

namespace astro {

inline constexpr char kTranslationFilesPath[] = "astro-translations/";

void TranslateCall(Profile* profile,
                   const std::string& method,
                   const base::DictValue& args,
                   base::OnceCallback<void(base::Value)> done);

std::optional<base::FilePath> TranslationFile(const base::FilePath& profile_dir,
                                              std::string_view path);

}

#endif
