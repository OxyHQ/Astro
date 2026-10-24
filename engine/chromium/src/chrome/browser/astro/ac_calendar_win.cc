// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_calendar.h"

#include <windows.applicationmodel.appointments.h>
#include <windows.foundation.collections.h>
#include <windows.foundation.h>
#include <wrl/client.h>

#include <initializer_list>
#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/no_destructor.h"
#include "base/strings/stringprintf.h"
#include "base/task/bind_post_task.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/single_thread_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/win/core_winrt_util.h"
#include "base/win/post_async_results.h"
#include "base/win/scoped_hstring.h"

namespace astro {
namespace {

namespace appointments = ABI::Windows::ApplicationModel::Appointments;
using ABI::Windows::Foundation::DateTime;
using ABI::Windows::Foundation::IAsyncOperation;
using ABI::Windows::Foundation::IReference;
using ABI::Windows::Foundation::IUriRuntimeClass;
using ABI::Windows::Foundation::TimeSpan;
using ABI::Windows::Foundation::Collections::IVector;
using ABI::Windows::Foundation::Collections::IVectorView;
using Microsoft::WRL::ComPtr;

using Done = base::OnceCallback<void(base::Value)>;
using StoreCallback =
    base::OnceCallback<void(ComPtr<appointments::IAppointmentStore>, HRESULT)>;

constexpr int64_t kEpochDeltaMs = 11644473600000;
constexpr uint32_t kMaxAppointments = 1000;
constexpr size_t kMaxCalendarIds = 100;

scoped_refptr<base::SingleThreadTaskRunner> Runner() {
  static base::NoDestructor<scoped_refptr<base::SingleThreadTaskRunner>> runner(
      base::ThreadPool::CreateCOMSTATaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE}));
  return *runner;
}

std::string Utf8(HSTRING text) {
  return base::win::ScopedHString(text).GetAsUTF8();
}

template <typename Getter>
std::string Text(Getter getter) {
  HSTRING value = nullptr;
  return SUCCEEDED(getter(&value)) && value ? Utf8(value) : std::string();
}

double Milliseconds(const DateTime& time) {
  return static_cast<double>(time.UniversalTime / 10000 - kEpochDeltaMs);
}

DateTime FromMilliseconds(double ms) {
  return DateTime{(static_cast<int64_t>(ms) + kEpochDeltaMs) * 10000};
}

std::string Hex(const ABI::Windows::UI::Color& color) {
  return base::StringPrintf("#%02X%02X%02X", color.R, color.G, color.B);
}

void RequestStore(StoreCallback done) {
  ComPtr<appointments::IAppointmentManagerStatics2> statics;
  HRESULT hr = base::win::GetActivationFactory<
      appointments::IAppointmentManagerStatics2,
      RuntimeClass_Windows_ApplicationModel_Appointments_AppointmentManager>(
      &statics);
  if (FAILED(hr)) {
    std::move(done).Run(nullptr, hr);
    return;
  }
  ComPtr<IAsyncOperation<appointments::AppointmentStore*>> request;
  hr = statics->RequestStoreAsync(
      appointments::AppointmentStoreAccessType_AllCalendarsReadOnly, &request);
  if (FAILED(hr)) {
    std::move(done).Run(nullptr, hr);
    return;
  }
  auto [succeeded, failed] = base::SplitOnceCallback(std::move(done));
  hr = base::win::PostAsyncHandlers(
      request.Get(),
      base::BindOnce(
          [](StoreCallback done,
             ComPtr<appointments::IAppointmentStore> store) {
            std::move(done).Run(store, store ? S_OK : E_FAIL);
          },
          std::move(succeeded)),
      base::BindOnce([](StoreCallback done,
                        HRESULT hr) { std::move(done).Run(nullptr, hr); },
                     std::move(failed)));
  if (FAILED(hr) && failed) {
    std::move(failed).Run(nullptr, hr);
  }
}

using CalendarsCallback = base::OnceCallback<void(
    ComPtr<IVectorView<appointments::AppointmentCalendar*>>)>;

void FindCalendars(ComPtr<appointments::IAppointmentStore> store,
                   CalendarsCallback done) {
  ComPtr<IAsyncOperation<IVectorView<appointments::AppointmentCalendar*>*>>
      find;
  if (!store || FAILED(store->FindAppointmentCalendarsAsync(&find))) {
    std::move(done).Run(nullptr);
    return;
  }
  auto [succeeded, failed] = base::SplitOnceCallback(std::move(done));
  if (FAILED(base::win::PostAsyncHandlers(
          find.Get(), std::move(succeeded),
          base::BindOnce(
              [](CalendarsCallback done) { std::move(done).Run(nullptr); },
              std::move(failed))))) {
    if (failed) {
      std::move(failed).Run(nullptr);
    }
  }
}

struct CalendarInfo {
  std::string id;
  std::string title;
  std::string color;
  std::string account;
  bool owned = false;
  bool hidden = false;
};

std::vector<CalendarInfo> ReadCalendars(
    ComPtr<IVectorView<appointments::AppointmentCalendar*>> calendars) {
  std::vector<CalendarInfo> out;
  unsigned int count = 0;
  if (!calendars || FAILED(calendars->get_Size(&count))) {
    return out;
  }
  for (unsigned int i = 0; i < count; ++i) {
    ComPtr<appointments::IAppointmentCalendar> calendar;
    if (FAILED(calendars->GetAt(i, &calendar))) {
      continue;
    }
    CalendarInfo info;
    info.id = Text([&](HSTRING* v) { return calendar->get_LocalId(v); });
    info.title = Text([&](HSTRING* v) { return calendar->get_DisplayName(v); });
    info.account =
        Text([&](HSTRING* v) { return calendar->get_SourceDisplayName(v); });
    ABI::Windows::UI::Color color{};
    info.color =
        SUCCEEDED(calendar->get_DisplayColor(&color)) ? Hex(color) : "#8E8E93";
    boolean hidden = false;
    info.hidden = SUCCEEDED(calendar->get_IsHidden(&hidden)) && hidden;
    ComPtr<appointments::IAppointmentCalendar2> calendar2;
    boolean writable = false;
    info.owned =
        SUCCEEDED(calendar.As(&calendar2)) &&
        SUCCEEDED(calendar2->get_CanCreateOrUpdateAppointments(&writable)) &&
        writable;
    if (!info.id.empty()) {
      out.push_back(std::move(info));
    }
  }
  return out;
}

base::Value CalendarList(std::vector<CalendarInfo> calendars) {
  base::ListValue out;
  for (const CalendarInfo& calendar : calendars) {
    if (calendar.hidden) {
      continue;
    }
    out.Append(base::DictValue()
                   .Set("id", calendar.id)
                   .Set("title", calendar.title)
                   .Set("color", calendar.color)
                   .Set("account", calendar.account)
                   .Set("accountType", "other")
                   .Set("owned", calendar.owned));
  }
  return base::Value(std::move(out));
}

void AppendProperty(
    IVector<HSTRING>* names,
    HRESULT (STDMETHODCALLTYPE appointments::IAppointmentPropertiesStatics::*
                 getter)(HSTRING*),
    appointments::IAppointmentPropertiesStatics* statics) {
  HSTRING name = nullptr;
  if (SUCCEEDED((statics->*getter)(&name)) && name) {
    base::win::ScopedHString owned(name);
    names->Append(owned.get());
  }
}

ComPtr<appointments::IFindAppointmentsOptions> FindOptions(
    const std::vector<std::string>& ids) {
  ComPtr<IInspectable> inspectable;
  auto class_id = base::win::ScopedHString::Create(
      RuntimeClass_Windows_ApplicationModel_Appointments_FindAppointmentsOptions);
  ComPtr<appointments::IFindAppointmentsOptions> options;
  if (FAILED(base::win::RoActivateInstance(class_id.get(), &inspectable)) ||
      FAILED(inspectable.As(&options))) {
    return nullptr;
  }
  options->put_MaxCount(kMaxAppointments);
  ComPtr<IVector<HSTRING>> calendar_ids;
  if (SUCCEEDED(options->get_CalendarIds(&calendar_ids))) {
    for (const std::string& id : ids) {
      auto text = base::win::ScopedHString::Create(id);
      calendar_ids->Append(text.get());
    }
  }
  ComPtr<appointments::IAppointmentPropertiesStatics> properties;
  ComPtr<IVector<HSTRING>> fetch;
  const HRESULT statics = base::win::GetActivationFactory<
      appointments::IAppointmentPropertiesStatics,
      RuntimeClass_Windows_ApplicationModel_Appointments_AppointmentProperties>(
      &properties);
  if (SUCCEEDED(statics) && SUCCEEDED(options->get_FetchProperties(&fetch))) {
    using Statics = appointments::IAppointmentPropertiesStatics;
    for (auto getter :
         {&Statics::get_Subject, &Statics::get_Location,
          &Statics::get_StartTime, &Statics::get_Duration, &Statics::get_AllDay,
          &Statics::get_Details, &Statics::get_OnlineMeetingLink,
          &Statics::get_Organizer, &Statics::get_Invitees,
          &Statics::get_UserResponse, &Statics::get_IsCanceledMeeting,
          &Statics::get_IsOrganizedByUser, &Statics::get_OriginalStartTime,
          &Statics::get_Uri}) {
      AppendProperty(fetch.Get(), getter, properties.Get());
    }
  }
  return options;
}

const char* ResponseName(
    appointments::AppointmentParticipantResponse response) {
  switch (response) {
    case appointments::AppointmentParticipantResponse_Accepted:
      return "accepted";
    case appointments::AppointmentParticipantResponse_Declined:
      return "declined";
    case appointments::AppointmentParticipantResponse_Tentative:
      return "tentative";
    default:
      return "pending";
  }
}

base::DictValue Participant(appointments::IAppointmentParticipant* participant,
                            const char* status,
                            bool me) {
  return base::DictValue()
      .Set("name",
           Text([&](HSTRING* v) { return participant->get_DisplayName(v); }))
      .Set("email",
           Text([&](HSTRING* v) { return participant->get_Address(v); }))
      .Set("status", status)
      .Set("me", me);
}

base::Value Attendees(appointments::IAppointment* appointment) {
  base::ListValue out;
  ComPtr<IVector<appointments::AppointmentInvitee*>> invitees;
  unsigned int count = 0;
  if (FAILED(appointment->get_Invitees(&invitees)) || !invitees ||
      FAILED(invitees->get_Size(&count))) {
    return base::Value(std::move(out));
  }
  for (unsigned int i = 0; i < count; ++i) {
    ComPtr<appointments::IAppointmentInvitee> invitee;
    ComPtr<appointments::IAppointmentParticipant> participant;
    if (FAILED(invitees->GetAt(i, &invitee)) ||
        FAILED(invitee.As(&participant))) {
      continue;
    }
    appointments::AppointmentParticipantRole role{};
    if (SUCCEEDED(invitee->get_Role(&role)) &&
        role == appointments::AppointmentParticipantRole_Resource) {
      continue;
    }
    appointments::AppointmentParticipantResponse response{};
    invitee->get_Response(&response);
    out.Append(Participant(participant.Get(), ResponseName(response), false));
  }
  return base::Value(std::move(out));
}

std::string MeetingUrl(appointments::IAppointment* appointment,
                       appointments::IAppointment2* appointment2) {
  std::string link = appointment2 ? Text([&](HSTRING* v) {
    return appointment2->get_OnlineMeetingLink(v);
  })
                                  : std::string();
  if (!link.empty()) {
    return link;
  }
  ComPtr<IUriRuntimeClass> uri;
  if (SUCCEEDED(appointment->get_Uri(&uri)) && uri) {
    return Text([&](HSTRING* v) { return uri->get_AbsoluteUri(v); });
  }
  return std::string();
}

std::optional<base::DictValue> Event(
    appointments::IAppointment* appointment,
    const std::map<std::string, std::string>& colors) {
  ComPtr<appointments::IAppointment2> appointment2;
  if (FAILED(appointment->QueryInterface(IID_PPV_ARGS(&appointment2)))) {
    return std::nullopt;
  }
  DateTime start{};
  TimeSpan duration{};
  if (FAILED(appointment->get_StartTime(&start)) ||
      FAILED(appointment->get_Duration(&duration))) {
    return std::nullopt;
  }
  const double start_ms = Milliseconds(start);
  const double end_ms =
      start_ms + static_cast<double>(duration.Duration / 10000);
  const std::string id =
      Text([&](HSTRING* v) { return appointment2->get_LocalId(v); });
  const std::string calendar_id =
      Text([&](HSTRING* v) { return appointment2->get_CalendarId(v); });
  boolean all_day = false;
  appointment->get_AllDay(&all_day);
  boolean cancelled = false;
  appointment2->get_IsCanceledMeeting(&cancelled);
  boolean organized_by_me = false;
  appointment2->get_IsOrganizedByUser(&organized_by_me);
  appointments::AppointmentParticipantResponse response{};
  appointment2->get_UserResponse(&response);
  auto color = colors.find(calendar_id);
  base::DictValue event =
      base::DictValue()
          .Set("id", id)
          .Set("occurrence",
               base::StringPrintf("%s@%lld", id.c_str(),
                                  static_cast<long long>(start_ms / 1000)))
          .Set("calendarId", calendar_id)
          .Set("color", color == colors.end() ? "#8E8E93" : color->second)
          .Set("title",
               Text([&](HSTRING* v) { return appointment->get_Subject(v); }))
          .Set("start", start_ms)
          .Set("end", end_ms)
          .Set("allDay", static_cast<bool>(all_day))
          .Set("location",
               Text([&](HSTRING* v) { return appointment->get_Location(v); }))
          .Set("notes",
               Text([&](HSTRING* v) { return appointment->get_Details(v); }))
          .Set("url", MeetingUrl(appointment, appointment2.Get()))
          .Set("cancelled", static_cast<bool>(cancelled))
          .Set(
              "declined",
              response == appointments::AppointmentParticipantResponse_Declined)
          .Set("attendees", Attendees(appointment));
  ComPtr<appointments::IAppointmentParticipant> organizer;
  if (SUCCEEDED(appointment->get_Organizer(&organizer)) && organizer) {
    event.Set("organizer", Participant(organizer.Get(), "accepted",
                                       static_cast<bool>(organized_by_me)));
  } else {
    event.Set("organizer", base::Value());
  }
  return event;
}

base::Value Events(ComPtr<IVectorView<appointments::Appointment*>> found,
                   const std::map<std::string, std::string>& colors) {
  base::ListValue out;
  unsigned int count = 0;
  if (!found || FAILED(found->get_Size(&count))) {
    return base::Value(std::move(out));
  }
  for (unsigned int i = 0; i < count; ++i) {
    ComPtr<appointments::IAppointment> appointment;
    if (SUCCEEDED(found->GetAt(i, &appointment))) {
      if (std::optional<base::DictValue> event =
              Event(appointment.Get(), colors)) {
        out.Append(std::move(*event));
      }
    }
  }
  return base::Value(std::move(out));
}

void FindEvents(double start,
                double end,
                std::vector<std::string> ids,
                Done done,
                ComPtr<appointments::IAppointmentStore> store,
                ComPtr<IVectorView<appointments::AppointmentCalendar*>> found) {
  std::map<std::string, std::string> colors;
  for (const CalendarInfo& calendar : ReadCalendars(found)) {
    colors[calendar.id] = calendar.color;
  }
  ComPtr<appointments::IFindAppointmentsOptions> options = FindOptions(ids);
  ComPtr<IAsyncOperation<IVectorView<appointments::Appointment*>*>> find;
  if (!options || FAILED(store->FindAppointmentsAsyncWithOptions(
                      FromMilliseconds(start),
                      TimeSpan{static_cast<int64_t>(end - start) * 10000},
                      options.Get(), &find))) {
    std::move(done).Run(base::Value());
    return;
  }
  auto [succeeded, failed] = base::SplitOnceCallback(std::move(done));
  if (FAILED(base::win::PostAsyncHandlers(
          find.Get(),
          base::BindOnce(
              [](std::map<std::string, std::string> colors, Done done,
                 ComPtr<IVectorView<appointments::Appointment*>> found) {
                std::move(done).Run(Events(found, colors));
              },
              std::move(colors), std::move(succeeded)),
          base::BindOnce([](Done done) { std::move(done).Run(base::Value()); },
                         std::move(failed))))) {
    if (failed) {
      std::move(failed).Run(base::Value());
    }
  }
}

void Access(Done done) {
  RequestStore(base::BindOnce(
      [](Done done, ComPtr<appointments::IAppointmentStore> store, HRESULT hr) {
        std::move(done).Run(base::Value(store ? "available"
                                        : hr == E_ACCESSDENIED
                                            ? "denied"
                                            : "unavailable"));
      },
      std::move(done)));
}

void List(Done done) {
  RequestStore(base::BindOnce(
      [](Done done, ComPtr<appointments::IAppointmentStore> store, HRESULT) {
        if (!store) {
          std::move(done).Run(base::Value());
          return;
        }
        FindCalendars(
            store,
            base::BindOnce(
                [](Done done,
                   ComPtr<IVectorView<appointments::AppointmentCalendar*>>
                       found) {
                  std::move(done).Run(found ? CalendarList(ReadCalendars(found))
                                            : base::Value());
                },
                std::move(done)));
      },
      std::move(done)));
}

void Read(double start, double end, std::vector<std::string> ids, Done done) {
  if (ids.empty() || end <= start) {
    std::move(done).Run(base::Value(base::ListValue()));
    return;
  }
  RequestStore(base::BindOnce(
      [](double start, double end, std::vector<std::string> ids, Done done,
         ComPtr<appointments::IAppointmentStore> store, HRESULT) {
        if (!store) {
          std::move(done).Run(base::Value());
          return;
        }
        FindCalendars(store,
                      base::BindOnce(&FindEvents, start, end, std::move(ids),
                                     std::move(done), store));
      },
      start, end, std::move(ids), std::move(done)));
}

std::vector<std::string> Strings(const base::ListValue* list) {
  std::vector<std::string> out;
  if (list) {
    for (const base::Value& value : *list) {
      if (value.is_string() && out.size() < kMaxCalendarIds) {
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
  if (method != "calendarAccess" && method != "calendarList" &&
      method != "calendarEvents") {
    return false;
  }
  Done reply = base::BindPostTask(
      base::SequencedTaskRunner::GetCurrentDefault(), std::move(done));
  if (method == "calendarAccess") {
    Runner()->PostTask(FROM_HERE, base::BindOnce(&Access, std::move(reply)));
  } else if (method == "calendarList") {
    Runner()->PostTask(FROM_HERE, base::BindOnce(&List, std::move(reply)));
  } else {
    Runner()->PostTask(
        FROM_HERE,
        base::BindOnce(&Read, args.FindDouble("start").value_or(0),
                       args.FindDouble("end").value_or(0),
                       Strings(args.FindList("ids")), std::move(reply)));
  }
  return true;
}

}
