#ifndef ASTRO_CORE_AC_SAFE_STORAGE_H_
#define ASTRO_CORE_AC_SAFE_STORAGE_H_

namespace base {
class CommandLine;
}

namespace astrocore {

void GuardSafeStorageKey(const base::CommandLine& command_line);

}

#endif
