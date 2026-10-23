// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_DOWNLOADS_H_
#define CHROME_BROWSER_ASTRO_AC_DOWNLOADS_H_

#include "chrome/browser/astro/ac_engine.h"

AC_ENGINE_CALL(ac_downloads_list);
AC_ENGINE_CALL(ac_downloads_cancel);
AC_ENGINE_CALL(ac_downloads_pause);
AC_ENGINE_CALL(ac_downloads_resume);
AC_ENGINE_CALL(ac_downloads_keep);
AC_ENGINE_CALL(ac_downloads_remove);

#endif
