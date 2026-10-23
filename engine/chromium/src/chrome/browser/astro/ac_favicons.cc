// Copyright 2026 Oxy. Apache-2.0.

#include <array>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "base/barrier_closure.h"
#include "base/base64.h"
#include "base/memory/ref_counted_memory.h"
#include "base/no_destructor.h"
#include "base/task/cancelable_task_tracker.h"
#include "chrome/browser/favicon/favicon_service_factory.h"
#include "chrome/browser/astro/ac_engine.h"
#include "chrome/browser/profiles/profile.h"
#include "components/favicon/core/favicon_service.h"
#include "components/favicon_base/favicon_types.h"
#include "components/keyed_service/core/service_access_type.h"
#include "ui/gfx/image/image.h"
#include "url/gurl.h"

namespace astro {

namespace {

const base::ListValue& EmptyList() {
  static base::NoDestructor<base::ListValue> empty;
  return *empty;
}

constexpr int kDefaultSize = 32;
constexpr size_t kMaxPerCall = 500;

base::CancelableTaskTracker& Tracker() {
  static base::NoDestructor<base::CancelableTaskTracker> tracker;
  return *tracker;
}

favicon::FaviconService* FaviconsFor(Profile* profile) {
  return profile && !profile->IsOffTheRecord()
             ? FaviconServiceFactory::GetForProfile(
                   profile, ServiceAccessType::EXPLICIT_ACCESS)
             : nullptr;
}

std::vector<std::string> Strings(const base::ListValue* list) {
  std::vector<std::string> out;
  for (const base::Value& value : list ? *list : EmptyList()) {
    if (value.is_string() && out.size() < kMaxPerCall) {
      out.push_back(value.GetString());
    }
  }
  return out;
}

struct Results {
  explicit Results(Reply reply) : reply(std::move(reply)) {}
  Reply reply;
  base::DictValue pages;
  base::DictValue icons;
};

std::string Png(const favicon_base::FaviconRawBitmapResult& result) {
  return base::Base64Encode(*result.bitmap_data);
}

void Found(Results& r,
           const std::string& page,
           const favicon_base::FaviconRawBitmapResult& result) {
  if (result.is_valid()) {
    r.pages.Set(page, base::DictValue()
                          .Set("png", Png(result))
                          .Set("icon", result.icon_url.spec()));
  }
}

struct SiteLookup {
  std::array<favicon_base::FaviconRawBitmapResult, 3> found;

  const favicon_base::FaviconRawBitmapResult& Best() const {
    for (const auto& result : found) {
      if (result.is_valid()) {
        return result;
      }
    }
    return found.back();
  }
};

favicon_base::FaviconRawBitmapCallback Into(std::shared_ptr<SiteLookup> lookup,
                                            size_t i,
                                            base::RepeatingClosure all) {
  return base::BindOnce(
      [](std::shared_ptr<SiteLookup> lookup, size_t i,
         base::RepeatingClosure all,
         const favicon_base::FaviconRawBitmapResult& result) {
        lookup->found[i] = result;
        all.Run();
      },
      std::move(lookup), i, std::move(all));
}

void LookUpSite(favicon::FaviconService* service,
                const GURL& url,
                int size,
                std::shared_ptr<Results> r,
                std::string page,
                base::RepeatingClosure done) {
  const GURL home = url.GetWithEmptyPath();
  auto lookup = std::make_shared<SiteLookup>();
  base::RepeatingClosure all = base::BarrierClosure(
      lookup->found.size(),
      base::BindOnce(
          [](std::shared_ptr<Results> r, std::string page,
             std::shared_ptr<SiteLookup> lookup, base::RepeatingClosure done) {
            Found(*r, page, lookup->Best());
            done.Run();
          },
          r, std::move(page), lookup, std::move(done)));
  const favicon_base::IconTypeSet types = {favicon_base::IconType::kFavicon};
  service->GetRawFaviconForPageURL(home, types, size,
                                   false,
                                   Into(lookup, 0, all), &Tracker());
  service->GetRawFavicon(home.Resolve("/favicon.ico"),
                         favicon_base::IconType::kFavicon, size,
                         Into(lookup, 1, all), &Tracker());
  service->GetRawFaviconForPageURL(url, types, size,
                                   true,
                                   Into(lookup, 2, all), &Tracker());
}

}

}

using astro::Call;
using astro::Reply;

AC_ENGINE_CALL(ac_favicons_get) {
  Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  favicon::FaviconService* service = astro::FaviconsFor(call.profile());
  if (!service) {
    return call.TakeReply().Error("no favicons");
  }
  const int size = static_cast<int>(call.Double("size", astro::kDefaultSize));
  std::vector<std::string> pages = astro::Strings(call.args().FindList("pages"));
  std::vector<std::string> icons = astro::Strings(call.args().FindList("icons"));
  auto results = std::make_shared<astro::Results>(call.TakeReply());
  base::RepeatingClosure done = base::BarrierClosure(
      pages.size() + icons.size(), base::BindOnce(
                                       [](std::shared_ptr<astro::Results> r) {
                                         r->reply.Send(
                                             base::DictValue()
                                                 .Set("pages", std::move(r->pages))
                                                 .Set("icons", std::move(r->icons)));
                                       },
                                       results));
  const favicon_base::IconTypeSet types = {favicon_base::IconType::kFavicon};
  for (const std::string& page : pages) {
    const GURL url(page);
    const bool site = url.SchemeIsHTTPOrHTTPS();
    service->GetRawFaviconForPageURL(
        url, types, size, !site,
        base::BindOnce(
            [](base::WeakPtr<Profile> profile, bool site, GURL url, int size,
               std::shared_ptr<astro::Results> r, std::string page,
               base::RepeatingClosure done,
               const favicon_base::FaviconRawBitmapResult& result) {
              favicon::FaviconService* service =
                  site && !result.is_valid()
                      ? astro::FaviconsFor(profile.get())
                      : nullptr;
              if (service) {
                astro::LookUpSite(service, url, size, std::move(r),
                                  std::move(page), std::move(done));
                return;
              }
              astro::Found(*r, page, result);
              done.Run();
            },
            call.profile()->GetWeakPtr(), site, url, size, results, page,
            done),
        &astro::Tracker());
  }
  for (const std::string& icon : icons) {
    service->GetRawFavicon(
        GURL(icon), favicon_base::IconType::kFavicon, size,
        base::BindOnce(
            [](std::shared_ptr<astro::Results> r, std::string icon,
               base::RepeatingClosure done,
               const favicon_base::FaviconRawBitmapResult& result) {
              if (result.is_valid()) {
                r->icons.Set(icon, base::DictValue().Set(
                                       "png", astro::Png(result)));
              }
              done.Run();
            },
            results, icon, done),
        &astro::Tracker());
  }
}

AC_ENGINE_CALL(ac_favicons_set) {
  Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  favicon::FaviconService* service = astro::FaviconsFor(call.profile());
  if (!service) {
    return call.TakeReply().Error("no favicons");
  }
  GURL page(call.String("page"));
  GURL icon(call.String("icon"));
  std::optional<std::vector<uint8_t>> png = base::Base64Decode(call.String("png"));
  if (!page.is_valid() || !icon.is_valid() || !png || png->empty()) {
    return call.TakeReply().Error("bad arguments");
  }
  gfx::Image image = gfx::Image::CreateFrom1xPNGBytes(*png);
  if (image.IsEmpty()) {
    return call.TakeReply().Error("not a PNG");
  }
  service->SetOnDemandFavicons(
      page, icon, favicon_base::IconType::kFavicon, image,
      base::BindOnce(
          [](Reply reply, bool stored) {
            reply.Send(base::DictValue().Set("stored", stored));
          },
          call.TakeReply()));
}
