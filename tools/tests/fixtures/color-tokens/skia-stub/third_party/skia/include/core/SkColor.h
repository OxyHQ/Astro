// A stand-in for Skia's third_party/skia/include/core/SkColor.h, for the
// build-safety suite only.
//
// The suite runs with no Chromium checkout, so the real header is not on disk;
// without a substitute, the generated colour table could not be compiled at all
// and "is this valid C++" would go unasked until somebody's first full build.
//
// It substitutes through the include path rather than through a macro: the
// generated header includes Skia's real path unconditionally, exactly as it
// will in a Chromium build, and the check simply puts this directory ahead of
// it on -I. So the file under test is the file that ships — no build-only
// variant of it exists, and there is nothing for the two configurations to
// disagree about.
//
// Only what the generated table uses is declared. SkColor is a 32-bit ARGB
// value in Skia and here; the alpha byte is the most significant one, which is
// the whole reason the conversion in tools/generate-color-mixer.py exists.

#ifndef ASTRO_TEST_FIXTURE_SKCOLOR_H_
#define ASTRO_TEST_FIXTURE_SKCOLOR_H_

#include <cstdint>

typedef uint32_t SkColor;

#endif  // ASTRO_TEST_FIXTURE_SKCOLOR_H_
