#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#include <string.h>

static BOOL yes(id self, SEL _cmd) { return YES; }
static NSRect unconstrained(id self, SEL _cmd, NSRect rect, NSScreen *screen) { return rect; }

static void force(Class c, const char *name) {
  SEL sel = sel_registerName(name);
  Method m = class_getInstanceMethod(c, sel);
  if (m) method_setImplementation(m, (IMP)yes);
  else class_addMethod(c, sel, (IMP)yes, "c@:");
}

__attribute__((constructor)) static void drawActive(void) {
  const char *name = getprogname();
  if (!name || strcmp(name, "Astro") != 0) return;
  Class w = [NSWindow class];
  force(w, "_hasActiveAppearance");
  force(w, "_hasActiveAppearanceIgnoringKeyFocus");
  force(w, "_hasKeyAppearance");
  force(w, "_hasMainAppearance");
  method_setImplementation(class_getInstanceMethod(w, @selector(constrainFrameRect:toScreen:)), (IMP)unconstrained);
}
