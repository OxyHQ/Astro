// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_calendar.h"

#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/barrier_callback.h"
#include "base/functional/bind.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/strings/stringprintf.h"
#include "base/time/time.h"
#include "components/dbus/thread_linux/dbus_thread_linux.h"
#include "components/dbus/utils/call_method.h"
#include "components/dbus/utils/variant.h"
#include "dbus/bus.h"
#include "dbus/object_path.h"
#include "dbus/object_proxy.h"

namespace astro {
namespace {

using Done = base::OnceCallback<void(base::Value)>;

constexpr char kDBusName[] = "org.freedesktop.DBus";
constexpr char kDBusPath[] = "/org/freedesktop/DBus";
constexpr char kObjectManager[] = "org.freedesktop.DBus.ObjectManager";
constexpr char kProperties[] = "org.freedesktop.DBus.Properties";
constexpr char kSourcesPrefix[] = "org.gnome.evolution.dataserver.Sources";
constexpr char kCalendarsPrefix[] = "org.gnome.evolution.dataserver.Calendar";
constexpr char kSourceManagerPath[] =
    "/org/gnome/evolution/dataserver/SourceManager";
constexpr char kSourceInterface[] = "org.gnome.evolution.dataserver.Source";
constexpr char kFactoryPath[] =
    "/org/gnome/evolution/dataserver/CalendarFactory";
constexpr char kFactoryInterface[] =
    "org.gnome.evolution.dataserver.CalendarFactory";
constexpr char kCalendarInterface[] = "org.gnome.evolution.dataserver.Calendar";
constexpr base::TimeDelta kOpenTimeout = base::Seconds(60);
constexpr size_t kMaxCalendars = 100;
constexpr size_t kMaxTimezones = 50;

struct Services {
  std::string sources;
  std::string calendars;
};

struct OpenedCalendar {
  std::string bus_name;
  dbus::ObjectPath path;
  std::string email;
};

std::optional<int> ServiceVersion(const std::string& name,
                                  const std::string& prefix) {
  int version;
  if (!name.starts_with(prefix) ||
      !base::StringToInt(name.substr(prefix.size()), &version)) {
    return std::nullopt;
  }
  return version;
}

std::string FormatTime(double ms) {
  base::Time::Exploded t;
  base::Time::FromMillisecondsSinceUnixEpoch(ms).UTCExplode(&t);
  return base::StringPrintf("%04d%02d%02dT%02d%02d%02dZ", t.year, t.month,
                            t.day_of_month, t.hour, t.minute, t.second);
}

std::string RangeQuery(double start, double end) {
  return "(occur-in-time-range? (make-time \"" + FormatTime(start) +
         "\") (make-time \"" + FormatTime(end) + "\"))";
}

class Eds {
 public:
  static Eds& Get() {
    static base::NoDestructor<Eds> eds;
    return *eds;
  }

  void FindServices(base::OnceCallback<void(std::optional<Services>)> done) {
    if (services_) {
      std::move(done).Run(services_);
      return;
    }
    auto collect = base::BarrierCallback<std::vector<std::string>>(
        2, base::BindOnce(&Eds::ChooseServices, base::Unretained(this),
                          std::move(done)));
    for (const char* method : {"ListNames", "ListActivatableNames"}) {
      dbus_utils::CallMethod<"", "as">(
          DBus(), kDBusName, method,
          base::BindOnce(
              [](base::OnceCallback<void(std::vector<std::string>)> collect,
                 dbus_utils::CallMethodResult<std::vector<std::string>>
                     result) {
                std::move(collect).Run(result.has_value()
                                           ? std::move(std::get<0>(*result))
                                           : std::vector<std::string>());
              },
              collect));
    }
  }

  void Sources(Done done) {
    FindServices(base::BindOnce(&Eds::ListSources, base::Unretained(this),
                                std::move(done)));
  }

  void Events(double start,
              double end,
              std::vector<std::string> ids,
              Done done) {
    if (ids.size() > kMaxCalendars) {
      ids.resize(kMaxCalendars);
    }
    FindServices(base::BindOnce(&Eds::ReadEvents, base::Unretained(this), start,
                                end, std::move(ids), std::move(done)));
  }

  void Timezones(std::string id, std::vector<std::string> tzids, Done done) {
    if (tzids.size() > kMaxTimezones) {
      tzids.resize(kMaxTimezones);
    }
    WithCalendar(id, base::BindOnce(&Eds::ReadTimezones, base::Unretained(this),
                                    std::move(tzids), std::move(done)));
  }

 private:
  friend class base::NoDestructor<Eds>;
  Eds() = default;

  scoped_refptr<dbus::Bus> Bus() {
    if (!bus_) {
      bus_ = dbus_thread_linux::GetSharedSessionBus();
    }
    return bus_;
  }

  dbus::ObjectProxy* DBus() {
    return Bus()->GetObjectProxy(kDBusName, dbus::ObjectPath(kDBusPath));
  }

  void ChooseServices(base::OnceCallback<void(std::optional<Services>)> done,
                      std::vector<std::vector<std::string>> lists) {
    std::optional<std::pair<int, std::string>> sources;
    std::optional<std::pair<int, std::string>> calendars;
    for (const auto& list : lists) {
      for (const std::string& name : list) {
        if (auto v = ServiceVersion(name, kSourcesPrefix);
            v && (!sources || *v > sources->first)) {
          sources = std::make_pair(*v, name);
        }
        if (auto v = ServiceVersion(name, kCalendarsPrefix);
            v && (!calendars || *v > calendars->first)) {
          calendars = std::make_pair(*v, name);
        }
      }
    }
    if (sources && calendars) {
      services_ = Services{sources->second, calendars->second};
    }
    std::move(done).Run(services_);
  }

  void ListSources(Done done, std::optional<Services> services) {
    if (!services) {
      std::move(done).Run(base::Value());
      return;
    }
    using Managed = std::map<
        dbus::ObjectPath,
        std::map<std::string, std::map<std::string, dbus_utils::Variant>>>;
    dbus_utils::CallMethod<"", "a{oa{sa{sv}}}">(
        Bus()->GetObjectProxy(services->sources,
                              dbus::ObjectPath(kSourceManagerPath)),
        kObjectManager, "GetManagedObjects",
        base::BindOnce(
            [](Done done, dbus_utils::CallMethodResult<Managed> result) {
              if (!result.has_value()) {
                std::move(done).Run(base::Value());
                return;
              }
              base::ListValue sources;
              for (auto& [path, interfaces] : std::get<0>(*result)) {
                auto source = interfaces.find(kSourceInterface);
                if (source == interfaces.end()) {
                  continue;
                }
                auto uid = source->second.find("UID");
                auto data = source->second.find("Data");
                if (uid == source->second.end() ||
                    data == source->second.end()) {
                  continue;
                }
                std::optional<std::string> uid_text =
                    std::move(uid->second).Take<std::string>();
                std::optional<std::string> data_text =
                    std::move(data->second).Take<std::string>();
                if (uid_text && data_text) {
                  sources.Append(base::DictValue()
                                     .Set("uid", *uid_text)
                                     .Set("data", *data_text));
                }
              }
              std::move(done).Run(base::Value(std::move(sources)));
            },
            std::move(done)));
  }

  void WithCalendar(
      const std::string& id,
      base::OnceCallback<void(std::optional<OpenedCalendar>)> done) {
    if (auto it = opened_.find(id); it != opened_.end()) {
      std::move(done).Run(it->second);
      return;
    }
    FindServices(base::BindOnce(&Eds::OpenCalendar, base::Unretained(this), id,
                                std::move(done)));
  }

  void OpenCalendar(
      std::string id,
      base::OnceCallback<void(std::optional<OpenedCalendar>)> done,
      std::optional<Services> services) {
    if (!services) {
      std::move(done).Run(std::nullopt);
      return;
    }
    dbus_utils::CallMethod<"s", "ss">(
        Bus()->GetObjectProxy(services->calendars,
                              dbus::ObjectPath(kFactoryPath)),
        kFactoryInterface, "OpenCalendar", kOpenTimeout,
        base::BindOnce(&Eds::Opened, base::Unretained(this), id,
                       std::move(done)),
        id);
  }

  void Opened(std::string id,
              base::OnceCallback<void(std::optional<OpenedCalendar>)> done,
              dbus_utils::CallMethodResult<std::string, std::string> result) {
    if (!result.has_value()) {
      std::move(done).Run(std::nullopt);
      return;
    }
    auto& [path, bus_name] = *result;
    OpenedCalendar calendar{bus_name, dbus::ObjectPath(path), std::string()};
    if (!calendar.path.IsValid()) {
      std::move(done).Run(std::nullopt);
      return;
    }
    dbus_utils::CallMethod<"", "as">(
        Bus()->GetObjectProxy(calendar.bus_name, calendar.path),
        kCalendarInterface, "Open", kOpenTimeout,
        base::BindOnce(&Eds::CalendarOpened, base::Unretained(this), id,
                       std::move(calendar), std::move(done)));
  }

  void CalendarOpened(
      std::string id,
      OpenedCalendar calendar,
      base::OnceCallback<void(std::optional<OpenedCalendar>)> done,
      dbus_utils::CallMethodResult<std::vector<std::string>> result) {
    if (!result.has_value()) {
      std::move(done).Run(std::nullopt);
      return;
    }
    dbus::ObjectProxy* proxy =
        Bus()->GetObjectProxy(calendar.bus_name, calendar.path);
    dbus_utils::CallMethod<"ss", "v">(
        proxy, kProperties, "Get",
        base::BindOnce(
            [](Eds* eds, std::string id, OpenedCalendar calendar,
               base::OnceCallback<void(std::optional<OpenedCalendar>)> done,
               dbus_utils::CallMethodResult<dbus_utils::Variant> email) {
              if (email.has_value()) {
                calendar.email = std::move(std::get<0>(*email))
                                     .Take<std::string>()
                                     .value_or(std::string());
              }
              eds->opened_[id] = calendar;
              std::move(done).Run(std::move(calendar));
            },
            base::Unretained(this), id, std::move(calendar), std::move(done)),
        kCalendarInterface, "CalEmailAddress");
  }

  void ReadEvents(double start,
                  double end,
                  std::vector<std::string> ids,
                  Done done,
                  std::optional<Services> services) {
    if (!services || ids.empty()) {
      std::move(done).Run(services ? base::Value(base::ListValue())
                                   : base::Value());
      return;
    }
    auto collect = base::BarrierCallback<std::optional<base::DictValue>>(
        ids.size(),
        base::BindOnce(
            [](Done done, std::vector<std::optional<base::DictValue>> results) {
              base::ListValue calendars;
              for (auto& result : results) {
                if (result) {
                  calendars.Append(std::move(*result));
                }
              }
              std::move(done).Run(base::Value(std::move(calendars)));
            },
            std::move(done)));
    const std::string query = RangeQuery(start, end);
    for (const std::string& id : ids) {
      WithCalendar(
          id, base::BindOnce(&Eds::QueryCalendar, base::Unretained(this), id,
                             query, collect));
    }
  }

  void QueryCalendar(
      std::string id,
      std::string query,
      base::OnceCallback<void(std::optional<base::DictValue>)> done,
      std::optional<OpenedCalendar> calendar) {
    if (!calendar) {
      std::move(done).Run(std::nullopt);
      return;
    }
    dbus_utils::CallMethod<"s", "as">(
        Bus()->GetObjectProxy(calendar->bus_name, calendar->path),
        kCalendarInterface, "GetObjectList", kOpenTimeout,
        base::BindOnce(
            [](Eds* eds, std::string id, std::string email,
               base::OnceCallback<void(std::optional<base::DictValue>)> done,
               dbus_utils::CallMethodResult<std::vector<std::string>> result) {
              if (!result.has_value()) {
                eds->opened_.erase(id);
                std::move(done).Run(std::nullopt);
                return;
              }
              base::ListValue objects;
              for (std::string& object : std::get<0>(*result)) {
                objects.Append(std::move(object));
              }
              std::move(done).Run(base::DictValue()
                                      .Set("id", id)
                                      .Set("email", email)
                                      .Set("objects", std::move(objects)));
            },
            base::Unretained(this), id, calendar->email, std::move(done)),
        query);
  }

  void ReadTimezones(std::vector<std::string> tzids,
                     Done done,
                     std::optional<OpenedCalendar> calendar) {
    if (!calendar || tzids.empty()) {
      std::move(done).Run(base::Value(base::DictValue()));
      return;
    }
    auto collect = base::BarrierCallback<
        std::optional<std::pair<std::string, std::string>>>(
        tzids.size(),
        base::BindOnce(
            [](Done done,
               std::vector<std::optional<std::pair<std::string, std::string>>>
                   zones) {
              base::DictValue out;
              for (auto& zone : zones) {
                if (zone) {
                  out.Set(zone->first, std::move(zone->second));
                }
              }
              std::move(done).Run(base::Value(std::move(out)));
            },
            std::move(done)));
    dbus::ObjectProxy* proxy =
        Bus()->GetObjectProxy(calendar->bus_name, calendar->path);
    for (const std::string& tzid : tzids) {
      dbus_utils::CallMethod<"s", "s">(
          proxy, kCalendarInterface, "GetTimezone",
          base::BindOnce(
              [](std::string tzid,
                 base::OnceCallback<void(
                     std::optional<std::pair<std::string, std::string>>)>
                     collect,
                 dbus_utils::CallMethodResult<std::string> result) {
                std::move(collect).Run(
                    result.has_value()
                        ? std::make_optional(std::make_pair(
                              tzid, std::move(std::get<0>(*result))))
                        : std::nullopt);
              },
              tzid, collect),
          tzid);
    }
  }

  scoped_refptr<dbus::Bus> bus_;
  std::optional<Services> services_;
  std::map<std::string, OpenedCalendar> opened_;
};

std::vector<std::string> Strings(const base::ListValue* list) {
  std::vector<std::string> out;
  if (list) {
    for (const base::Value& value : *list) {
      if (value.is_string()) {
        out.push_back(value.GetString());
      }
    }
  }
  return out;
}

}

bool CalendarCall(const std::string& method,
                  const base::DictValue& args,
                  Done& done) {
  if (method == "calendarAccess") {
    Eds::Get().FindServices(base::BindOnce(
        [](Done done, std::optional<Services> services) {
          std::move(done).Run(
              base::Value(services ? "available" : "unavailable"));
        },
        std::move(done)));
  } else if (method == "calendarSources") {
    Eds::Get().Sources(std::move(done));
  } else if (method == "calendarEvents") {
    Eds::Get().Events(args.FindDouble("start").value_or(0),
                      args.FindDouble("end").value_or(0),
                      Strings(args.FindList("ids")), std::move(done));
  } else if (method == "calendarTimezones") {
    const std::string* id = args.FindString("id");
    Eds::Get().Timezones(id ? *id : std::string(),
                         Strings(args.FindList("tzids")), std::move(done));
  } else {
    return false;
  }
  return true;
}

}
