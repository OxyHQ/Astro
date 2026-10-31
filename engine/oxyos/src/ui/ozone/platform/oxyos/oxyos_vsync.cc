// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_vsync.h"

#include <utility>

#include "base/functional/callback.h"

namespace ui {

base::TimeDelta OxyOSRefreshInterval(uint32_t refresh_mhz) {
  if (!refresh_mhz) {
    return base::TimeDelta();
  }
  return base::Microseconds((1'000'000'000LL + refresh_mhz / 2) / refresh_mhz);
}

OxyOSRefresh::OxyOSRefresh() = default;
OxyOSRefresh::~OxyOSRefresh() = default;

OxyOSVSyncProvider::OxyOSVSyncProvider(scoped_refptr<OxyOSRefresh> refresh)
    : refresh_(std::move(refresh)) {}

OxyOSVSyncProvider::~OxyOSVSyncProvider() = default;

void OxyOSVSyncProvider::GetVSyncParameters(UpdateVSyncCallback callback) {
  base::TimeTicks timebase;
  base::TimeDelta interval;
  if (GetVSyncParametersIfAvailable(&timebase, &interval)) {
    std::move(callback).Run(timebase, interval);
  }
}

bool OxyOSVSyncProvider::GetVSyncParametersIfAvailable(
    base::TimeTicks* timebase,
    base::TimeDelta* interval) {
  if (!refresh_->interval().is_positive()) {
    return false;
  }
  *timebase = base::TimeTicks();
  *interval = refresh_->interval();
  return true;
}

bool OxyOSVSyncProvider::SupportGetVSyncParametersIfAvailable() const {
  return true;
}

bool OxyOSVSyncProvider::IsHWClock() const {
  return false;
}

}
