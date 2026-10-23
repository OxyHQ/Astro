#ifndef ASTRO_CORE_AC_FAKE_MEDIA_H_
#define ASTRO_CORE_AC_FAKE_MEDIA_H_

namespace content {
struct MediaStreamRequest;
}

namespace astrocore {

bool UsingFakeMediaDevices();

void InstallFakeMediaDevices();

void KeepAudioCaptureFake(content::MediaStreamRequest& request);

}

#endif
