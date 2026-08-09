// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_webui_dev_source.h"

#include <string>
#include <utility>

#include "base/command_line.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/ref_counted_memory.h"
#include "base/strings/escape.h"
#include "base/strings/strcat.h"
#include "content/public/browser/web_ui_data_source.h"

namespace astro {

namespace {

// Serves the Astro WebUI pages from this directory instead of from the .pak.
constexpr char kAstroWebUIDirSwitch[] = "astro-webui-dir";

// The document a request resolves to when it names no file of its own. An
// Astro page is a single-page app: every route it owns is served by the same
// document and routed client-side.
constexpr char kIndexDocument[] = "index.html";

// Strips the query and fragment a WebUI request can still carry, and refuses
// anything that could climb out of the served directory.
//
// Returns false for a path that must not be served. A traversal attempt is a
// refusal, never a normalisation: silently rewriting `../../etc/passwd` into
// something servable is how a path check becomes a path bug.
bool ResolveRequestPath(const std::string& requested, std::string* out) {
  std::string path = requested.substr(0, requested.find_first_of("?#"));
  if (path.empty()) {
    path = kIndexDocument;
  }
  if (path.find("..") != std::string::npos || path.front() == '/') {
    return false;
  }
  *out = std::move(path);
  return true;
}

// A page that says what is missing, instead of a blank one that does not.
//
// The body is deliberately plain HTML with no script and no external
// reference, so it renders under the page's own CSP whatever that page
// declared.
std::string MissingResourceDocument(std::string_view host,
                                    const base::FilePath& path) {
  return base::StrCat({
      "<!doctype html><meta charset=\"utf-8\">"
      "<title>Astro: page assets missing</title>"
      "<body style=\"font:14px system-ui;padding:2rem\">"
      "<h1>This Astro page has no assets to serve.</h1>"
      "<p>The controller for <code>",
      base::EscapeForHTML(host),
      "</code> asked for a file that is not in the directory "
      "<code>--astro-webui-dir</code> names:</p><p><code>",
      base::EscapeForHTML(path.AsUTF8Unsafe()),
      "</code></p>"
      "<p>This build serves Astro's WebUI from disk because it was configured "
      "with <code>astro_webui_dev_tools = true</code> and started with "
      "<code>--astro-webui-dir</code>. Build the app "
      "(<code>cd webui/app &amp;&amp; bun run build</code>) or drop the switch "
      "to go back to the compiled-in resources.</p>",
  });
}

void ServeFromDirectory(base::FilePath directory,
                        std::string host,
                        const std::string& requested_path,
                        content::WebUIDataSource::GotDataCallback callback) {
  std::string relative;
  if (!ResolveRequestPath(requested_path, &relative)) {
    LOG(ERROR) << "Astro: refusing WebUI request for '" << requested_path
               << "' on host '" << host << "': not a path inside the page";
    std::move(callback).Run(nullptr);
    return;
  }

  base::FilePath file = directory.AppendASCII(relative);
  std::string contents;
  if (!base::ReadFileToString(file, &contents)) {
    // A path with no extension is a client-side route, not a file. Serving the
    // document for it is what makes deep links work.
    const bool is_document =
        relative == kIndexDocument || relative.find('.') == std::string::npos;
    if (!is_document) {
      LOG(ERROR) << "Astro: host '" << host << "' cannot read " << file
                 << " for request '" << requested_path << "'";
      std::move(callback).Run(nullptr);
      return;
    }
    file = directory.AppendASCII(kIndexDocument);
    if (!base::ReadFileToString(file, &contents)) {
      LOG(ERROR) << "Astro: host '" << host << "' has no document to serve. "
                 << "Tried " << file << " for request '" << requested_path
                 << "'.";
      std::move(callback).Run(base::MakeRefCounted<base::RefCountedString>(
          MissingResourceDocument(host, file)));
      return;
    }
  }

  std::move(callback).Run(
      base::MakeRefCounted<base::RefCountedString>(std::move(contents)));
}

}  // namespace

void MaybeServeAstroWebUIFromDirectory(content::WebUIDataSource* source,
                                       std::string_view host) {
  const base::CommandLine& command_line =
      *base::CommandLine::ForCurrentProcess();
  if (!command_line.HasSwitch(kAstroWebUIDirSwitch)) {
    return;
  }

  const base::FilePath directory =
      command_line.GetSwitchValuePath(kAstroWebUIDirSwitch);
  LOG(WARNING) << "Astro: serving WebUI host '" << host << "' from "
               << directory << " instead of the compiled-in resources, "
               << "because --" << kAstroWebUIDirSwitch << " was passed.";

  // Installed after AddResourcePaths, so it takes precedence: a request filter
  // that claims every path is consulted before the resource map.
  source->SetRequestFilter(
      base::BindRepeating([](const std::string&) { return true; }),
      base::BindRepeating(&ServeFromDirectory, directory, std::string(host)));
}

}  // namespace astro
