#ifndef ASTRO_CORE_AC_LIFETIME_H_
#define ASTRO_CORE_AC_LIFETIME_H_

#include "base/functional/callback.h"

namespace astrocore {

void InstallAppOverrides();

void StartLifetimeObservers();

void QuitEngine();
bool IsQuitting();

struct LifetimeCallbacks {
  base::RepeatingClosure quit_cancelled;
};
void SetLifetimeCallbacks(LifetimeCallbacks callbacks);

}

#endif
