// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_DOCUMENTS_H_
#define CHROME_BROWSER_ASTRO_AC_DOCUMENTS_H_

#include <string>
#include <string_view>

#include "base/functional/callback_forward.h"
#include "base/values.h"

namespace base {
class FilePath;
}

namespace astro {

bool IsDocumentName(std::string_view name);
void ReadDocuments(const base::FilePath& profile_dir,
                   base::OnceCallback<void(base::DictValue)> done);
void WriteDocument(const base::FilePath& profile_dir,
                   std::string name,
                   std::string contents);
void RemoveDocument(const base::FilePath& profile_dir, std::string name);

}

#endif
