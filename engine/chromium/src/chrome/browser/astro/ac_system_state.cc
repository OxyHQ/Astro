// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_system_state.h"

#include <algorithm>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/byte_size.h"
#include "base/command_line.h"
#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_split.h"
#include "base/system/sys_info.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_host.h"
#include "content/public/browser/browser_thread.h"

#if BUILDFLAG(IS_WIN)
#include <windows.h>

#include "base/power_monitor/battery_level_provider.h"
#include "base/power_monitor/power_monitor.h"
#include "base/power_monitor/power_observer.h"
#endif

#if BUILDFLAG(IS_LINUX)
#include "components/dbus/thread_linux/dbus_thread_linux.h"
#include "dbus/bus.h"
#include "dbus/object_path.h"
#include "dbus/object_proxy.h"
#include "dbus/property.h"
#endif

namespace astro {
namespace {

constexpr base::TimeDelta kFirstStateWait = base::Seconds(1);
constexpr base::TimeDelta kMemoryPollPeriod = base::Seconds(5);
constexpr char kMemoryPressureThresholdsSwitch[] =
    "astro-memory-pressure-thresholds";

struct MemoryThresholds {
  base::ByteSize moderate = base::MiB(1000);
  base::ByteSize critical = base::MiB(400);
};

MemoryThresholds ThresholdsFromCommandLine() {
  MemoryThresholds thresholds;
  const std::vector<std::string> parts = base::SplitString(
      base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
          kMemoryPressureThresholdsSwitch),
      ",", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);
  uint64_t moderate = 0;
  uint64_t critical = 0;
  if (parts.size() == 2 && base::StringToUint64(parts[0], &moderate) &&
      base::StringToUint64(parts[1], &critical) && critical <= moderate) {
    thresholds.moderate = base::MiB(moderate);
    thresholds.critical = base::MiB(critical);
  }
  return thresholds;
}

const char* MemoryPressureNow(MemoryThresholds thresholds) {
  const base::ByteSize available =
      base::SysInfo::AmountOfAvailablePhysicalMemory();
  if (available.is_zero()) {
    return "normal";
  }
  if (available <= thresholds.critical) {
    return "critical";
  }
  return available <= thresholds.moderate ? "warning" : "normal";
}

struct Battery {
  bool on_battery = false;
  std::optional<double> level;
  bool low_power_mode = false;
};

using BatteryChanged = base::RepeatingCallback<void(const Battery&)>;

#if BUILDFLAG(IS_WIN)

constexpr base::TimeDelta kBatteryPollPeriod = base::Minutes(1);

class BatterySource : public base::PowerStateObserver {
 public:
  explicit BatterySource(BatteryChanged changed)
      : changed_(std::move(changed)),
        provider_(base::BatteryLevelProvider::Create()) {
    base::PowerMonitor::GetInstance()
        ->AddPowerStateObserverAndReturnBatteryPowerStatus(this);
    poll_.Start(FROM_HERE, kBatteryPollPeriod,
                base::BindRepeating(&BatterySource::Read,
                                    base::Unretained(this)));
    Read();
  }

  ~BatterySource() override {
    base::PowerMonitor::GetInstance()->RemovePowerStateObserver(this);
  }

  void OnBatteryPowerStatusChange(
      base::PowerStateObserver::BatteryPowerStatus) override {
    Read();
  }

 private:
  void Read() {
    if (!provider_) {
      return changed_.Run(Battery{.low_power_mode = LowPowerMode()});
    }
    provider_->GetBatteryState(base::BindOnce(
        &BatterySource::OnBatteryState, weak_factory_.GetWeakPtr()));
  }

  void OnBatteryState(
      const std::optional<base::BatteryLevelProvider::BatteryState>& state) {
    Battery battery{.low_power_mode = LowPowerMode()};
    if (state && state->battery_count > 0) {
      battery.on_battery = !state->is_external_power_connected;
      if (state->current_capacity && state->full_charged_capacity &&
          *state->full_charged_capacity > 0) {
        battery.level =
            std::min(1.0, static_cast<double>(*state->current_capacity) /
                              *state->full_charged_capacity);
      }
    }
    changed_.Run(battery);
  }

  static bool LowPowerMode() {
    SYSTEM_POWER_STATUS status;
    return ::GetSystemPowerStatus(&status) && status.SystemStatusFlag == 1;
  }

  BatteryChanged changed_;
  std::unique_ptr<base::BatteryLevelProvider> provider_;
  base::RepeatingTimer poll_;
  base::WeakPtrFactory<BatterySource> weak_factory_{this};
};

#elif BUILDFLAG(IS_LINUX)

constexpr char kUPowerService[] = "org.freedesktop.UPower";
constexpr char kUPowerDisplayDevice[] =
    "/org/freedesktop/UPower/devices/DisplayDevice";
constexpr char kUPowerDeviceInterface[] = "org.freedesktop.UPower.Device";
constexpr uint32_t kUPowerBatteryType = 2;
constexpr uint32_t kUPowerDischarging = 2;
constexpr uint32_t kUPowerEmpty = 3;

class BatterySource : public dbus::PropertySet {
 public:
  explicit BatterySource(BatteryChanged changed)
      : BatterySource(dbus_thread_linux::GetSharedSystemBus(),
                      std::move(changed)) {}

  ~BatterySource() override {
    bus_->RemoveObjectProxy(kUPowerService,
                            dbus::ObjectPath(kUPowerDisplayDevice),
                            base::DoNothing());
  }

 private:
  BatterySource(scoped_refptr<dbus::Bus> bus, BatteryChanged changed)
      : dbus::PropertySet(
            bus->GetObjectProxy(kUPowerService,
                                dbus::ObjectPath(kUPowerDisplayDevice)),
            kUPowerDeviceInterface,
            base::BindRepeating(&BatterySource::OnPropertyChanged,
                                base::Unretained(this))),
        bus_(std::move(bus)),
        changed_(std::move(changed)) {
    RegisterProperty("IsPresent", &is_present_);
    RegisterProperty("Percentage", &percentage_);
    RegisterProperty("State", &state_);
    RegisterProperty("Type", &type_);
    ConnectSignals();
    GetAll();
  }

  void OnGetAll(dbus::Response* response) override {
    dbus::PropertySet::OnGetAll(response);
    got_all_ = true;
    Report();
  }

  void OnPropertyChanged(const std::string&) {
    if (got_all_) {
      Report();
    }
  }

  void Report() {
    Battery battery;
    const bool present = is_present_.is_valid() && is_present_.value() &&
                         type_.is_valid() &&
                         type_.value() == kUPowerBatteryType;
    if (present) {
      const uint32_t state = state_.is_valid() ? state_.value() : 0;
      battery.on_battery =
          state == kUPowerDischarging || state == kUPowerEmpty;
      if (percentage_.is_valid()) {
        battery.level = std::clamp(percentage_.value() / 100, 0.0, 1.0);
      }
    }
    changed_.Run(battery);
  }

  scoped_refptr<dbus::Bus> bus_;
  BatteryChanged changed_;
  bool got_all_ = false;
  dbus::Property<bool> is_present_;
  dbus::Property<double> percentage_;
  dbus::Property<uint32_t> state_;
  dbus::Property<uint32_t> type_;
};

#else

class BatterySource {
 public:
  explicit BatterySource(BatteryChanged changed) { changed.Run(Battery()); }
};

#endif

class SystemStateWatcher {
 public:
  static SystemStateWatcher& Get() {
    static base::NoDestructor<SystemStateWatcher> watcher;
    return *watcher;
  }

  SystemStateWatcher() {
    first_state_wait_.Start(FROM_HERE, kFirstStateWait,
                            base::BindOnce(&SystemStateWatcher::AnswerWaiting,
                                           base::Unretained(this)));
    source_ = std::make_unique<BatterySource>(base::BindRepeating(
        &SystemStateWatcher::OnBattery, base::Unretained(this)));
    memory_poll_.Start(FROM_HERE, kMemoryPollPeriod,
                       base::BindRepeating(&SystemStateWatcher::PollMemory,
                                           base::Unretained(this)));
    PollMemory();
  }

  void Current(base::OnceCallback<void(base::Value)> done) {
    if (!battery_ && first_state_wait_.IsRunning()) {
      waiting_.push_back(std::move(done));
      return;
    }
    std::move(done).Run(base::Value(Snapshot()));
  }

 private:
  void OnBattery(const Battery& battery) {
    battery_ = battery;
    first_state_wait_.Stop();
    AnswerWaiting();
    Publish();
  }

  void PollMemory() {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE,
        {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
         base::TaskShutdownBehavior::CONTINUE_ON_SHUTDOWN},
        base::BindOnce(&MemoryPressureNow, memory_thresholds_),
        base::BindOnce(&SystemStateWatcher::OnMemoryPressure,
                       base::Unretained(this)));
  }

  void OnMemoryPressure(const char* level) {
    if (memory_pressure_ == level) {
      return;
    }
    memory_pressure_ = level;
    if (battery_) {
      Publish();
    }
  }

  void AnswerWaiting() {
    std::vector<base::OnceCallback<void(base::Value)>> waiting;
    waiting.swap(waiting_);
    for (auto& done : waiting) {
      std::move(done).Run(base::Value(Snapshot()));
    }
  }

  void Publish() {
    base::DictValue state = Snapshot();
    if (published_ && *published_ == state) {
      return;
    }
    published_ = state.Clone();
    HostEvent("systemState", std::move(state));
  }

  base::DictValue Snapshot() const {
    const Battery battery = battery_.value_or(Battery());
    base::DictValue state;
    state.Set("onBattery", battery.on_battery);
    if (battery.level) {
      state.Set("batteryLevel", *battery.level);
    } else {
      state.Set("batteryLevel", base::Value());
    }
    state.Set("lowPowerMode", battery.low_power_mode);
    state.Set("memoryPressure", memory_pressure_);
    state.Set("physicalMemory",
              base::SysInfo::AmountOfTotalPhysicalMemory().InBytesF());
    return state;
  }

  std::optional<Battery> battery_;
  std::unique_ptr<BatterySource> source_;
  std::optional<base::DictValue> published_;
  std::vector<base::OnceCallback<void(base::Value)>> waiting_;
  base::OneShotTimer first_state_wait_;
  const MemoryThresholds memory_thresholds_ = ThresholdsFromCommandLine();
  std::string memory_pressure_ = "normal";
  base::RepeatingTimer memory_poll_;
};

}

void CurrentSystemState(base::OnceCallback<void(base::Value)> done) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  SystemStateWatcher::Get().Current(std::move(done));
}

}
