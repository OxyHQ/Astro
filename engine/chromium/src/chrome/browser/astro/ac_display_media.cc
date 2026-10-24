// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_display_media.h"

#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/media/webrtc/desktop_media_list.h"
#include "chrome/browser/media/webrtc/desktop_media_list_observer.h"
#include "chrome/browser/media/webrtc/desktop_media_picker.h"
#include "content/public/browser/browser_task_traits.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/desktop_media_id.h"
#include "content/public/browser/media_stream_request.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/render_process_host.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_media_capture_id.h"
#include "third_party/blink/public/mojom/mediastream/media_stream.mojom.h"
#include "ui/display/display.h"
#include "ui/display/screen.h"
#include "ui/gfx/geometry/size.h"
#include "url/origin.h"

extern std::unique_ptr<DesktopMediaPicker> (*g_astro_desktop_media_picker)(
    const content::MediaStreamRequest* request);

namespace astro {
namespace {

using blink::mojom::MediaStreamRequestResult;

constexpr char kSystemPickerPrefix[] = "system:";
constexpr base::TimeDelta kFirstListingWait = base::Milliseconds(600);
constexpr base::TimeDelta kSourcesUpdateDelay = base::Milliseconds(500);
constexpr base::TimeDelta kListUpdatePeriod = base::Seconds(2);
constexpr gfx::Size kThumbnailSize(32, 18);

class DisplayMediaPicker;

std::map<std::string, base::WeakPtr<DisplayMediaPicker>>& Pickers() {
  static base::NoDestructor<
      std::map<std::string, base::WeakPtr<DisplayMediaPicker>>>
      pickers;
  return *pickers;
}

content::WebContents* ContentsOfFrame(int render_process_id,
                                      int render_frame_id) {
  return content::WebContents::FromRenderFrameHost(
      content::RenderFrameHost::FromID(render_process_id, render_frame_id));
}

bool IsDesktopList(DesktopMediaList::Type type) {
  return type == DesktopMediaList::Type::kScreen ||
         type == DesktopMediaList::Type::kWindow;
}

class DisplayMediaPicker : public DesktopMediaPicker {
 public:
  DisplayMediaPicker(content::WebContents* requester, url::Origin origin)
      : requester_(requester->GetWeakPtr()),
        origin_(std::move(origin)),
        request_id_("d" + base::NumberToString(++last_request_id_)) {}

  ~DisplayMediaPicker() override { Pickers().erase(request_id_); }

  void Show(const Params& params,
            std::vector<std::unique_ptr<DesktopMediaList>> source_lists,
            DoneCallback done) override {
    done_ = std::move(done);
    request_audio_ = params.request_audio;
    lists_ = std::move(source_lists);
    if (!requester_) {
      return Finish(base::unexpected(MediaStreamRequestResult::INVALID_STATE));
    }
    Pickers()[request_id_] = weak_factory_.GetWeakPtr();
    for (size_t index = 0; index < lists_.size(); ++index) {
      DesktopMediaList* list = lists_[index].get();
      const DesktopMediaList::Type type = list->GetMediaListType();
      if (type == DesktopMediaList::Type::kWebContents) {
        any_tab_allowed_ = true;
        continue;
      }
      if (type == DesktopMediaList::Type::kCurrentTab) {
        own_tab_allowed_ = true;
        continue;
      }
      if (!IsDesktopList(type)) {
        continue;
      }
      watchers_.push_back(std::make_unique<ListWatcher>(this, index));
      if (list->IsSourceListDelegated()) {
        continue;
      }
      list->SetThumbnailSize(kThumbnailSize);
      list->SetUpdatePeriod(kListUpdatePeriod);
      list->StartUpdating(watchers_.back().get());
    }
    first_listing_.Start(FROM_HERE, kFirstListingWait,
                         base::BindOnce(&DisplayMediaPicker::Ask,
                                        weak_factory_.GetWeakPtr()));
    ListChanged();
  }

  void Resolve(content::WebContents* answering, const std::string& source_id) {
    if (!done_ || choosing_ || !requester_ || answering != requester_.get()) {
      return;
    }
    if (source_id.empty()) {
      return Finish(
          base::unexpected(MediaStreamRequestResult::PERMISSION_DENIED_BY_USER));
    }
    if (source_id.starts_with(kSystemPickerPrefix)) {
      return ChooseWithSystem(source_id.substr(sizeof(kSystemPickerPrefix) - 1));
    }
    for (const std::unique_ptr<DesktopMediaList>& list : lists_) {
      if (!IsDesktopList(list->GetMediaListType()) ||
          list->IsSourceListDelegated()) {
        continue;
      }
      for (int i = 0; i < list->GetSourceCount(); ++i) {
        const DesktopMediaList::Source& source = list->GetSource(i);
        if (source.id.ToString() == source_id && !source.is_sharing_blocked) {
          content::DesktopMediaID chosen = source.id;
          chosen.audio_share = false;
          return Finish(chosen);
        }
      }
    }
    content::DesktopMediaID tab = content::DesktopMediaID::Parse(source_id);
    if (tab.type == content::DesktopMediaID::TYPE_WEB_CONTENTS &&
        AllowsTab(tab)) {
      tab.audio_share = request_audio_;
      return Finish(tab);
    }
    Finish(base::unexpected(MediaStreamRequestResult::INVALID_STATE));
  }

 private:
  class ListWatcher : public DesktopMediaListObserver {
   public:
    ListWatcher(DisplayMediaPicker* picker, size_t list_index)
        : picker_(picker), list_index_(list_index) {}

    size_t list_index() const { return list_index_; }

    void OnSourceAdded(int index) override { picker_->ListChanged(list_index_); }
    void OnSourceRemoved(int index) override {
      picker_->ListChanged(list_index_);
    }
    void OnSourceMoved(int old_index, int new_index) override {
      picker_->ListChanged(list_index_);
    }
    void OnSourceNameChanged(int index) override {
      picker_->ListChanged(list_index_);
    }
    void OnSourceThumbnailChanged(int index) override {}
    void OnSourcePreviewChanged(size_t index) override {}
    void OnDelegatedSourceListSelection() override {
      picker_->SystemChose(list_index_);
    }
    void OnDelegatedSourceListDismissed() override {
      picker_->SystemDismissed(list_index_);
    }

   private:
    raw_ptr<DisplayMediaPicker> picker_;
    const size_t list_index_;
  };

  bool AllowsTab(const content::DesktopMediaID& id) const {
    content::WebContents* shared =
        ContentsOfFrame(id.web_contents_id.render_process_id,
                        id.web_contents_id.main_render_frame_id);
    if (!shared || !requester_ ||
        shared->GetBrowserContext() != requester_->GetBrowserContext()) {
      return false;
    }
    return any_tab_allowed_ || (own_tab_allowed_ && shared == requester_.get());
  }

  void ListChanged(std::optional<size_t> changed = std::nullopt) {
    if (choosing_) {
      if (changed == choosing_) {
        TakeSystemChoice();
      }
      return;
    }
    if (!asked_) {
      for (const std::unique_ptr<ListWatcher>& watcher : watchers_) {
        DesktopMediaList* list = lists_[watcher->list_index()].get();
        if (!list->IsSourceListDelegated() && !list->GetSourceCount()) {
          return;
        }
      }
      return Ask();
    }
    if (!sources_update_.IsRunning()) {
      sources_update_.Start(FROM_HERE, kSourcesUpdateDelay,
                            base::BindOnce(&DisplayMediaPicker::SendSources,
                                           weak_factory_.GetWeakPtr()));
    }
  }

  base::ListValue Sources() const {
    base::ListValue sources;
    int screen_count = 0;
    for (size_t index = 0; index < lists_.size(); ++index) {
      DesktopMediaList* list = lists_[index].get();
      const DesktopMediaList::Type type = list->GetMediaListType();
      if (!IsDesktopList(type)) {
        continue;
      }
      const bool screens = type == DesktopMediaList::Type::kScreen;
      if (list->IsSourceListDelegated()) {
        sources.Append(
            base::DictValue()
                .Set("id", kSystemPickerPrefix + base::NumberToString(index))
                .Set("kind", "screen")
                .Set("name", screens ? "Screen or window" : "Window")
                .Set("width", 0)
                .Set("height", 0));
        continue;
      }
      for (int i = 0; i < list->GetSourceCount(); ++i) {
        const DesktopMediaList::Source& source = list->GetSource(i);
        if (source.is_sharing_blocked) {
          continue;
        }
        screen_count += screens ? 1 : 0;
        sources.Append(base::DictValue()
                           .Set("id", source.id.ToString())
                           .Set("kind", screens ? "screen" : "window")
                           .Set("name", base::UTF16ToUTF8(source.name))
                           .Set("width", 0)
                           .Set("height", 0));
      }
    }
    display::Screen* screen = display::Screen::Get();
    if (screen_count == 1 && screen && screen->GetNumDisplays() == 1) {
      const gfx::Size size = screen->GetPrimaryDisplay().bounds().size();
      for (base::Value& source : sources) {
        base::DictValue& dict = source.GetDict();
        if (*dict.FindString("kind") == "screen" &&
            !dict.FindString("id")->starts_with(kSystemPickerPrefix)) {
          dict.Set("width", size.width());
          dict.Set("height", size.height());
        }
      }
    }
    return sources;
  }

  void Ask() {
    if (asked_ || !done_) {
      return;
    }
    asked_ = true;
    first_listing_.Stop();
    if (!requester_) {
      return Finish(base::unexpected(MediaStreamRequestResult::INVALID_STATE));
    }
    HostTabEvent(requester_.get(), "displayMediaRequest",
                 base::DictValue()
                     .Set("id", request_id_)
                     .Set("origin", origin_.opaque() ? std::string()
                                                     : origin_.Serialize())
                     .Set("audio", request_audio_)
                     .Set("sources", Sources()));
  }

  void SendSources() {
    if (requester_ && done_ && !choosing_) {
      HostTabEvent(requester_.get(), "displayMediaSources",
                   base::DictValue()
                       .Set("id", request_id_)
                       .Set("sources", Sources()));
    }
  }

  void ChooseWithSystem(const std::string& index_text) {
    size_t index = 0;
    if (!base::StringToSizeT(index_text, &index) || index >= lists_.size() ||
        !IsDesktopList(lists_[index]->GetMediaListType()) ||
        !lists_[index]->IsSourceListDelegated()) {
      return Finish(base::unexpected(MediaStreamRequestResult::INVALID_STATE));
    }
    for (const std::unique_ptr<ListWatcher>& watcher : watchers_) {
      if (watcher->list_index() == index) {
        choosing_ = index;
        sources_update_.Stop();
        lists_[index]->StartUpdating(watcher.get());
        lists_[index]->FocusList();
        return;
      }
    }
    Finish(base::unexpected(MediaStreamRequestResult::INVALID_STATE));
  }

  void SystemChose(size_t index) {
    if (index == choosing_) {
      system_chose_ = true;
      TakeSystemChoice();
    }
  }

  void SystemDismissed(size_t index) {
    if (index == choosing_) {
      Finish(
          base::unexpected(MediaStreamRequestResult::PERMISSION_DENIED_BY_USER));
    }
  }

  void TakeSystemChoice() {
    if (!system_chose_ || !choosing_) {
      return;
    }
    DesktopMediaList* list = lists_[*choosing_].get();
    if (list->GetSourceCount() > 0) {
      content::DesktopMediaID chosen = list->GetSource(0).id;
      chosen.audio_share = false;
      Finish(chosen);
    }
  }

  void Finish(DoneCallbackArgumentType result) {
    Pickers().erase(request_id_);
    first_listing_.Stop();
    sources_update_.Stop();
    if (!done_) {
      return;
    }
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE, base::BindOnce(std::move(done_), std::move(result)));
  }

  static inline int last_request_id_ = 0;

  base::WeakPtr<content::WebContents> requester_;
  const url::Origin origin_;
  const std::string request_id_;
  DoneCallback done_;
  bool request_audio_ = false;
  bool any_tab_allowed_ = false;
  bool own_tab_allowed_ = false;
  bool asked_ = false;
  bool system_chose_ = false;
  std::optional<size_t> choosing_;
  std::vector<std::unique_ptr<ListWatcher>> watchers_;
  std::vector<std::unique_ptr<DesktopMediaList>> lists_;
  base::OneShotTimer first_listing_;
  base::OneShotTimer sources_update_;
  base::WeakPtrFactory<DisplayMediaPicker> weak_factory_{this};
};

std::unique_ptr<DesktopMediaPicker> CreatePicker(
    const content::MediaStreamRequest* request) {
  if (!request) {
    return nullptr;
  }
  content::WebContents* requester =
      ContentsOfFrame(request->render_process_id, request->render_frame_id);
  if (!requester || !HostShowsTab(requester)) {
    return nullptr;
  }
  return std::make_unique<DisplayMediaPicker>(
      requester, url::Origin::Create(request->security_origin));
}

}

void InstallDisplayMediaPicker() {
  g_astro_desktop_media_picker = &CreatePicker;
}

void ResolveDisplayMedia(content::WebContents* contents,
                         const std::string& request_id,
                         const std::string& source_id) {
  auto it = Pickers().find(request_id);
  if (it == Pickers().end()) {
    return;
  }
  if (DisplayMediaPicker* picker = it->second.get()) {
    picker->Resolve(contents, source_id);
  } else {
    Pickers().erase(it);
  }
}

base::Value DisplayMediaSourceId(content::WebContents* contents) {
  content::RenderFrameHost* frame =
      contents ? contents->GetPrimaryMainFrame() : nullptr;
  if (!frame || !frame->IsRenderFrameLive()) {
    return base::Value();
  }
  return base::Value(
      content::WebContentsMediaCaptureId(frame->GetProcess()->GetDeprecatedID(),
                                         frame->GetRoutingID())
          .ToString());
}

}
