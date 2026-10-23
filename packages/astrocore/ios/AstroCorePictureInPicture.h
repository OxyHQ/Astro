#pragma once

#import <AppKit/AppKit.h>

@class AstroCoreWebView;

namespace astrocore_pip {

void WatchZoom();

void VideoChanged(AstroCoreWebView *view, NSString *host, NSString *frameId, bool active);

void TabRequestedActivation(AstroCoreWebView *view);

}
