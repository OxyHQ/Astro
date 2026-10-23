// Copyright 2026 Oxy. Apache-2.0.

#include "astro/core/ac_video_upscaler.h"

#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <IOSurface/IOSurface.h>
#import <Metal/Metal.h>
#import <MetalFX/MetalFX.h>
#import <VideoToolbox/VideoToolbox.h>
#include <simd/simd.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "base/apple/bridging.h"
#include "base/functional/bind.h"
#include "base/memory/weak_ptr.h"
#include "base/task/sequenced_task_runner.h"
#include "base/strings/sys_string_conversions.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "base/trace_event/trace_event.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/geometry/size.h"
#include "ui/gfx/mac/io_surface.h"

@class AstroVideoUpscalerKit;

namespace astrocore {

namespace {

constexpr float kStartRatio = 1.15f;
constexpr float kStopRatio = 1.0f;
constexpr int kMaxTargetDimension = 6144;
constexpr int kMinSourceDimension = 64;
constexpr size_t kMaxOutputSurfaces = 4;
constexpr int kMissWindow = 12;
constexpr int kMissLimit = 6;
constexpr base::TimeDelta kIdleTeardown = base::Seconds(3);

constexpr char kShaderSource[] = R"(
#include <metal_stdlib>
using namespace metal;

struct ConvertParams {
  float4x4 matrix;
  float2 origin;
  float2 scale;
  float2 luma_size;
  float2 detail_size;
  float2 detail_offset;
  float2 detail_scale;
  float chroma_scale;
  float use_detail;
};

kernel void astro_pad(texture2d<half, access::read> src [[texture(0)]],
                      texture2d<half, access::write> dst [[texture(1)]],
                      constant int4& crop [[buffer(0)]],
                      uint2 gid [[thread_position_in_grid]]) {
  if (gid.x >= dst.get_width() || gid.y >= dst.get_height()) {
    return;
  }
  int2 p = crop.xy + min(int2(gid), crop.zw - 1);
  dst.write(src.read(uint2(p)), gid);
}

kernel void astro_yuv_to_rgb(texture2d<float, access::sample> luma [[texture(0)]],
                             texture2d<float, access::sample> chroma [[texture(1)]],
                             texture2d<float, access::sample> detail [[texture(2)]],
                             texture2d<float, access::write> out [[texture(3)]],
                             constant ConvertParams& p [[buffer(0)]],
                             uint2 gid [[thread_position_in_grid]]) {
  if (gid.x >= out.get_width() || gid.y >= out.get_height()) {
    return;
  }
  constexpr sampler s(coord::normalized, filter::linear, address::clamp_to_edge);
  float2 position = (p.origin + (float2(gid) + 0.5) * p.scale) / p.luma_size;
  float y = luma.sample(s, position).r;
  float2 c = chroma.sample(s, position).rg;
  if (p.use_detail > 0.0) {
    float y_detail =
        detail.sample(s, (p.detail_offset + (float2(gid) + 0.5) * p.detail_scale) / p.detail_size).r;
    float saturation = length((c - 128.0 / 255.0) * p.chroma_scale);
    y = mix(y_detail, y, smoothstep(0.30, 0.42, saturation));
  }
  float4 rgb = p.matrix * float4(y, c.x, c.y, 1.0);
  out.write(float4(saturate(rgb.rgb), 1.0), gid);
}
)";

struct ConvertParams {
  simd_float4x4 matrix;
  simd_float2 origin;
  simd_float2 scale;
  simd_float2 luma_size;
  simd_float2 detail_size;
  simd_float2 detail_offset;
  simd_float2 detail_scale;
  float chroma_scale;
  float use_detail;
};

int AlignUp16(int value) {
  return (value + 15) & ~15;
}

bool IsVideoPixelFormat(OSType format) {
  return format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange ||
         format == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange;
}

std::optional<std::pair<float, float>> LumaWeights(IOSurfaceRef surface,
                                                   const gfx::ColorSpace& space) {
  base::apple::ScopedCFTypeRef<CFTypeRef> tag(
      IOSurfaceCopyValue(surface, CFSTR("IOSurfaceYCbCrMatrix")));
  if (tag && CFGetTypeID(tag.get()) == CFStringGetTypeID()) {
    CFStringRef name = static_cast<CFStringRef>(tag.get());
    if (CFEqual(name, kCVImageBufferYCbCrMatrix_ITU_R_709_2)) {
      return std::make_pair(0.2126f, 0.0722f);
    }
    if (CFEqual(name, kCVImageBufferYCbCrMatrix_ITU_R_601_4)) {
      return std::make_pair(0.299f, 0.114f);
    }
    if (CFEqual(name, kCVImageBufferYCbCrMatrix_SMPTE_240M_1995)) {
      return std::make_pair(0.212f, 0.087f);
    }
    if (CFEqual(name, kCVImageBufferYCbCrMatrix_ITU_R_2020)) {
      return std::make_pair(0.2627f, 0.0593f);
    }
    return std::nullopt;
  }
  switch (space.GetMatrixID()) {
    case gfx::ColorSpace::MatrixID::BT709:
    case gfx::ColorSpace::MatrixID::INVALID:
      return std::make_pair(0.2126f, 0.0722f);
    case gfx::ColorSpace::MatrixID::SMPTE170M:
    case gfx::ColorSpace::MatrixID::BT470BG:
      return std::make_pair(0.299f, 0.114f);
    case gfx::ColorSpace::MatrixID::SMPTE240M:
      return std::make_pair(0.212f, 0.087f);
    case gfx::ColorSpace::MatrixID::BT2020_NCL:
      return std::make_pair(0.2627f, 0.0593f);
    default:
      return std::nullopt;
  }
}

simd_float4x4 YuvToRgbMatrix(float kr, float kb, bool full_range) {
  const float kg = 1.0f - kr - kb;
  const float y_scale = full_range ? 1.0f : 255.0f / 219.0f;
  const float y_offset = full_range ? 0.0f : -16.0f / 219.0f;
  const float c_scale = full_range ? 1.0f : 255.0f / 224.0f;
  const float c_offset = -128.0f / 255.0f * c_scale;
  const float r_cr = 2.0f * (1.0f - kr);
  const float b_cb = 2.0f * (1.0f - kb);
  const float g_cb = -2.0f * kb * (1.0f - kb) / kg;
  const float g_cr = -2.0f * kr * (1.0f - kr) / kg;
  simd_float4 col_y = {y_scale, y_scale, y_scale, 0};
  simd_float4 col_cb = {0, g_cb * c_scale, b_cb * c_scale, 0};
  simd_float4 col_cr = {r_cr * c_scale, g_cr * c_scale, 0, 0};
  simd_float4 col_one = {y_offset + r_cr * c_offset,
                         y_offset + (g_cb + g_cr) * c_offset,
                         y_offset + b_cb * c_offset, 1};
  return simd_matrix(col_y, col_cb, col_cr, col_one);
}

id<MTLTexture> PlaneTexture(id<MTLDevice> device,
                            IOSurfaceRef surface,
                            size_t plane,
                            MTLPixelFormat format,
                            MTLTextureUsage usage) {
  MTLTextureDescriptor* descriptor = [MTLTextureDescriptor
      texture2DDescriptorWithPixelFormat:format
                                   width:IOSurfaceGetWidthOfPlane(surface, plane)
                                  height:IOSurfaceGetHeightOfPlane(surface, plane)
                               mipmapped:NO];
  descriptor.usage = usage;
  descriptor.storageMode = MTLStorageModeShared;
  return [device newTextureWithDescriptor:descriptor iosurface:surface plane:plane];
}

base::apple::ScopedCFTypeRef<IOSurfaceRef> CreateOutputSurface(const gfx::Size& size) {
  const size_t bytes_per_row =
      IOSurfaceAlignProperty(kIOSurfaceBytesPerRow, size.width() * 4);
  NSDictionary* properties = @{
    (id)kIOSurfaceWidth : @(size.width()),
    (id)kIOSurfaceHeight : @(size.height()),
    (id)kIOSurfaceBytesPerElement : @4,
    (id)kIOSurfaceBytesPerRow : @(bytes_per_row),
    (id)kIOSurfaceAllocSize : @(IOSurfaceAlignProperty(kIOSurfaceAllocSize,
                                                       bytes_per_row * size.height())),
    (id)kIOSurfacePixelFormat : @(kCVPixelFormatType_32BGRA),
  };
  return base::apple::ScopedCFTypeRef<IOSurfaceRef>(
      IOSurfaceCreate((__bridge CFDictionaryRef)properties));
}

void CopyColorTags(IOSurfaceRef from, IOSurfaceRef to, const gfx::ColorSpace& space) {
  base::apple::ScopedCFTypeRef<CFTypeRef> named(
      IOSurfaceCopyValue(from, CFSTR("IOSurfaceColorSpace")));
  if (named) {
    IOSurfaceSetValue(to, CFSTR("IOSurfaceColorSpace"), named.get());
    return;
  }
  NSMutableDictionary* attachments = [NSMutableDictionary dictionary];
  const std::pair<CFStringRef, CFStringRef> keys[] = {
      {CFSTR("IOSurfaceColorPrimaries"), kCVImageBufferColorPrimariesKey},
      {CFSTR("IOSurfaceTransferFunction"), kCVImageBufferTransferFunctionKey},
      {CFSTR("IOSurfaceYCbCrMatrix"), kCVImageBufferYCbCrMatrixKey},
  };
  for (const auto& [surface_key, buffer_key] : keys) {
    base::apple::ScopedCFTypeRef<CFTypeRef> value(IOSurfaceCopyValue(from, surface_key));
    if (value) {
      attachments[(__bridge NSString*)buffer_key] = (__bridge id)value.get();
    }
  }
  if (attachments.count) {
    base::apple::ScopedCFTypeRef<CGColorSpaceRef> color_space(
        CVImageBufferCreateColorSpaceFromAttachments((__bridge CFDictionaryRef)attachments));
    if (color_space) {
      base::apple::ScopedCFTypeRef<CFPropertyListRef> list(
          CGColorSpaceCopyPropertyList(color_space.get()));
      if (list) {
        IOSurfaceSetValue(to, CFSTR("IOSurfaceColorSpace"), list.get());
        return;
      }
    }
  }
  gfx::IOSurfaceSetColorSpace(to, space.GetAsFullRangeRGB());
}

std::string SurfaceTags(IOSurfaceRef surface) {
  std::string tags;
  for (CFStringRef key : {CFSTR("IOSurfaceColorSpace"), CFSTR("IOSurfaceColorPrimaries"),
                          CFSTR("IOSurfaceTransferFunction"), CFSTR("IOSurfaceYCbCrMatrix"),
                          CFSTR("IOSurfaceICCProfile")}) {
    base::apple::ScopedCFTypeRef<CFTypeRef> value(IOSurfaceCopyValue(surface, key));
    if (!value) {
      continue;
    }
    base::apple::ScopedCFTypeRef<CFStringRef> text(CFCopyDescription(value.get()));
    tags += base::SysCFStringRefToUTF8(key) + "=" +
            (CFGetTypeID(value.get()) == CFDataGetTypeID() ? std::string("data")
                                                             : base::SysCFStringRefToUTF8(text.get())) +
            " ";
  }
  return tags;
}

struct VideoKey {
  gfx::RectF crop;
  gfx::Size target;
  OSType format = 0;
  gfx::ColorSpace color_space;
  bool operator==(const VideoKey& other) const = default;
};

struct SetupCancel {
  std::atomic<bool> cancelled{false};
};

struct KitBox {
  AstroVideoUpscalerKit* __strong kit = nil;
};

struct Plan {
  VideoKey key;
  gfx::Size surface_size;
  gfx::Rect region;
  float vt_factor = 0;
  gfx::Size vt_input;
  bool vt_needs_pad = false;
  gfx::Size rgb_size;
  bool needs_metalfx = true;
  bool operator==(const Plan& other) const = default;
};

}

}

@interface AstroVideoUpscalerKit : NSObject
@property(nonatomic) id<MTLDevice> device;
@property(nonatomic) id<MTLCommandQueue> queue;
@property(nonatomic) id<MTLComputePipelineState> pad;
@property(nonatomic) id<MTLComputePipelineState> convert;
@property(nonatomic) VTFrameProcessor* processor API_AVAILABLE(macos(26.0));
@property(nonatomic)
    VTLowLatencySuperResolutionScalerConfiguration* configuration API_AVAILABLE(macos(26.0));
@property(nonatomic) CVPixelBufferRef paddedInput;
@property(nonatomic) CVPixelBufferRef vtOutput;
@property(nonatomic) id<MTLFXSpatialScaler> scaler API_AVAILABLE(macos(26.0));
@property(nonatomic) id<MTLTexture> rgb;
@end

@implementation AstroVideoUpscalerKit
@synthesize device = _device;
@synthesize queue = _queue;
@synthesize pad = _pad;
@synthesize convert = _convert;
@synthesize processor = _processor;
@synthesize configuration = _configuration;
@synthesize paddedInput = _paddedInput;
@synthesize vtOutput = _vtOutput;
@synthesize scaler = _scaler;
@synthesize rgb = _rgb;
- (void)dealloc {
  if (@available(macOS 26.0, *)) {
    if (_processor) {
      [_processor endSession];
    }
  }
  if (_paddedInput) {
    CVPixelBufferRelease(_paddedInput);
  }
  if (_vtOutput) {
    CVPixelBufferRelease(_vtOutput);
  }
}
- (void)setPaddedInput:(CVPixelBufferRef)buffer {
  if (_paddedInput) {
    CVPixelBufferRelease(_paddedInput);
  }
  _paddedInput = buffer ? CVPixelBufferRetain(buffer) : nullptr;
}
- (void)setVtOutput:(CVPixelBufferRef)buffer {
  if (_vtOutput) {
    CVPixelBufferRelease(_vtOutput);
  }
  _vtOutput = buffer ? CVPixelBufferRetain(buffer) : nullptr;
}
@end

namespace astrocore {

namespace {

API_AVAILABLE(macos(26.0))
CVPixelBufferRef CreateBuffer(int width, int height, NSDictionary* required) {
  NSArray* attribute_list = @[
    required ?: @{}, @{
      (id)kCVPixelBufferIOSurfacePropertiesKey : @{},
      (id)kCVPixelBufferMetalCompatibilityKey : @YES,
    }
  ];
  CFDictionaryRef resolved = nullptr;
  CVPixelBufferCreateResolvedAttributesDictionary(
      nullptr, (__bridge CFArrayRef)attribute_list, &resolved);
  CVPixelBufferRef buffer = nullptr;
  CVPixelBufferCreate(nullptr, width, height,
                      kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange, resolved,
                      &buffer);
  if (resolved) {
    CFRelease(resolved);
  }
  return buffer;
}

API_AVAILABLE(macos(26.0))
AstroVideoUpscalerKit* BuildKit(AstroVideoUpscalerKit* previous,
                                const Plan& plan,
                                const SetupCancel& cancel) {
  if (cancel.cancelled) {
    return nil;
  }
  AstroVideoUpscalerKit* kit = [[AstroVideoUpscalerKit alloc] init];
  kit.device = previous.device ?: MTLCreateSystemDefaultDevice();
  if (!kit.device) {
    return nil;
  }
  kit.queue = previous.queue ?: [kit.device newCommandQueue];
  kit.pad = previous.pad;
  kit.convert = previous.convert;
  if (!kit.pad || !kit.convert) {
    NSError* error = nil;
    id<MTLLibrary> library =
        [kit.device newLibraryWithSource:@(kShaderSource) options:nil error:&error];
    if (!library) {
      return nil;
    }
    kit.pad = [kit.device
        newComputePipelineStateWithFunction:[library newFunctionWithName:@"astro_pad"]
                                      error:&error];
    kit.convert = [kit.device
        newComputePipelineStateWithFunction:[library newFunctionWithName:@"astro_yuv_to_rgb"]
                                      error:&error];
    if (!kit.pad || !kit.convert) {
      return nil;
    }
  }
  if (cancel.cancelled) {
    return nil;
  }
  if (plan.vt_factor > 0) {
    if (previous.processor && previous.configuration.frameWidth == plan.vt_input.width() &&
        previous.configuration.frameHeight == plan.vt_input.height() &&
        previous.configuration.scaleFactor == plan.vt_factor) {
      kit.processor = previous.processor;
      kit.configuration = previous.configuration;
      previous.processor = nil;
    } else {
      kit.configuration = [[VTLowLatencySuperResolutionScalerConfiguration alloc]
          initWithFrameWidth:plan.vt_input.width()
                 frameHeight:plan.vt_input.height()
                 scaleFactor:plan.vt_factor];
      kit.processor = [[VTFrameProcessor alloc] init];
      NSError* error = nil;
      if (![kit.processor startSessionWithConfiguration:kit.configuration error:&error]) {
        return nil;
      }
    }
    if (cancel.cancelled) {
      return nil;
    }
    {
      const int out_width = (int)std::lround(plan.vt_input.width() * plan.vt_factor);
      const int out_height = (int)std::lround(plan.vt_input.height() * plan.vt_factor);
      CVPixelBufferRef output = CreateBuffer(
          out_width, out_height, kit.configuration.destinationPixelBufferAttributes);
      kit.vtOutput = output;
      if (output) {
        CVPixelBufferRelease(output);
      }
      if (plan.vt_needs_pad) {
        CVPixelBufferRef padded =
            CreateBuffer(plan.vt_input.width(), plan.vt_input.height(),
                         kit.configuration.sourcePixelBufferAttributes);
        kit.paddedInput = padded;
        if (padded) {
          CVPixelBufferRelease(padded);
        }
      }
      if (!kit.vtOutput || (plan.vt_needs_pad && !kit.paddedInput)) {
        return nil;
      }
    }
  }
  if (cancel.cancelled) {
    return nil;
  }
  if (plan.needs_metalfx) {
    MTLTextureDescriptor* descriptor =
        [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA8Unorm
                                                           width:plan.rgb_size.width()
                                                          height:plan.rgb_size.height()
                                                       mipmapped:NO];
    descriptor.usage = MTLTextureUsageShaderRead | MTLTextureUsageShaderWrite;
    descriptor.storageMode = MTLStorageModePrivate;
    kit.rgb = [kit.device newTextureWithDescriptor:descriptor];
    MTLFXSpatialScalerDescriptor* scaler = [[MTLFXSpatialScalerDescriptor alloc] init];
    scaler.colorTextureFormat = MTLPixelFormatRGBA8Unorm;
    scaler.outputTextureFormat = MTLPixelFormatBGRA8Unorm;
    scaler.inputWidth = plan.rgb_size.width();
    scaler.inputHeight = plan.rgb_size.height();
    scaler.outputWidth = plan.key.target.width();
    scaler.outputHeight = plan.key.target.height();
    scaler.colorProcessingMode = MTLFXSpatialScalerColorProcessingModePerceptual;
    kit.scaler = [scaler newSpatialScalerWithDevice:kit.device];
    if (!kit.rgb || !kit.scaler) {
      return nil;
    }
  }
  return kit;
}

class Upscaler : public VideoUpscaler {
 public:
  explicit Upscaler(base::RepeatingClosure on_upscaled)
      : on_upscaled_(std::move(on_upscaled)),
        task_runner_(base::SequencedTaskRunner::GetCurrentDefault()) {}

  ~Upscaler() override { ++generation_; }

  void Process(bool allowed, std::vector<VideoUpscaleCandidate>& candidates) override {
    if (!allowed) {
      if (gate_open_) {
        TRACE_EVENT_INSTANT0("gpu", "AstroVSR.GateClosed", TRACE_EVENT_SCOPE_THREAD);
      }
      gate_open_ = false;
      kit_requested_.reset();
      CancelSetup();
      Forget();
      return;
    }
    if (!gate_open_) {
      gate_open_ = true;
      disabled_.reset();
      TRACE_EVENT_INSTANT0("gpu", "AstroVSR.GateOpen", TRACE_EVENT_SCOPE_THREAD);
    }
    if (@available(macOS 26.0, *)) {
      VideoUpscaleCandidate* best = nullptr;
      std::optional<VideoKey> best_key;
      for (auto& candidate : candidates) {
        std::optional<VideoKey> key = Eligible(candidate);
        if (!key) {
          continue;
        }
        if (!best || key->target.GetArea() > best_key->target.GetArea()) {
          best = &candidate;
          best_key = key;
        }
      }
      if (!best || !Upscaling(*best_key)) {
        Forget();
        return;
      }
      ArmIdleTeardown();
      current_source_.reset(best->source, base::scoped_policy::RETAIN);
      current_key_ = best_key;
      if (cache_output_ && cache_source_.get() == best->source &&
          cache_seed_ == IOSurfaceGetSeed(best->source) && cache_key_ == best_key) {
        best->output = cache_output_;
        TRACE_EVENT_INSTANT0("gpu", "AstroVSR.CacheHit", TRACE_EVENT_SCOPE_THREAD);
        return;
      }
      if (job_in_flight_) {
        best->pending = job_in_flight_source_ == best->source;
        return;
      }
      std::optional<Plan> plan = MakePlan(*best, *best_key);
      if (!plan) {
        return;
      }
      if (!kit_ || !kit_plan_ || !(*kit_plan_ == *plan)) {
        RequestKit(*plan);
        return;
      }
      Start(*best, *plan);
      best->pending = job_in_flight_ != 0;
    } else {
      Forget();
    }
  }

 private:
  struct Job {
    gfx::ScopedInUseIOSurface source;
    uint32_t seed = 0;
    VideoKey key;
    gfx::ScopedInUseIOSurface output;
    base::TimeTicks started;
    base::TimeDelta encode;
  };

  std::optional<VideoKey> Eligible(const VideoUpscaleCandidate& candidate) {
    if (!candidate.source || candidate.protected_video_type != gfx::ProtectedVideoType::kClear ||
        candidate.has_hdr_metadata || candidate.color_space.IsHDR()) {
      return std::nullopt;
    }
    const OSType format = IOSurfaceGetPixelFormat(candidate.source);
    if (!IsVideoPixelFormat(format)) {
      return std::nullopt;
    }
    const int width = (int)IOSurfaceGetWidth(candidate.source);
    const int height = (int)IOSurfaceGetHeight(candidate.source);
    gfx::RectF crop = candidate.contents_rect;
    crop.Scale(width, height);
    if (!gfx::RectF(width, height).Contains(crop) || crop.width() < kMinSourceDimension ||
        crop.height() < kMinSourceDimension) {
      return std::nullopt;
    }
    gfx::Size target(static_cast<int>(std::lround(candidate.target_size.width())),
                     static_cast<int>(std::lround(candidate.target_size.height())));
    if (target.width() > kMaxTargetDimension || target.height() > kMaxTargetDimension ||
        target.IsEmpty()) {
      return std::nullopt;
    }
    if (!LumaWeights(candidate.source, candidate.color_space)) {
      return std::nullopt;
    }
    return VideoKey{crop, target, format, candidate.color_space};
  }

  bool Upscaling(const VideoKey& key) {
    if (disabled_ && disabled_->crop.size() == key.crop.size()) {
      return false;
    }
    const float ratio = std::min(key.target.width() / key.crop.width(),
                                 key.target.height() / key.crop.height());
    if (!active_ || active_->crop.size() != key.crop.size()) {
      active_.reset();
      if (ratio >= kStartRatio) {
        active_ = key;
      }
    } else if (ratio <= kStopRatio) {
      active_.reset();
    } else {
      active_ = key;
    }
    return active_.has_value();
  }

  API_AVAILABLE(macos(26.0))
  std::optional<Plan> MakePlan(const VideoUpscaleCandidate& candidate, const VideoKey& key) {
    Plan plan;
    plan.key = key;
    plan.surface_size = gfx::Size(IOSurfaceGetWidth(candidate.source),
                                  IOSurfaceGetHeight(candidate.source));
    const int left = static_cast<int>(std::floor(key.crop.x())) & ~1;
    const int top = static_cast<int>(std::floor(key.crop.y())) & ~1;
    const int right = std::min(plan.surface_size.width(),
                               (static_cast<int>(std::ceil(key.crop.right())) + 1) & ~1);
    const int bottom = std::min(plan.surface_size.height(),
                                (static_cast<int>(std::ceil(key.crop.bottom())) + 1) & ~1);
    plan.region = gfx::Rect(left, top, right - left, bottom - top);
    if (!gfx::RectF(plan.region).Contains(key.crop)) {
      return std::nullopt;
    }
    const float ratio = std::min(key.target.width() / key.crop.width(),
                                 key.target.height() / key.crop.height());
    if (VTLowLatencySuperResolutionScalerConfiguration.isSupported &&
        key.format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange) {
      const gfx::Size aligned(AlignUp16(plan.region.width()), AlignUp16(plan.region.height()));
      const CMVideoDimensions max =
          VTLowLatencySuperResolutionScalerConfiguration.maximumDimensions;
      const CMVideoDimensions min =
          VTLowLatencySuperResolutionScalerConfiguration.minimumDimensions;
      if (aligned.width() <= max.width && aligned.height() <= max.height &&
          aligned.width() >= min.width && aligned.height() >= min.height) {
        NSArray<NSNumber*>* factors = [VTLowLatencySuperResolutionScalerConfiguration
            supportedScaleFactorsForFrameWidth:aligned.width()
                                   frameHeight:aligned.height()];
        for (NSNumber* factor in factors) {
          if (factor.floatValue <= ratio + 0.001f && factor.floatValue > plan.vt_factor) {
            plan.vt_factor = factor.floatValue;
          }
        }
        if (plan.vt_factor > 0 && vt_failed_ != aligned) {
          plan.vt_input = aligned;
          plan.vt_needs_pad = plan.region != gfx::Rect(plan.surface_size) ||
                              aligned != plan.surface_size;
        } else {
          plan.vt_factor = 0;
        }
      }
    }
    if (plan.vt_factor > 0) {
      plan.rgb_size = key.target;
    } else {
      plan.rgb_size = gfx::Size(static_cast<int>(std::ceil(key.crop.width())),
                                static_cast<int>(std::ceil(key.crop.height())));
    }
    plan.needs_metalfx = plan.vt_factor == 0 && plan.rgb_size != key.target;
    return plan;
  }

  API_AVAILABLE(macos(26.0))
  void RequestKit(const Plan& plan) {
    if ((kit_requested_ && *kit_requested_ == plan) || (kit_failed_ && *kit_failed_ == plan)) {
      return;
    }
    kit_requested_ = plan;
    if (setup_in_flight_) {
      return;
    }
    BuildNextKit();
  }

  API_AVAILABLE(macos(26.0))
  void BuildNextKit() {
    if (!kit_requested_ || !gate_open_) {
      kit_requested_.reset();
      return;
    }
    if (setup_worker_) {
      return;
    }
    const uint64_t setup = ++last_operation_;
    setup_in_flight_ = setup;
    auto cancel = std::make_shared<SetupCancel>();
    setup_worker_ = cancel;
    const Plan plan = *kit_requested_;
    AstroVideoUpscalerKit* previous = kit_;
    kit_ = nil;
    kit_plan_.reset();
    TRACE_EVENT_INSTANT2("gpu", "AstroVSR.Setup", TRACE_EVENT_SCOPE_THREAD, "factor",
                         plan.vt_factor, "target", plan.key.target.ToString());
    scoped_refptr<base::SequencedTaskRunner> reply_to = task_runner_;
    base::WeakPtr<Upscaler> weak = weak_factory_.GetWeakPtr();
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
      const base::TimeTicks started = base::TimeTicks::Now();
      auto box = std::make_unique<KitBox>();
      box->kit = BuildKit(previous, plan, *cancel);
      const base::TimeDelta took = base::TimeTicks::Now() - started;
      reply_to->PostTask(FROM_HERE, base::BindOnce(&Upscaler::KitBuilt, weak, setup, plan,
                                                   std::move(box), took));
    });
  }

  API_AVAILABLE(macos(26.0))
  void KitBuilt(uint64_t setup,
                Plan plan,
                std::unique_ptr<KitBox> box,
                base::TimeDelta took) {
    setup_worker_.reset();
    if (setup != setup_in_flight_) {
      TRACE_EVENT_INSTANT1("gpu", "AstroVSR.SetupDropped", TRACE_EVENT_SCOPE_THREAD, "built",
                           box->kit != nil);
      BuildNextKit();
      return;
    }
    setup_in_flight_ = 0;
    AstroVideoUpscalerKit* kit = box->kit;
    if (!gate_open_) {
      kit_requested_.reset();
      return;
    }
    TRACE_EVENT_INSTANT2("gpu", "AstroVSR.SetupDone", TRACE_EVENT_SCOPE_THREAD, "ok",
                         kit != nil, "ms", took.InMillisecondsF());
    if (!kit && plan.vt_factor > 0) {
      vt_failed_ = plan.vt_input;
    }
    if (kit_requested_ && !(*kit_requested_ == plan)) {
      kit_ = kit;
      BuildNextKit();
      return;
    }
    kit_requested_.reset();
    if (!kit) {
      kit_failed_ = plan;
      if (plan.vt_factor > 0) {
        on_upscaled_.Run();
      }
      return;
    }
    kit_ = kit;
    kit_plan_ = plan;
    on_upscaled_.Run();
  }

  base::apple::ScopedCFTypeRef<IOSurfaceRef> TakeOutputSurface(const gfx::Size& size) {
    if (output_size_ != size) {
      outputs_.clear();
      output_size_ = size;
    }
    for (auto& surface : outputs_) {
      if (!IOSurfaceIsInUse(surface.get()) && surface != cache_output_) {
        return surface;
      }
    }
    if (outputs_.size() >= kMaxOutputSurfaces) {
      return base::apple::ScopedCFTypeRef<IOSurfaceRef>();
    }
    outputs_.push_back(CreateOutputSurface(size));
    return outputs_.back();
  }

  API_AVAILABLE(macos(26.0))
  void Start(const VideoUpscaleCandidate& candidate, const Plan& plan) {
    const base::TimeTicks begin = base::TimeTicks::Now();
    base::apple::ScopedCFTypeRef<IOSurfaceRef> output = TakeOutputSurface(plan.key.target);
    if (!output) {
      return;
    }
    AstroVideoUpscalerKit* kit = kit_;
    IOSurfaceRef source = candidate.source;
    CopyColorTags(source, output.get(), candidate.color_space);
    const auto weights = *LumaWeights(source, candidate.color_space);
    const bool full_range =
        plan.key.format == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange;

    id<MTLCommandBuffer> buffer = [kit.queue commandBuffer];
    id<MTLTexture> output_texture =
        PlaneTexture(kit.device, output.get(), 0, MTLPixelFormatBGRA8Unorm,
                     MTLTextureUsageShaderWrite | MTLTextureUsageRenderTarget |
                         MTLTextureUsageShaderRead);
    id<MTLTexture> convert_target = plan.needs_metalfx ? kit.rgb : output_texture;

    IOSurfaceRef detail_source = nullptr;
    if (plan.vt_factor > 0) {
      CVPixelBufferRef vt_input = nullptr;
      if (plan.vt_needs_pad) {
        IOSurfaceRef padded = CVPixelBufferGetIOSurface(kit.paddedInput);
        id<MTLComputeCommandEncoder> encoder = [buffer computeCommandEncoder];
        [encoder setComputePipelineState:kit.pad];
        for (size_t plane = 0; plane < 2; ++plane) {
          const MTLPixelFormat format = plane ? MTLPixelFormatRG8Unorm : MTLPixelFormatR8Unorm;
          id<MTLTexture> from = PlaneTexture(kit.device, source, plane, format,
                                             MTLTextureUsageShaderRead);
          id<MTLTexture> to = PlaneTexture(kit.device, padded, plane, format,
                                           MTLTextureUsageShaderWrite);
          const int divisor = plane ? 2 : 1;
          simd_int4 crop = {plan.region.x() / divisor, plan.region.y() / divisor,
                            (plan.region.width() + divisor - 1) / divisor,
                            (plan.region.height() + divisor - 1) / divisor};
          [encoder setTexture:from atIndex:0];
          [encoder setTexture:to atIndex:1];
          [encoder setBytes:&crop length:sizeof(crop) atIndex:0];
          [encoder dispatchThreads:MTLSizeMake(to.width, to.height, 1)
              threadsPerThreadgroup:MTLSizeMake(16, 16, 1)];
        }
        [encoder endEncoding];
        vt_input = kit.paddedInput;
        CVPixelBufferRetain(vt_input);
      } else {
        CVPixelBufferCreateWithIOSurface(nullptr, source, nullptr, &vt_input);
      }
      if (!vt_input) {
        return;
      }
      VTFrameProcessorFrame* in_frame =
          [[VTFrameProcessorFrame alloc] initWithBuffer:vt_input
                                  presentationTimeStamp:CMTimeMake(frame_count_, 30)];
      VTFrameProcessorFrame* out_frame =
          [[VTFrameProcessorFrame alloc] initWithBuffer:kit.vtOutput
                                  presentationTimeStamp:CMTimeMake(frame_count_, 30)];
      CVPixelBufferRelease(vt_input);
      if (!in_frame || !out_frame) {
        return;
      }
      VTLowLatencySuperResolutionScalerParameters* parameters =
          [[VTLowLatencySuperResolutionScalerParameters alloc] initWithSourceFrame:in_frame
                                                                  destinationFrame:out_frame];
      [kit.processor processWithCommandBuffer:buffer parameters:parameters];
      detail_source = CVPixelBufferGetIOSurface(kit.vtOutput);
    }

    {
      id<MTLComputeCommandEncoder> encoder = [buffer computeCommandEncoder];
      [encoder setComputePipelineState:kit.convert];
      id<MTLTexture> luma = PlaneTexture(kit.device, source, 0, MTLPixelFormatR8Unorm,
                                         MTLTextureUsageShaderRead);
      id<MTLTexture> chroma = PlaneTexture(kit.device, source, 1, MTLPixelFormatRG8Unorm,
                                           MTLTextureUsageShaderRead);
      id<MTLTexture> detail =
          detail_source ? PlaneTexture(kit.device, detail_source, 0, MTLPixelFormatR8Unorm,
                                       MTLTextureUsageShaderRead)
                        : luma;
      ConvertParams params;
      params.matrix = YuvToRgbMatrix(weights.first, weights.second, full_range);
      params.origin = simd_make_float2(plan.key.crop.x(), plan.key.crop.y());
      params.scale = simd_make_float2(plan.key.crop.width() / (float)convert_target.width,
                                      plan.key.crop.height() / (float)convert_target.height);
      params.luma_size = simd_make_float2(luma.width, luma.height);
      params.detail_size = simd_make_float2(detail.width, detail.height);
      const float factor = plan.vt_factor > 0 ? plan.vt_factor : 1.0f;
      const gfx::PointF region_origin = plan.vt_needs_pad ? gfx::PointF(plan.region.origin())
                                                          : gfx::PointF();
      params.detail_offset =
          simd_make_float2((plan.key.crop.x() - region_origin.x()) * factor,
                           (plan.key.crop.y() - region_origin.y()) * factor);
      params.detail_scale =
          simd_make_float2(plan.key.crop.width() * factor / convert_target.width,
                           plan.key.crop.height() * factor / convert_target.height);
      params.chroma_scale = full_range ? 1.0f : 255.0f / 224.0f;
      params.use_detail = detail_source ? 1.0f : 0.0f;
      [encoder setTexture:luma atIndex:0];
      [encoder setTexture:chroma atIndex:1];
      [encoder setTexture:detail atIndex:2];
      [encoder setTexture:convert_target atIndex:3];
      [encoder setBytes:&params length:sizeof(params) atIndex:0];
      [encoder dispatchThreads:MTLSizeMake(convert_target.width, convert_target.height, 1)
          threadsPerThreadgroup:MTLSizeMake(16, 16, 1)];
      [encoder endEncoding];
    }

    if (plan.needs_metalfx) {
      kit.scaler.colorTexture = kit.rgb;
      kit.scaler.outputTexture = output_texture;
      kit.scaler.inputContentWidth = plan.rgb_size.width();
      kit.scaler.inputContentHeight = plan.rgb_size.height();
      [kit.scaler encodeToCommandBuffer:buffer];
    }

    auto job = std::make_shared<Job>();
    job->source.reset(source, base::scoped_policy::RETAIN);
    job->seed = IOSurfaceGetSeed(source);
    job->key = plan.key;
    job->output.reset(output.get(), base::scoped_policy::RETAIN);
    job->started = begin;
    job->encode = base::TimeTicks::Now() - begin;
    const uint64_t operation = ++last_operation_;
    job_in_flight_ = operation;
    job_in_flight_source_ = source;
    ++frame_count_;
    const uint64_t generation = generation_;
    const float factor = plan.vt_factor;
    scoped_refptr<base::SequencedTaskRunner> reply_to = task_runner_;
    base::WeakPtr<Upscaler> weak = weak_factory_.GetWeakPtr();
    AstroVideoUpscalerKit* keep_alive = kit;
    const base::TimeTicks started = job->started;
    [buffer addCompletedHandler:^(id<MTLCommandBuffer> completed) {
      const bool ok = completed.status == MTLCommandBufferStatusCompleted;
      const double gpu_ms = (completed.GPUEndTime - completed.GPUStartTime) * 1000;
      const double completed_ms = (base::TimeTicks::Now() - started).InMillisecondsF();
      (void)keep_alive;
      reply_to->PostTask(FROM_HERE, base::BindOnce(&Upscaler::JobDone, weak, operation,
                                                   generation, job, ok, gpu_ms, completed_ms,
                                                   factor));
    }];
    [buffer commit];
  }

  void JobDone(uint64_t operation,
               uint64_t generation,
               std::shared_ptr<Job> job,
               bool ok,
               double gpu_ms,
               double completed_ms,
               float factor) {
    if (operation == job_in_flight_) {
      job_in_flight_ = 0;
      job_in_flight_source_ = nullptr;
    }
    const base::TimeDelta took = base::TimeTicks::Now() - job->started;
    TRACE_EVENT_INSTANT("gpu", "AstroVSR.Job", "ok", ok, "factor", factor, "ms",
                        took.InMillisecondsF(), "gpu_ms", gpu_ms, "completed_ms", completed_ms, "encode_ms",
                        job->encode.InMillisecondsF(),
                        "source",
                        job->key.crop.size().ToString(), "target", job->key.target.ToString(),
                        "tags", SurfaceTags(job->source.get()), "space",
                        job->key.color_space.ToString());
    if (generation != generation_) {
      return;
    }
    if (!ok) {
      if (factor > 0) {
        vt_failed_ = kit_plan_ ? kit_plan_->vt_input : gfx::Size();
        kit_plan_.reset();
      }
      return;
    }
    const bool current = current_source_.get() == job->source.get() && current_key_ &&
                         *current_key_ == job->key;
    cache_source_.reset(job->source.get(), base::scoped_policy::RETAIN);
    cache_seed_ = job->seed;
    cache_key_ = job->key;
    cache_output_.reset(job->output.get(), base::scoped_policy::RETAIN);
    ++jobs_;
    if (!current) {
      ++misses_;
      TRACE_EVENT_INSTANT0("gpu", "AstroVSR.Miss", TRACE_EVENT_SCOPE_THREAD);
    }
    if (jobs_ >= kMissWindow) {
      if (misses_ >= kMissLimit) {
        disabled_ = job->key;
        TRACE_EVENT_INSTANT0("gpu", "AstroVSR.DisabledForVideo", TRACE_EVENT_SCOPE_THREAD);
      }
      jobs_ = 0;
      misses_ = 0;
    }
    on_upscaled_.Run();
  }

  void Forget() {
    current_source_.reset();
    current_key_.reset();
    if (!idle_timer_.IsRunning() && HoldsAnything()) {
      ArmIdleTeardown();
    }
  }

  bool HoldsAnything() const {
    return kit_ || kit_requested_ || setup_worker_ || job_in_flight_ || cache_output_ ||
           !outputs_.empty();
  }

  void CancelSetup() {
    if (setup_worker_) {
      setup_worker_->cancelled = true;
    }
    setup_in_flight_ = 0;
  }

  void ArmIdleTeardown() {
    idle_timer_.Start(FROM_HERE, kIdleTeardown,
                      base::BindOnce(&Upscaler::TearDown, base::Unretained(this)));
  }

  void TearDown() {
    TRACE_EVENT_INSTANT0("gpu", "AstroVSR.IdleWake", TRACE_EVENT_SCOPE_THREAD);
    if (!HoldsAnything()) {
      return;
    }
    TRACE_EVENT_INSTANT0("gpu", "AstroVSR.TearDown", TRACE_EVENT_SCOPE_THREAD);
    ++generation_;
    AstroVideoUpscalerKit* kit = kit_;
    kit_ = nil;
    if (kit) {
      dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        (void)kit;
      });
    }
    kit_plan_.reset();
    kit_requested_.reset();
    kit_failed_.reset();
    CancelSetup();
    job_in_flight_ = 0;
    job_in_flight_source_ = nullptr;
    cache_source_.reset();
    cache_output_.reset();
    cache_key_.reset();
    outputs_.clear();
    output_size_ = gfx::Size();
    active_.reset();
    vt_failed_ = gfx::Size();
    jobs_ = 0;
    misses_ = 0;
  }

  base::RepeatingClosure on_upscaled_;
  scoped_refptr<base::SequencedTaskRunner> task_runner_;
  uint64_t generation_ = 0;
  bool gate_open_ = false;
  AstroVideoUpscalerKit* __strong kit_ = nil;
  std::optional<Plan> kit_failed_;
  std::optional<Plan> kit_plan_;
  std::optional<Plan> kit_requested_;
  uint64_t last_operation_ = 0;
  uint64_t setup_in_flight_ = 0;
  std::shared_ptr<SetupCancel> setup_worker_;
  uint64_t job_in_flight_ = 0;
  IOSurfaceRef job_in_flight_source_ = nullptr;
  int64_t frame_count_ = 0;
  base::apple::ScopedCFTypeRef<IOSurfaceRef> current_source_;
  std::optional<VideoKey> current_key_;
  base::apple::ScopedCFTypeRef<IOSurfaceRef> cache_source_;
  uint32_t cache_seed_ = 0;
  std::optional<VideoKey> cache_key_;
  base::apple::ScopedCFTypeRef<IOSurfaceRef> cache_output_;
  std::vector<base::apple::ScopedCFTypeRef<IOSurfaceRef>> outputs_;
  gfx::Size output_size_;
  std::optional<VideoKey> active_;
  std::optional<VideoKey> disabled_;
  gfx::Size vt_failed_;
  int jobs_ = 0;
  int misses_ = 0;
  base::OneShotTimer idle_timer_;
  base::WeakPtrFactory<Upscaler> weak_factory_{this};
};

}

std::unique_ptr<VideoUpscaler> CreateVideoUpscaler(base::RepeatingClosure on_upscaled) {
  if (@available(macOS 26.0, *)) {
    return std::make_unique<Upscaler>(std::move(on_upscaled));
  }
  return nullptr;
}

}
