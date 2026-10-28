// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_ui_media.h"

#include <utility>

#include "chrome/browser/media/webrtc/media_capture_devices_dispatcher.h"
#include "content/public/browser/media_stream_request.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "content/public/common/url_constants.h"
#include "third_party/blink/public/common/mediastream/media_stream_request.h"
#include "third_party/blink/public/mojom/mediastream/media_stream.mojom.h"
#include "url/origin.h"

extern void (*g_astro_ui_media_access)(
    content::WebContents* web_contents,
    const content::MediaStreamRequest& request,
    content::MediaResponseCallback callback);
extern bool (*g_astro_ui_media_check)(
    content::RenderFrameHost* render_frame_host,
    const url::Origin& security_origin,
    blink::mojom::MediaStreamType type);

namespace astro {

namespace {

constexpr char kInterfaceHost[] = "webui-browser";

bool IsInterface(const url::Origin& origin) {
  return origin.scheme() == content::kChromeUIScheme &&
         origin.host() == kInterfaceHost;
}

void RequestMicrophone(content::WebContents* contents,
                       const content::MediaStreamRequest& request,
                       content::MediaResponseCallback callback) {
  const bool microphone_only =
      request.audio_type ==
          blink::mojom::MediaStreamType::DEVICE_AUDIO_CAPTURE &&
      request.video_type == blink::mojom::MediaStreamType::NO_SERVICE;
  if (!microphone_only || !IsInterface(request.url_origin)) {
    std::move(callback).Run(
        blink::mojom::StreamDevicesSet(),
        blink::mojom::MediaStreamRequestResult::PERMISSION_DENIED, nullptr);
    return;
  }
  MediaCaptureDevicesDispatcher::GetInstance()->ProcessMediaAccessRequest(
      contents, request, std::move(callback), nullptr);
}

bool CheckMicrophone(content::RenderFrameHost* frame,
                     const url::Origin& origin,
                     blink::mojom::MediaStreamType type) {
  return type == blink::mojom::MediaStreamType::DEVICE_AUDIO_CAPTURE &&
         IsInterface(origin) &&
         MediaCaptureDevicesDispatcher::GetInstance()
             ->CheckMediaAccessPermission(frame, origin, type);
}

}

void InstallUiMedia() {
  g_astro_ui_media_access = &RequestMicrophone;
  g_astro_ui_media_check = &CheckMicrophone;
}

}
