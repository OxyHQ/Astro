// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_gpu.h"

#include <sys/stat.h>
#include <sys/sysmacros.h>

#include <optional>
#include <string>
#include <vector>

#include "base/command_line.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/scoped_file.h"
#include "base/files/scoped_temp_dir.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/gl/gl_bindings.h"
#include "ui/ozone/platform/oxyos/oxyos_gl_ozone.h"
#include "ui/ozone/platform/oxyos/oxyos_surface_host.h"
#include "ui/ozone/public/ozone_switches.h"

namespace ui {

namespace {

uint64_t RenderNode(unsigned minor_number) {
  return makedev(226, minor_number);
}

}

TEST(OxyOSGpuTest, NoRenderNodeIsOpenedWhenNoneIsNamed) {
  EXPECT_FALSE(OxyOSOpenRenderNode(base::FilePath()).is_valid());
}

TEST(OxyOSGpuTest, OnlyTheNamedRenderNodeIsOpened) {
  base::ScopedFD node = OxyOSOpenRenderNode(base::FilePath("/dev/null"));
  ASSERT_TRUE(node.is_valid());
  struct stat opened;
  struct stat named;
  ASSERT_EQ(fstat(node.get(), &opened), 0);
  ASSERT_EQ(stat("/dev/null", &named), 0);
  EXPECT_EQ(opened.st_rdev, named.st_rdev);
}

TEST(OxyOSGpuTest, ANamedRenderNodeThatFailsLeavesNoneOpen) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const base::FilePath file = directory.GetPath().Append("renderD128");
  ASSERT_TRUE(base::WriteFile(file, ""));
  EXPECT_FALSE(OxyOSOpenRenderNode(file).is_valid());
  EXPECT_FALSE(
      OxyOSOpenRenderNode(directory.GetPath().Append("renderD129")).is_valid());
}

TEST(OxyOSGpuTest, TheVulkanDriversLoadedAreTheRenderNodesOwn) {
  EXPECT_EQ(OxyOSVulkanDriversFor("i915"), "*intel*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("xe"), "*intel*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("amdgpu"), "*radeon*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("nouveau"), "*nouveau*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("virtio_gpu"),
            "*virtio*,*gfxstream*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("msm"), "*freedreno*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("panthor"), "*panfrost*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("v3d"), "*broadcom*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("asahi"), "*asahi*,*swiftshader*");
  EXPECT_EQ(OxyOSVulkanDriversFor("nvidia"), "*nvidia*,*swiftshader*");
}

TEST(OxyOSGpuTest, NoHardwareVulkanDriverLoadsWithoutAKnownRenderNode) {
  for (const char* driver : {"", "radeon", "nvidia-drm", "vgem", "i9"}) {
    EXPECT_EQ(OxyOSVulkanDriversFor(driver), "*lvp*,*swiftshader*") << driver;
  }
}

TEST(OxyOSGpuTest, GLDrawsOnlyOnTheCompositorsRenderNode) {
  const std::vector<OxyOSEGLDevice> devices = {
      {RenderNode(128), false}, {RenderNode(129), false}, {std::nullopt, true}};
  EXPECT_EQ(OxyOSChooseEGLDevice(devices, RenderNode(129)), 1u);
  EXPECT_EQ(OxyOSChooseEGLDevice(devices, RenderNode(128)), 0u);
  EXPECT_EQ(OxyOSChooseEGLDevice(devices, RenderNode(130)), std::nullopt);
}

TEST(OxyOSGpuTest, GLWithoutARenderNodeDrawsInSoftwareOrNotAtAll) {
  const std::vector<OxyOSEGLDevice> devices = {
      {RenderNode(128), false}, {RenderNode(129), false}, {std::nullopt, true}};
  EXPECT_EQ(OxyOSChooseEGLDevice(devices, 0), 2u);
  EXPECT_EQ(OxyOSChooseEGLDevice({devices[0], devices[1]}, 0), std::nullopt);
  EXPECT_EQ(OxyOSChooseEGLDevice({{std::nullopt, true}}, RenderNode(129)),
            std::nullopt);
}

TEST(OxyOSGpuTest, ANGLEsGLBackendTakesTheGivenEGLDevice) {
  OxyOSGLEGLUtility utility;
  std::vector<EGLAttrib> attributes;
  utility.GetAdditionalEGLAttributes(EGL_PLATFORM_ANGLE_TYPE_OPENGL_ANGLE,
                                     &attributes);
  EXPECT_EQ(attributes,
            (std::vector<EGLAttrib>{
                EGL_PLATFORM_ANGLE_NATIVE_PLATFORM_TYPE_ANGLE,
                EGL_PLATFORM_DEVICE_EXT, EGL_PLATFORM_ANGLE_DEVICE_TYPE_ANGLE,
                EGL_PLATFORM_ANGLE_DEVICE_TYPE_EGL_ANGLE}));

  attributes = {EGL_PLATFORM_ANGLE_DEVICE_TYPE_ANGLE,
                EGL_PLATFORM_ANGLE_DEVICE_TYPE_EGL_ANGLE};
  utility.GetAdditionalEGLAttributes(EGL_PLATFORM_ANGLE_TYPE_OPENGLES_ANGLE,
                                     &attributes);
  EXPECT_EQ(attributes, (std::vector<EGLAttrib>{
                            EGL_PLATFORM_ANGLE_DEVICE_TYPE_ANGLE,
                            EGL_PLATFORM_ANGLE_DEVICE_TYPE_EGL_ANGLE,
                            EGL_PLATFORM_ANGLE_NATIVE_PLATFORM_TYPE_ANGLE,
                            EGL_PLATFORM_DEVICE_EXT}));
}

TEST(OxyOSGpuTest, OtherANGLEBackendsKeepTheirAttributes) {
  OxyOSGLEGLUtility utility;
  std::vector<EGLAttrib> attributes;
  utility.GetAdditionalEGLAttributes(EGL_PLATFORM_ANGLE_TYPE_VULKAN_ANGLE,
                                     &attributes);
  EXPECT_TRUE(attributes.empty());
  attributes = {EGL_PLATFORM_ANGLE_DEVICE_TYPE_ANGLE,
                EGL_PLATFORM_ANGLE_DEVICE_TYPE_NULL_ANGLE};
  utility.GetAdditionalEGLAttributes(EGL_PLATFORM_ANGLE_TYPE_OPENGL_ANGLE,
                                     &attributes);
  EXPECT_EQ(attributes.size(), 2u);
}

TEST(OxyOSGpuTest, TheGpuProcessIsAlwaysToldWhichRenderNodeIsItsOwn) {
  base::CommandLine command_line(base::CommandLine::NO_PROGRAM);
  command_line.AppendSwitchPath(switches::kRenderNodeOverride,
                                base::FilePath("/dev/dri/renderD128"));
  OxyOSNameRenderNode(base::FilePath(), &command_line);
  EXPECT_TRUE(command_line.HasSwitch(switches::kRenderNodeOverride));
  EXPECT_TRUE(
      command_line.GetSwitchValuePath(switches::kRenderNodeOverride).empty());

  OxyOSNameRenderNode(base::FilePath("/dev/dri/renderD129"), &command_line);
  EXPECT_EQ(command_line.GetSwitchValuePath(switches::kRenderNodeOverride),
            base::FilePath("/dev/dri/renderD129"));
  EXPECT_EQ(command_line.argv().size(), 2u);
}

}
