// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_VSYNC_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_VSYNC_H_

#include <cstdint>

#include "base/memory/ref_counted.h"
#include "base/memory/scoped_refptr.h"
#include "base/time/time.h"
#include "ui/gfx/vsync_provider.h"

namespace ui {

base::TimeDelta OxyOSRefreshInterval(uint32_t refresh_mhz);

class OxyOSRefresh : public base::RefCounted<OxyOSRefresh> {
 public:
  OxyOSRefresh();
  OxyOSRefresh(const OxyOSRefresh&) = delete;
  OxyOSRefresh& operator=(const OxyOSRefresh&) = delete;

  base::TimeDelta interval() const { return interval_; }
  void set_refresh_mhz(uint32_t refresh_mhz) {
    interval_ = OxyOSRefreshInterval(refresh_mhz);
  }

 private:
  friend class base::RefCounted<OxyOSRefresh>;
  ~OxyOSRefresh();

  base::TimeDelta interval_;
};

class OxyOSVSyncProvider : public gfx::VSyncProvider {
 public:
  explicit OxyOSVSyncProvider(scoped_refptr<OxyOSRefresh> refresh);
  OxyOSVSyncProvider(const OxyOSVSyncProvider&) = delete;
  OxyOSVSyncProvider& operator=(const OxyOSVSyncProvider&) = delete;
  ~OxyOSVSyncProvider() override;

  void GetVSyncParameters(UpdateVSyncCallback callback) override;
  bool GetVSyncParametersIfAvailable(base::TimeTicks* timebase,
                                     base::TimeDelta* interval) override;
  bool SupportGetVSyncParametersIfAvailable() const override;
  bool IsHWClock() const override;

 private:
  const scoped_refptr<OxyOSRefresh> refresh_;
};

}

#endif
