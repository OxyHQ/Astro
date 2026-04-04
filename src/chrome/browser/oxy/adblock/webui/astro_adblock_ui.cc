// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/webui/astro_adblock_ui.h"

#include "chrome/browser/oxy/adblock/webui/astro_adblock_ui_handler.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"

namespace oxy::adblock {

namespace {

constexpr char kAdBlockHost[] = "adblock";

void CreateAndAddHTMLSource(content::WebUI* web_ui) {
  content::WebUIDataSource* source =
      content::WebUIDataSource::CreateAndAdd(
          web_ui->GetWebContents()->GetBrowserContext(), kAdBlockHost);

  // Inline the HTML page directly since it's a simple settings page.
  source->SetDefaultResource(IDR_ASTRO_ADBLOCK_HTML);

  // Allow inline scripts for the embedded JavaScript.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline';");
}

// Since we bundle the HTML inline rather than using grit resources,
// we create the data source with raw string content.
void CreateAndAddInlineSource(content::WebUI* web_ui) {
  content::WebUIDataSource* source =
      content::WebUIDataSource::CreateAndAdd(
          web_ui->GetWebContents()->GetBrowserContext(), kAdBlockHost);

  // The main page HTML is served inline.
  static constexpr char kPageHTML[] = R"html(
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Astro Ad Blocker Settings</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --surface: #16213e;
      --surface2: #0f3460;
      --text: #e0e0e0;
      --text-secondary: #a0a0b0;
      --accent: #00d4aa;
      --accent-hover: #00f5c4;
      --danger: #e94560;
      --border: #2a2a4a;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .subtitle {
      color: var(--text-secondary);
      margin-bottom: 32px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .card h2 {
      font-size: 18px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
    }
    .toggle-row + .toggle-row {
      border-top: 1px solid var(--border);
    }
    .toggle-label { flex: 1; }
    .toggle-label .name { font-weight: 500; }
    .toggle-label .desc {
      font-size: 13px;
      color: var(--text-secondary);
    }
    .toggle {
      position: relative;
      width: 48px;
      height: 26px;
      flex-shrink: 0;
      margin-left: 16px;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle .slider {
      position: absolute;
      inset: 0;
      background: var(--border);
      border-radius: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toggle .slider::before {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .toggle input:checked + .slider {
      background: var(--accent);
    }
    .toggle input:checked + .slider::before {
      transform: translateX(22px);
    }
    .site-list {
      list-style: none;
    }
    .site-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .site-list li:last-child { border-bottom: none; }
    .btn-remove {
      background: none;
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-remove:hover {
      background: var(--danger);
      color: white;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      font-size: 13px;
      resize: vertical;
    }
    textarea:focus { outline: 2px solid var(--accent); border-color: transparent; }
    .btn-primary {
      background: var(--accent);
      color: var(--bg);
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 12px;
    }
    .btn-primary:hover { background: var(--accent-hover); }
    .stats {
      display: flex;
      gap: 20px;
      margin-bottom: 24px;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      flex: 1;
      text-align: center;
    }
    .stat .number {
      font-size: 32px;
      font-weight: 700;
      color: var(--accent);
    }
    .stat .label {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .empty { color: var(--text-secondary); font-style: italic; padding: 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Astro Ad Blocker</h1>
    <p class="subtitle">Built-in protection against ads, trackers, and annoyances.</p>

    <div class="stats">
      <div class="stat">
        <div class="number" id="total-blocked">-</div>
        <div class="label">Ads &amp; trackers blocked</div>
      </div>
      <div class="stat">
        <div class="number" id="lists-active">2</div>
        <div class="label">Filter lists active</div>
      </div>
    </div>

    <div class="card">
      <h2>Filter Lists</h2>
      <div class="toggle-row">
        <div class="toggle-label">
          <div class="name">EasyList</div>
          <div class="desc">Primary ad blocking rules (~90,000 filters)</div>
        </div>
        <label class="toggle">
          <input type="checkbox" checked disabled>
          <span class="slider"></span>
        </label>
      </div>
      <div class="toggle-row">
        <div class="toggle-label">
          <div class="name">EasyPrivacy</div>
          <div class="desc">Tracker and analytics blocking (~56,000 filters)</div>
        </div>
        <label class="toggle">
          <input type="checkbox" checked disabled>
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <div class="card">
      <h2>Disabled Sites</h2>
      <p class="desc" style="color: var(--text-secondary); margin-bottom: 12px;">
        Sites where ad blocking has been turned off.
      </p>
      <ul class="site-list" id="site-exceptions">
        <li class="empty">No exceptions — ad blocking is active on all sites.</li>
      </ul>
    </div>

    <div class="card">
      <h2>Custom Rules</h2>
      <p class="desc" style="color: var(--text-secondary); margin-bottom: 12px;">
        Add custom filter rules in EasyList/AdBlock Plus syntax (one per line).
      </p>
      <textarea id="custom-rules" placeholder="||example.com/ads/*&#10;example.com##.ad-banner&#10;@@||example.com/important.js"></textarea>
      <button class="btn-primary" id="save-rules">Save Custom Rules</button>
    </div>
  </div>

  <script>
    // Communication with the browser process via chrome.send().
    function initialize() {
      // Request current state from browser.
      if (window.chrome && chrome.send) {
        chrome.send('getAdBlockState');
      }
    }

    function onAdBlockState(state) {
      if (state.siteOverrides) {
        const list = document.getElementById('site-exceptions');
        list.innerHTML = '';
        const sites = Object.entries(state.siteOverrides)
          .filter(([, enabled]) => !enabled);
        if (sites.length === 0) {
          list.innerHTML = '<li class="empty">No exceptions — ad blocking is active on all sites.</li>';
        } else {
          for (const [site] of sites) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${site}</span>`;
            const btn = document.createElement('button');
            btn.className = 'btn-remove';
            btn.textContent = 'Remove';
            btn.addEventListener('click', () => {
              if (chrome.send) chrome.send('removeSiteOverride', [site]);
            });
            li.appendChild(btn);
            list.appendChild(li);
          }
        }
      }
      if (state.customRules) {
        document.getElementById('custom-rules').value = state.customRules;
      }
    }

    document.getElementById('save-rules').addEventListener('click', () => {
      const rules = document.getElementById('custom-rules').value;
      if (window.chrome && chrome.send) {
        chrome.send('saveCustomRules', [rules]);
      }
    });

    document.addEventListener('DOMContentLoaded', initialize);
  </script>
</body>
</html>
  )html";

  source->AddResourcePath("", "adblock.html");

  // Override the default resource with our inline HTML.
  source->SetDefaultResource(-1);  // No grit resource, we use RequestFilter.

  source->SetRequestFilter(
      base::BindRepeating(
          [](const std::string& path) -> bool { return true; }),
      base::BindRepeating(
          [](const std::string& path,
             content::WebUIDataSource::GotDataCallback callback) {
            std::string html(kPageHTML);
            auto bytes = base::MakeRefCounted<base::RefCountedString>(
                std::move(html));
            std::move(callback).Run(bytes);
          }));

  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline';");
}

}  // namespace

AstroAdBlockUI::AstroAdBlockUI(content::WebUI* web_ui)
    : content::WebUIController(web_ui) {
  CreateAndAddInlineSource(web_ui);

  web_ui->AddMessageHandler(std::make_unique<AstroAdBlockUIHandler>());
}

AstroAdBlockUI::~AstroAdBlockUI() = default;

AstroAdBlockUIConfig::AstroAdBlockUIConfig()
    : content::DefaultWebUIConfig<AstroAdBlockUI>(
          content::kChromeUIScheme,
          kAdBlockHost) {}

}  // namespace oxy::adblock
