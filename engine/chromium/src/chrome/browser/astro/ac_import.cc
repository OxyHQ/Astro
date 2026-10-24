// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_import.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <tuple>
#include <utility>
#include <vector>

#include "base/base64.h"
#include "base/base_paths.h"
#include "base/containers/span.h"
#include "base/files/file_enumerator.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/scoped_temp_dir.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/memory/scoped_refptr.h"
#include "base/no_destructor.h"
#include "base/numerics/byte_conversions.h"
#include "base/path_service.h"
#include "base/pickle.h"
#include "base/strings/cstring_view.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_split.h"
#include "base/strings/stringprintf.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "base/synchronization/lock.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "build/build_config.h"
#include "sql/database.h"
#include "sql/statement.h"
#include "third_party/boringssl/src/include/openssl/aead.h"
#include "third_party/boringssl/src/include/openssl/cipher.h"
#include "third_party/boringssl/src/include/openssl/evp.h"

#if BUILDFLAG(IS_LINUX)
#include "base/environment.h"
#include "base/nix/xdg_util.h"
#include "base/process/launch.h"
#endif

#if BUILDFLAG(IS_WIN)
#include <windows.h>

#include <wincrypt.h>

#include "base/environment.h"
#include "base/win/scoped_localalloc.h"
#endif

namespace astro {

namespace {

using Done = base::OnceCallback<void(base::DictValue)>;
using Event = base::RepeatingCallback<void(base::DictValue)>;

struct ImportError {
  std::string code;
  std::string message;
};

base::DictValue ErrorReply(const std::string& code, const std::string& message) {
  base::DictValue error;
  error.Set("code", code);
  error.Set("message", message);
  base::DictValue reply;
  reply.Set("error", std::move(error));
  return reply;
}

base::DictValue JsonReply(const base::ValueView& value) {
  base::DictValue reply;
  reply.Set("json", base::WriteJson(value).value_or("null"));
  return reply;
}

std::optional<double> FromWebKit(int64_t micros) {
  if (micros <= 0) {
    return std::nullopt;
  }
  return static_cast<double>(micros - 11644473600000000) / 1000.0;
}

std::optional<double> FromWebKitString(const std::string* text) {
  int64_t micros = 0;
  if (!text || !base::StringToInt64(*text, &micros)) {
    return std::nullopt;
  }
  return FromWebKit(micros);
}

std::optional<double> FromUnixMicros(int64_t micros) {
  if (micros <= 0) {
    return std::nullopt;
  }
  return static_cast<double>(micros) / 1000.0;
}

std::string HexColor(int sk_color) {
  uint32_t v = static_cast<uint32_t>(sk_color);
  return base::StringPrintf("#%02X%02X%02X", (v >> 16) & 0xFF, (v >> 8) & 0xFF,
                            v & 0xFF);
}

bool IsWebUrl(std::string_view url) {
  return base::StartsWith(url, "http://",
                          base::CompareCase::INSENSITIVE_ASCII) ||
         base::StartsWith(url, "https://",
                          base::CompareCase::INSENSITIVE_ASCII);
}

#if BUILDFLAG(IS_LINUX)
std::vector<uint8_t> DeriveCbcKey(base::span<const uint8_t> secret) {
  std::vector<uint8_t> key(16);
  static constexpr uint8_t kSalt[] = {'s', 'a', 'l', 't', 'y',
                                      's', 'a', 'l', 't'};
  if (!PKCS5_PBKDF2_HMAC_SHA1(reinterpret_cast<const char*>(secret.data()),
                              secret.size(), kSalt, sizeof(kSalt), 1,
                              key.size(), key.data())) {
    return {};
  }
  return key;
}
#endif

std::optional<std::string> AesCbcDecrypt(base::span<const uint8_t> key,
                                         base::span<const uint8_t> body) {
  if (key.size() != 16 || body.empty() || body.size() % 16 != 0) {
    return std::nullopt;
  }
  std::array<uint8_t, 16> iv;
  iv.fill(0x20);
  bssl::UniquePtr<EVP_CIPHER_CTX> ctx(EVP_CIPHER_CTX_new());
  if (!ctx) {
    return std::nullopt;
  }
  if (!EVP_DecryptInit_ex(ctx.get(), EVP_aes_128_cbc(), nullptr, key.data(),
                          iv.data())) {
    return std::nullopt;
  }
  std::vector<uint8_t> out(body.size() + 16);
  int len = 0;
  if (!EVP_DecryptUpdate(ctx.get(), out.data(), &len, body.data(),
                         static_cast<int>(body.size()))) {
    return std::nullopt;
  }
  int final_len = 0;
  if (!EVP_DecryptFinal_ex(ctx.get(), out.data() + len, &final_len)) {
    return std::nullopt;
  }
  return std::string(reinterpret_cast<char*>(out.data()), len + final_len);
}

std::optional<std::string> AesGcmOpen(base::span<const uint8_t> key,
                                      base::span<const uint8_t> after_prefix) {
  if (key.size() != 32 || after_prefix.size() < 12 + 16) {
    return std::nullopt;
  }
  base::span<const uint8_t> nonce = after_prefix.first(12u);
  base::span<const uint8_t> in = after_prefix.subspan(12u);
  bssl::ScopedEVP_AEAD_CTX ctx;
  if (!EVP_AEAD_CTX_init(ctx.get(), EVP_aead_aes_256_gcm(), key.data(),
                         key.size(), 16, nullptr)) {
    return std::nullopt;
  }
  std::vector<uint8_t> out(in.size());
  size_t out_len = 0;
  if (!EVP_AEAD_CTX_open(ctx.get(), out.data(), &out_len, out.size(),
                         nonce.data(), nonce.size(), in.data(), in.size(),
                         nullptr, 0)) {
    return std::nullopt;
  }
  return std::string(reinterpret_cast<char*>(out.data()), out_len);
}

enum class Family { kChromium, kFirefox, kArc };

const char* FamilyName(Family family) {
  switch (family) {
    case Family::kChromium:
      return "chromium";
    case Family::kFirefox:
      return "firefox";
    case Family::kArc:
      return "arc";
  }
  return "chromium";
}

struct Def {
  std::string id;
  std::string name;
  Family family;
  std::string linux_path;
  std::string win_path;
  bool win_appdata = false;
  bool root_is_profile = false;
  bool win_only = false;
  bool arc_package = false;
  std::vector<std::string> secret_apps;
};

std::vector<Def> Definitions() {
  std::vector<Def> defs;
  auto chromium = [&](const std::string& id, const std::string& name,
                      const std::string& lin, const std::string& win,
                      std::vector<std::string> apps, bool root = false,
                      bool appdata = false) {
    Def d;
    d.id = id;
    d.name = name;
    d.family = Family::kChromium;
    d.linux_path = lin;
    d.win_path = win;
    d.win_appdata = appdata;
    d.root_is_profile = root;
    d.secret_apps = std::move(apps);
    defs.push_back(std::move(d));
  };
  chromium("chrome", "Google Chrome", "google-chrome",
           "Google/Chrome/User Data", {"chrome", "chromium"});
  chromium("chromeBeta", "Google Chrome Beta", "google-chrome-beta",
           "Google/Chrome Beta/User Data", {"chrome", "chromium"});
  chromium("chromeDev", "Google Chrome Dev", "google-chrome-unstable",
           "Google/Chrome Dev/User Data", {"chrome", "chromium"});
  chromium("chromeCanary", "Google Chrome Canary", "",
           "Google/Chrome SxS/User Data", {"chrome", "chromium"});
  chromium("chromium", "Chromium", "chromium", "Chromium/User Data",
           {"chromium"});
  chromium("edge", "Microsoft Edge", "microsoft-edge",
           "Microsoft/Edge/User Data", {"chromium", "Microsoft Edge"});
  chromium("brave", "Brave", "BraveSoftware/Brave-Browser",
           "BraveSoftware/Brave-Browser/User Data", {"brave", "chromium"});
  chromium("vivaldi", "Vivaldi", "vivaldi", "Vivaldi/User Data",
           {"vivaldi", "chromium"});
  chromium("opera", "Opera", "opera", "Opera Software/Opera Stable",
           {"opera", "chromium"}, true, true);
  chromium("operaGX", "Opera GX", "opera-gx", "Opera Software/Opera GX Stable",
           {"opera", "chromium"}, true, true);
  chromium("helium", "Helium", "net.imput.helium", "Helium/User Data",
           {"chromium"});

  Def arc;
  arc.id = "arc";
  arc.name = "Arc";
  arc.family = Family::kArc;
  arc.win_only = true;
  arc.arc_package = true;
  arc.secret_apps = {};
  defs.push_back(std::move(arc));

  Def firefox;
  firefox.id = "firefox";
  firefox.name = "Firefox";
  firefox.family = Family::kFirefox;
  defs.push_back(std::move(firefox));

  return defs;
}

const Def* FindDef(const std::string& id) {
  static const base::NoDestructor<std::vector<Def>> defs(Definitions());
  for (const Def& d : *defs) {
    if (d.id == id) {
      return &d;
    }
  }
  return nullptr;
}

#if BUILDFLAG(IS_LINUX)
base::FilePath HomeDir() {
  base::FilePath home;
  base::PathService::Get(base::DIR_HOME, &home);
  return home;
}

base::FilePath ConfigDir() {
  std::unique_ptr<base::Environment> env = base::Environment::Create();
  return base::nix::GetXDGDirectory(env.get(), "XDG_CONFIG_HOME", ".config");
}
#endif

#if BUILDFLAG(IS_WIN)
base::FilePath EnvDir(base::cstring_view name) {
  std::unique_ptr<base::Environment> env = base::Environment::Create();
  std::optional<std::string> value = env->GetVar(name);
  if (!value || value->empty()) {
    return base::FilePath();
  }
  return base::FilePath::FromUTF8Unsafe(*value);
}
#endif

base::FilePath AppendRelative(base::FilePath base, std::string_view relative) {
  for (std::string_view part : base::SplitStringPiece(
           relative, "/", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY)) {
    base = base.AppendASCII(part);
  }
  return base;
}

base::FilePath FirefoxRoot() {
#if BUILDFLAG(IS_WIN)
  base::FilePath appdata = EnvDir("APPDATA");
  return appdata.empty() ? base::FilePath()
                         : AppendRelative(appdata, "Mozilla/Firefox");
#elif BUILDFLAG(IS_LINUX)
  base::FilePath native = AppendRelative(HomeDir(), ".mozilla/firefox");
  if (base::PathExists(native.AppendASCII("profiles.ini"))) {
    return native;
  }
  base::FilePath snap =
      AppendRelative(HomeDir(), "snap/firefox/common/.mozilla/firefox");
  if (base::PathExists(snap.AppendASCII("profiles.ini"))) {
    return snap;
  }
  return native;
#else
  return base::FilePath();
#endif
}

base::FilePath ArcUserData() {
#if BUILDFLAG(IS_WIN)
  base::FilePath local = EnvDir("LOCALAPPDATA");
  if (local.empty()) {
    return base::FilePath();
  }
  base::FilePath packages = local.AppendASCII("Packages");
  base::FileEnumerator dirs(packages, false,
                            base::FileEnumerator::DIRECTORIES);
  for (base::FilePath dir = dirs.Next(); !dir.empty(); dir = dirs.Next()) {
    if (base::StartsWith(dir.BaseName().AsUTF8Unsafe(),
                         "TheBrowserCompany.Arc_")) {
      return AppendRelative(dir, "LocalCache/Local/Arc/User Data");
    }
  }
  return base::FilePath();
#else
  return base::FilePath();
#endif
}

base::FilePath DataDir(const Def& def) {
  if (def.family == Family::kFirefox) {
    return FirefoxRoot();
  }
  if (def.family == Family::kArc) {
    return ArcUserData();
  }
#if BUILDFLAG(IS_WIN)
  base::FilePath root =
      def.win_appdata ? EnvDir("APPDATA") : EnvDir("LOCALAPPDATA");
  if (root.empty() || def.win_path.empty()) {
    return base::FilePath();
  }
  return AppendRelative(root, def.win_path);
#elif BUILDFLAG(IS_LINUX)
  if (def.win_only || def.linux_path.empty()) {
    return base::FilePath();
  }
  return AppendRelative(ConfigDir(), def.linux_path);
#else
  return base::FilePath();
#endif
}

base::FilePath ProfileDir(const Def& def, const std::string& profile_id) {
  base::FilePath root = DataDir(def);
  if (root.empty()) {
    return base::FilePath();
  }
  if (profile_id == ".") {
    return root;
  }
  base::FilePath dir = AppendRelative(root, profile_id);
  if (dir.ReferencesParent()) {
    return base::FilePath();
  }
  return dir;
}

bool FileThere(const base::FilePath& dir, std::string_view name) {
  return base::PathExists(AppendRelative(dir, name));
}

bool IsProfileDir(const base::FilePath& dir) {
  return FileThere(dir, "Preferences") || FileThere(dir, "Bookmarks") ||
         FileThere(dir, "History") || FileThere(dir, "Login Data");
}

base::FilePath LatestSessionFile(const base::FilePath& profile);

std::vector<std::string> ChromiumKinds(const base::FilePath& dir, bool arc) {
  std::vector<std::string> kinds;
  if (FileThere(dir, "Bookmarks") || FileThere(dir, "AccountBookmarks")) {
    kinds.push_back("bookmarks");
  }
  if (FileThere(dir, "History")) {
    kinds.push_back("history");
  }
  if (!arc && !LatestSessionFile(dir).empty()) {
    kinds.push_back("tabs");
  }
  if (FileThere(dir, "Login Data") || FileThere(dir, "Login Data For Account")) {
    kinds.push_back("passwords");
  }
  return kinds;
}

struct DiscoveredProfile {
  std::string id;
  std::string name;
  std::string path;
  std::optional<std::string> email;
  std::optional<std::string> avatar_path;
  std::optional<std::string> color;
  bool is_default = false;
  std::vector<std::string> available;
};

std::vector<DiscoveredProfile> ChromiumProfiles(const Def& def) {
  std::vector<DiscoveredProfile> out;
  base::FilePath root = DataDir(def);
  if (root.empty() || !base::PathExists(root)) {
    return out;
  }

  base::DictValue info_cache;
  std::vector<std::string> order;
  std::string last_used;
  std::string local_state;
  if (base::ReadFileToString(root.AppendASCII("Local State"), &local_state)) {
    std::optional<base::DictValue> top = base::JSONReader::ReadDict(
        local_state, base::JSON_PARSE_CHROMIUM_EXTENSIONS);
    if (top) {
      if (base::DictValue* profile = top->FindDict("profile")) {
        if (base::DictValue* cache = profile->FindDict("info_cache")) {
          info_cache = cache->Clone();
        }
        if (base::ListValue* ordered = profile->FindList("profiles_order")) {
          for (const base::Value& v : *ordered) {
            if (v.is_string()) {
              order.push_back(v.GetString());
            }
          }
        }
        if (const std::string* lu = profile->FindString("last_used")) {
          last_used = *lu;
        }
      }
    }
  }

  std::vector<std::string> dirs;
  auto add_dir = [&](const std::string& name) {
    if (std::find(dirs.begin(), dirs.end(), name) == dirs.end()) {
      dirs.push_back(name);
    }
  };
  if (def.root_is_profile && IsProfileDir(root)) {
    add_dir(".");
  }
  for (const std::string& name : order) {
    add_dir(name);
  }
  for (auto [key, value] : info_cache) {
    add_dir(key);
  }
  base::FileEnumerator folders(root, false, base::FileEnumerator::DIRECTORIES);
  for (base::FilePath p = folders.Next(); !p.empty(); p = folders.Next()) {
    std::string name = p.BaseName().AsUTF8Unsafe();
    if (name == "Default" || base::StartsWith(name, "Profile ")) {
      add_dir(name);
    }
  }

  int fallback = 0;
  for (const std::string& dir : dirs) {
    base::FilePath path = dir == "." ? root : AppendRelative(root, dir);
    if (!IsProfileDir(path)) {
      continue;
    }
    base::DictValue* info = info_cache.FindDict(dir);
    if (!info && dir == ".") {
      info = info_cache.FindDict("Default");
    }
    ++fallback;
    DiscoveredProfile profile;
    profile.id = dir;
    profile.path = path.AsUTF8Unsafe();
    const std::string* name = info ? info->FindString("name") : nullptr;
    if (name && !name->empty()) {
      profile.name = *name;
    } else {
      profile.name =
          (dir == "Default" || dir == ".") ? "Default"
                                           : "Profile " + base::NumberToString(
                                                              fallback);
    }
    if (info) {
      if (const std::string* email = info->FindString("user_name")) {
        if (!email->empty()) {
          profile.email = *email;
        }
      }
      std::optional<int> color = info->FindInt("profile_highlight_color");
      if (!color) {
        color = info->FindInt("default_avatar_fill_color");
      }
      if (color && static_cast<uint32_t>(*color) != 0xFF000000) {
        profile.color = HexColor(*color);
      }
    }
    base::FilePath picture = path.AppendASCII("Google Profile Picture.png");
    if (base::PathExists(picture)) {
      profile.avatar_path = picture.AsUTF8Unsafe();
    }
    profile.is_default =
        dir == (last_used.empty() ? "Default" : last_used) ||
        (dir == "." && last_used.empty());
    profile.available = ChromiumKinds(path, def.family == Family::kArc);
    out.push_back(std::move(profile));
  }
  return out;
}

struct FirefoxIniProfile {
  std::string name;
  std::string path;
  bool is_default = false;
};

std::vector<FirefoxIniProfile> ParseFirefoxIni(const std::string& ini) {
  struct Section {
    std::string name;
    std::map<std::string, std::string> values;
  };
  std::vector<Section> sections;
  for (std::string_view raw : base::SplitStringPiece(
           ini, "\r\n", base::TRIM_WHITESPACE, base::SPLIT_WANT_ALL)) {
    std::string line(base::TrimWhitespaceASCII(raw, base::TRIM_ALL));
    if (line.empty() || line[0] == ';' || line[0] == '#') {
      continue;
    }
    if (line.front() == '[' && line.back() == ']') {
      sections.push_back({line.substr(1, line.size() - 2), {}});
    } else if (!sections.empty()) {
      size_t eq = line.find('=');
      if (eq != std::string::npos) {
        sections.back().values[line.substr(0, eq)] = line.substr(eq + 1);
      }
    }
  }
  std::set<std::string> install_defaults;
  for (const Section& s : sections) {
    if (base::StartsWith(s.name, "Install")) {
      auto it = s.values.find("Default");
      if (it != s.values.end()) {
        install_defaults.insert(it->second);
      }
    }
  }
  std::vector<FirefoxIniProfile> out;
  for (const Section& s : sections) {
    if (!base::StartsWith(s.name, "Profile")) {
      continue;
    }
    auto path_it = s.values.find("Path");
    if (path_it == s.values.end() || path_it->second.empty()) {
      continue;
    }
    FirefoxIniProfile p;
    p.path = path_it->second;
    auto name_it = s.values.find("Name");
    p.name = name_it != s.values.end() ? name_it->second : p.path;
    auto def_it = s.values.find("Default");
    p.is_default = install_defaults.empty()
                       ? (def_it != s.values.end() && def_it->second == "1")
                       : install_defaults.count(p.path) > 0;
    out.push_back(std::move(p));
  }
  std::stable_sort(out.begin(), out.end(),
                   [](const FirefoxIniProfile& a, const FirefoxIniProfile& b) {
                     return a.is_default && !b.is_default;
                   });
  return out;
}

std::vector<DiscoveredProfile> FirefoxProfiles(const Def& def) {
  std::vector<DiscoveredProfile> out;
  base::FilePath root = DataDir(def);
  std::string ini;
  if (root.empty() ||
      !base::ReadFileToString(root.AppendASCII("profiles.ini"), &ini)) {
    return out;
  }
  for (const FirefoxIniProfile& p : ParseFirefoxIni(ini)) {
    if (base::StartsWith(p.path, "/")) {
      continue;
    }
    base::FilePath dir = AppendRelative(root, p.path);
    if (!base::PathExists(dir)) {
      continue;
    }
    DiscoveredProfile profile;
    profile.id = p.path;
    profile.name = p.name;
    profile.path = dir.AsUTF8Unsafe();
    profile.is_default = p.is_default;
    if (FileThere(dir, "places.sqlite")) {
      profile.available.push_back("bookmarks");
      profile.available.push_back("history");
    }
    out.push_back(std::move(profile));
  }
  return out;
}

struct BrowserKey {
  std::vector<uint8_t> cbc_key;
  std::optional<std::vector<uint8_t>> cbc_key_v11;
  std::optional<std::vector<uint8_t>> gcm_key;
  bool windows = false;
};

class ImportState {
 public:
  static ImportState& Get() {
    static base::NoDestructor<ImportState> state;
    return *state;
  }

  bool Unlock(const std::string& browser_id, std::string* message);
  bool IsUnlocked(const std::string& browser_id);
  void Forget();
  std::optional<BrowserKey> KeyFor(const std::string& browser_id);

  std::shared_ptr<std::atomic<bool>> StartJob(const std::string& job_id);
  void CancelJob(const std::string& job_id);
  void FinishJob(const std::string& job_id);

 private:
  base::Lock lock_;
  std::map<std::string, BrowserKey> keys_;
  std::map<std::string, std::shared_ptr<std::atomic<bool>>> jobs_;
};

#if BUILDFLAG(IS_LINUX)
std::optional<std::string> SecretServicePassword(
    const std::vector<std::string>& apps) {
  for (const std::string& app : apps) {
    std::vector<std::string> argv = {
        "secret-tool",     "lookup", "xdg:schema",
        "chrome_libsecret_os_crypt_password_v2", "application", app};
    std::string output;
    if (base::GetAppOutput(argv, &output) && !output.empty()) {
      std::string trimmed(
          base::TrimWhitespaceASCII(output, base::TRIM_TRAILING));
      if (!trimmed.empty()) {
        return trimmed;
      }
    }
  }
  return std::nullopt;
}
#endif

#if BUILDFLAG(IS_WIN)
std::optional<std::vector<uint8_t>> DpapiKey(const base::FilePath& data_dir) {
  std::string local_state;
  if (!base::ReadFileToString(data_dir.AppendASCII("Local State"),
                              &local_state)) {
    return std::nullopt;
  }
  std::optional<base::DictValue> top =
      base::JSONReader::ReadDict(local_state, base::JSON_PARSE_CHROMIUM_EXTENSIONS);
  if (!top) {
    return std::nullopt;
  }
  const std::string* encoded =
      top->FindStringByDottedPath("os_crypt.encrypted_key");
  if (!encoded) {
    return std::nullopt;
  }
  std::optional<std::vector<uint8_t>> encrypted = base::Base64Decode(*encoded);
  if (!encrypted || encrypted->size() < 5) {
    return std::nullopt;
  }
  base::span<const uint8_t> body = base::span(*encrypted).subspan(5u);
  DATA_BLOB input = {};
  input.pbData = const_cast<BYTE*>(body.data());
  input.cbData = static_cast<DWORD>(body.size());
  DATA_BLOB output = {};
  if (!::CryptUnprotectData(&input, nullptr, nullptr, nullptr, nullptr, 0,
                            &output)) {
    return std::nullopt;
  }
  auto local = base::win::TakeLocalAlloc(output.pbData);
  return std::vector<uint8_t>(local.get(), local.get() + output.cbData);
}
#endif

bool ImportState::Unlock(const std::string& browser_id, std::string* message) {
  const Def* def = FindDef(browser_id);
  if (!def || def->family == Family::kFirefox) {
    return true;
  }
  BrowserKey key;
#if BUILDFLAG(IS_WIN)
  key.windows = true;
  std::optional<std::vector<uint8_t>> gcm = DpapiKey(DataDir(*def));
  if (!gcm || gcm->size() != 32) {
    if (message) {
      *message = "Couldn't read the " + def->name + " encryption key";
    }
    return false;
  }
  key.gcm_key = std::move(gcm);
#elif BUILDFLAG(IS_LINUX)
  static constexpr uint8_t kPeanuts[] = {'p', 'e', 'a', 'n', 'u', 't', 's'};
  key.cbc_key = DeriveCbcKey(base::span(kPeanuts));
  std::optional<std::string> password = SecretServicePassword(def->secret_apps);
  if (password) {
    key.cbc_key_v11 =
        DeriveCbcKey(base::as_byte_span(*password));
  }
#else
  if (message) {
    *message = "Imports aren't supported on this platform";
  }
  return false;
#endif
  base::AutoLock locked(lock_);
  keys_[browser_id] = std::move(key);
  return true;
}

bool ImportState::IsUnlocked(const std::string& browser_id) {
  base::AutoLock locked(lock_);
  return keys_.count(browser_id) > 0;
}

void ImportState::Forget() {
  base::AutoLock locked(lock_);
  keys_.clear();
}

std::optional<BrowserKey> ImportState::KeyFor(const std::string& browser_id) {
  base::AutoLock locked(lock_);
  auto it = keys_.find(browser_id);
  if (it == keys_.end()) {
    return std::nullopt;
  }
  return it->second;
}

std::shared_ptr<std::atomic<bool>> ImportState::StartJob(
    const std::string& job_id) {
  auto flag = std::make_shared<std::atomic<bool>>(false);
  base::AutoLock locked(lock_);
  jobs_[job_id] = flag;
  return flag;
}

void ImportState::CancelJob(const std::string& job_id) {
  base::AutoLock locked(lock_);
  auto it = jobs_.find(job_id);
  if (it != jobs_.end()) {
    it->second->store(true);
  }
}

void ImportState::FinishJob(const std::string& job_id) {
  base::AutoLock locked(lock_);
  jobs_.erase(job_id);
}

std::optional<std::string> DecryptValue(const BrowserKey& key,
                                        base::span<const uint8_t> blob,
                                        int* undecryptable) {
  if (blob.size() < 3) {
    return std::string(reinterpret_cast<const char*>(blob.data()), blob.size());
  }
  std::string_view prefix(reinterpret_cast<const char*>(blob.data()), 3);
  base::span<const uint8_t> body = blob.subspan(3u);
  if (prefix == "v10" || prefix == "v11") {
    if (key.windows) {
      if (key.gcm_key) {
        std::optional<std::string> out = AesGcmOpen(*key.gcm_key, body);
        if (out) {
          return out;
        }
      }
      ++*undecryptable;
      return std::nullopt;
    }
    const std::optional<std::vector<uint8_t>>* chosen =
        prefix == "v11" ? &key.cbc_key_v11 : nullptr;
    base::span<const uint8_t> cbc =
        chosen ? (*chosen ? base::span(**chosen) : base::span<const uint8_t>())
               : base::span(key.cbc_key);
    if (cbc.empty()) {
      ++*undecryptable;
      return std::nullopt;
    }
    std::optional<std::string> out = AesCbcDecrypt(cbc, body);
    if (!out) {
      ++*undecryptable;
      return std::nullopt;
    }
    return out;
  }
  if (prefix == "v20") {
    ++*undecryptable;
    return std::nullopt;
  }
  return std::string(reinterpret_cast<const char*>(blob.data()), blob.size());
}

class Snapshot {
 public:
  bool Open(const base::FilePath& source, sql::Database::Tag tag) {
    if (!base::PathExists(source) || !temp_.CreateUniqueTempDir()) {
      return false;
    }
    base::FilePath copy = temp_.GetPath().AppendASCII("db.sqlite");
    if (!base::CopyFile(source, copy)) {
      return false;
    }
    for (const char* suffix : {"-wal", "-journal"}) {
      base::FilePath from = base::FilePath::FromUTF8Unsafe(
          source.AsUTF8Unsafe() + suffix);
      base::FilePath to =
          base::FilePath::FromUTF8Unsafe(copy.AsUTF8Unsafe() + suffix);
      if (base::PathExists(from)) {
        base::CopyFile(from, to);
      }
    }
    db_ = std::make_unique<sql::Database>(sql::DatabaseOptions(), tag);
    return db_->Open(copy);
  }

  sql::Database* db() { return db_.get(); }

  bool TableExists(std::string_view name) {
    return db_ && db_->DoesTableExist(name);
  }

 private:
  base::ScopedTempDir temp_;
  std::unique_ptr<sql::Database> db_;
};

std::optional<base::DictValue> ParseBookmarkNode(const base::DictValue& json);

base::ListValue ParseBookmarkChildren(const base::ListValue& list) {
  base::ListValue out;
  for (const base::Value& child : list) {
    if (child.is_dict()) {
      std::optional<base::DictValue> node = ParseBookmarkNode(child.GetDict());
      if (node) {
        out.Append(std::move(*node));
      }
    }
  }
  return out;
}

std::optional<base::DictValue> ParseBookmarkNode(const base::DictValue& json) {
  const std::string* type = json.FindString("type");
  const std::string* name = json.FindString("name");
  std::optional<double> added = FromWebKitString(json.FindString("date_added"));
  if (type && *type == "url") {
    const std::string* url = json.FindString("url");
    if (!url || url->empty()) {
      return std::nullopt;
    }
    base::DictValue node;
    node.Set("type", "url");
    node.Set("title", name ? *name : std::string());
    node.Set("url", *url);
    if (added) {
      node.Set("dateAdded", *added);
    }
    return node;
  }
  if (type && *type == "folder") {
    base::DictValue node;
    node.Set("type", "folder");
    node.Set("title", name ? *name : std::string());
    if (added) {
      node.Set("dateAdded", *added);
    }
    if (const base::ListValue* children = json.FindList("children")) {
      node.Set("children", ParseBookmarkChildren(*children));
    } else {
      node.Set("children", base::ListValue());
    }
    return node;
  }
  return std::nullopt;
}

base::DictValue EmptyBookmarks() {
  base::DictValue node;
  node.Set("type", "folder");
  node.Set("title", "Bookmarks");
  node.Set("children", base::ListValue());
  return node;
}

std::optional<base::DictValue> ParseBookmarksFile(const std::string& data) {
  std::optional<base::DictValue> top =
      base::JSONReader::ReadDict(data, base::JSON_PARSE_CHROMIUM_EXTENSIONS);
  if (!top) {
    return std::nullopt;
  }
  const base::DictValue* roots = top->FindDict("roots");
  if (!roots) {
    return std::nullopt;
  }
  static const std::array<std::array<const char*, 3>, 3> kRoots = {{
      {"bookmark_bar", "toolbar", "Bookmarks Bar"},
      {"other", "other", "Other Bookmarks"},
      {"synced", "mobile", "Mobile Bookmarks"},
  }};
  base::DictValue result = EmptyBookmarks();
  base::ListValue children;
  for (const auto& root : kRoots) {
    const base::DictValue* json = roots->FindDict(root[0]);
    if (!json) {
      continue;
    }
    std::optional<base::DictValue> node = ParseBookmarkNode(*json);
    if (!node) {
      continue;
    }
    const base::ListValue* kids = node->FindList("children");
    if (!kids || kids->empty()) {
      continue;
    }
    const std::string* name = json->FindString("name");
    node->Set("title", name && !name->empty() ? *name : root[2]);
    node->Set("role", root[1]);
    children.Append(std::move(*node));
  }
  result.Set("children", std::move(children));
  return result;
}

std::optional<base::DictValue> LoadChromiumBookmarks(
    const base::FilePath& profile) {
  base::FilePath local = profile.AppendASCII("Bookmarks");
  base::FilePath account = profile.AppendASCII("AccountBookmarks");
  if (!base::PathExists(local) && !base::PathExists(account)) {
    return std::nullopt;
  }
  std::string data;
  base::DictValue result;
  if (base::PathExists(local) && base::ReadFileToString(local, &data)) {
    std::optional<base::DictValue> parsed = ParseBookmarksFile(data);
    result = parsed ? std::move(*parsed) : EmptyBookmarks();
  } else {
    result = EmptyBookmarks();
  }
  std::string extra_data;
  if (base::PathExists(account) &&
      base::ReadFileToString(account, &extra_data)) {
    std::optional<base::DictValue> extra = ParseBookmarksFile(extra_data);
    if (extra) {
      base::ListValue* result_children = result.FindList("children");
      const base::ListValue* extra_children = extra->FindList("children");
      if (result_children && extra_children) {
        for (const base::Value& folder : *extra_children) {
          if (!folder.is_dict()) {
            continue;
          }
          const std::string* role = folder.GetDict().FindString("role");
          base::DictValue* match = nullptr;
          for (base::Value& existing : *result_children) {
            const std::string* existing_role = existing.GetDict().FindString("role");
            if (role && existing_role && *role == *existing_role) {
              match = &existing.GetDict();
              break;
            }
          }
          if (match) {
            base::ListValue* into = match->FindList("children");
            const base::ListValue* from = folder.GetDict().FindList("children");
            if (into && from) {
              for (const base::Value& child : *from) {
                into->Append(child.Clone());
              }
            }
          } else {
            result_children->Append(folder.Clone());
          }
        }
      }
    }
  }
  return result;
}

int BookmarkLinkCount(const base::DictValue& node) {
  const std::string* type = node.FindString("type");
  if (type && *type == "url") {
    return 1;
  }
  int count = 0;
  if (const base::ListValue* children = node.FindList("children")) {
    for (const base::Value& child : *children) {
      if (child.is_dict()) {
        count += BookmarkLinkCount(child.GetDict());
      }
    }
  }
  return count;
}

struct HistoryOptions {
  std::optional<int> limit;
  std::optional<double> since_ms;
  bool stream = false;
  int chunk_size = 1000;
};

struct HistoryOutcome {
  base::ListValue entries;
  int count = 0;
};

bool ReadHistory(const base::FilePath& file,
                 bool firefox,
                 const HistoryOptions& options,
                 const std::string& job_id,
                 std::atomic<bool>* cancel,
                 const Event& event,
                 scoped_refptr<base::SequencedTaskRunner> reply,
                 HistoryOutcome* outcome,
                 ImportError* error) {
  Snapshot snapshot;
  if (!snapshot.Open(file, firefox ? sql::Database::Tag("FirefoxImporter")
                                    : sql::Database::Tag("History"))) {
    error->code = "unreadable";
    error->message = "Couldn't open the history database";
    return false;
  }
  const char* table = firefox ? "moz_places" : "urls";
  if (!snapshot.TableExists(table)) {
    error->code = "unreadable";
    error->message = "History database is missing its table";
    return false;
  }

  std::string where =
      firefox
          ? "hidden = 0 AND visit_count > 0 AND last_visit_date IS NOT NULL AND "
            "(url LIKE 'http://%' OR url LIKE 'https://%')"
          : "hidden = 0 AND last_visit_time > 0 AND (url LIKE 'http://%' OR url "
            "LIKE 'https://%')";
  std::optional<int64_t> since;
  if (options.since_ms) {
    if (firefox) {
      since = static_cast<int64_t>(*options.since_ms * 1000);
      where += " AND last_visit_date >= ?";
    } else {
      since = static_cast<int64_t>(*options.since_ms * 1000) + 11644473600000000;
      where += " AND last_visit_time >= ?";
    }
  }
  std::string columns =
      firefox ? "url, title, visit_count, last_visit_date, typed"
              : "url, title, visit_count, last_visit_time, typed_count";
  std::string order =
      firefox ? " ORDER BY last_visit_date DESC" : " ORDER BY last_visit_time DESC";
  std::string sql =
      "SELECT " + columns + " FROM " + std::string(table) + " WHERE " + where +
      order;

  int total = 0;
  {
    sql::Statement count(snapshot.db()->GetUniqueStatement(
        "SELECT count(*) FROM (" + sql + ")"));
    if (since) {
      count.BindInt64(0, *since);
    }
    if (count.Step()) {
      total = count.ColumnInt(0);
    }
  }
  int expected = options.limit ? std::min(*options.limit, total) : total;

  auto send_progress = [&](const char* phase, int processed, int tot) {
    base::DictValue body;
    body.Set("jobId", job_id);
    body.Set("type", "progress");
    body.Set("kind", "history");
    body.Set("phase", phase);
    body.Set("processed", processed);
    body.Set("total", tot);
    reply->PostTask(FROM_HERE, base::BindOnce(event, std::move(body)));
  };
  send_progress("start", 0, expected);

  sql::Statement statement(snapshot.db()->GetUniqueStatement(sql));
  if (since) {
    statement.BindInt64(0, *since);
  }
  base::ListValue chunk;
  int count = 0;
  while (statement.Step()) {
    if (count % 256 == 0 && cancel->load()) {
      error->code = "cancelled";
      error->message = "Import cancelled";
      return false;
    }
    std::string url = statement.ColumnString(0);
    if (!IsWebUrl(url)) {
      continue;
    }
    int64_t time = statement.ColumnInt64(3);
    std::optional<double> last =
        firefox ? FromUnixMicros(time) : FromWebKit(time);
    base::DictValue entry;
    entry.Set("url", url);
    entry.Set("title", statement.ColumnString(1));
    entry.Set("visits", std::max(1, statement.ColumnInt(2)));
    entry.Set("lastVisit", last.value_or(0));
    if (statement.GetColumnType(4) != sql::ColumnType::kNull) {
      entry.Set("typedCount", statement.ColumnInt(4));
    }
    ++count;
    if (options.stream) {
      chunk.Append(std::move(entry));
      if (static_cast<int>(chunk.size()) >= options.chunk_size) {
        base::DictValue body;
        body.Set("jobId", job_id);
        body.Set("type", "history");
        body.Set("entries", base::WriteJson(chunk).value_or("[]"));
        reply->PostTask(FROM_HERE, base::BindOnce(event, std::move(body)));
        chunk.clear();
        send_progress("progress", count, expected);
      }
    } else {
      outcome->entries.Append(std::move(entry));
      if (count % options.chunk_size == 0) {
        send_progress("progress", count, expected);
      }
    }
    if (options.limit && count >= *options.limit) {
      break;
    }
  }
  if (options.stream && !chunk.empty()) {
    base::DictValue body;
    body.Set("jobId", job_id);
    body.Set("type", "history");
    body.Set("entries", base::WriteJson(chunk).value_or("[]"));
    reply->PostTask(FROM_HERE, base::BindOnce(event, std::move(body)));
  }
  send_progress("end", count, count);
  outcome->count = count;
  return true;
}

std::optional<base::DictValue> LoadFirefoxBookmarks(const base::FilePath& places,
                                                    ImportError* error) {
  Snapshot snapshot;
  if (!snapshot.Open(places, sql::Database::Tag("FirefoxImporter"))) {
    error->code = "unreadable";
    error->message = "Couldn't open places.sqlite";
    return std::nullopt;
  }
  if (!snapshot.TableExists("moz_bookmarks")) {
    error->code = "unreadable";
    error->message = "places.sqlite has no bookmarks";
    return std::nullopt;
  }
  struct Row {
    int64_t id;
    int64_t type;
    int64_t parent;
    std::string title;
    std::optional<std::string> url;
    std::optional<double> added;
    std::string guid;
  };
  std::map<int64_t, std::vector<Row>> children;
  int64_t root_id = -1;
  sql::Statement statement(snapshot.db()->GetUniqueStatement(
      "SELECT b.id, b.type, b.parent, b.title, p.url, b.dateAdded, b.guid "
      "FROM moz_bookmarks b LEFT JOIN moz_places p ON b.fk = p.id "
      "ORDER BY b.parent, b.position"));
  while (statement.Step()) {
    Row row;
    row.id = statement.ColumnInt64(0);
    row.type = statement.ColumnInt64(1);
    row.parent = statement.ColumnInt64(2);
    row.title = statement.ColumnString(3);
    if (statement.GetColumnType(4) != sql::ColumnType::kNull) {
      row.url = statement.ColumnString(4);
    }
    if (statement.GetColumnType(5) != sql::ColumnType::kNull) {
      row.added = FromUnixMicros(statement.ColumnInt64(5));
    }
    row.guid = statement.ColumnString(6);
    if (row.guid == "root________") {
      root_id = row.id;
    } else {
      children[row.parent].push_back(std::move(row));
    }
  }
  if (root_id < 0) {
    error->code = "unreadable";
    error->message = "places.sqlite has no bookmarks root";
    return std::nullopt;
  }

  std::function<base::ListValue(int64_t, int)> build =
      [&](int64_t parent, int depth) -> base::ListValue {
    base::ListValue out;
    if (depth >= 64) {
      return out;
    }
    auto it = children.find(parent);
    if (it == children.end()) {
      return out;
    }
    for (const Row& row : it->second) {
      if (row.type == 1) {
        if (!row.url || base::StartsWith(*row.url, "place:")) {
          continue;
        }
        base::DictValue node;
        node.Set("type", "url");
        node.Set("title", row.title);
        node.Set("url", *row.url);
        if (row.added) {
          node.Set("dateAdded", *row.added);
        }
        out.Append(std::move(node));
      } else if (row.type == 2) {
        base::DictValue node;
        node.Set("type", "folder");
        node.Set("title", row.title);
        if (row.added) {
          node.Set("dateAdded", *row.added);
        }
        node.Set("children", build(row.id, depth + 1));
        out.Append(std::move(node));
      }
    }
    return out;
  };

  static const std::array<std::array<const char*, 3>, 4> kRoots = {{
      {"toolbar_____", "toolbar", "Bookmarks Toolbar"},
      {"menu________", "menu", "Bookmarks Menu"},
      {"unfiled_____", "other", "Other Bookmarks"},
      {"mobile______", "mobile", "Mobile Bookmarks"},
  }};
  base::DictValue result = EmptyBookmarks();
  base::ListValue top;
  auto rank = [&](const std::string& guid) {
    for (size_t i = 0; i < kRoots.size(); ++i) {
      if (kRoots[i][0] == guid) {
        return static_cast<int>(i);
      }
    }
    return 99;
  };
  std::vector<Row> roots;
  auto it = children.find(root_id);
  if (it != children.end()) {
    roots = it->second;
  }
  std::stable_sort(roots.begin(), roots.end(), [&](const Row& a, const Row& b) {
    return rank(a.guid) < rank(b.guid);
  });
  for (const Row& row : roots) {
    const std::array<const char*, 3>* info = nullptr;
    for (const auto& r : kRoots) {
      if (r[0] == row.guid) {
        info = &r;
        break;
      }
    }
    if (!info) {
      continue;
    }
    base::ListValue kids = build(row.id, 0);
    if (kids.empty()) {
      continue;
    }
    base::DictValue node;
    node.Set("type", "folder");
    node.Set("title", (*info)[2]);
    node.Set("role", (*info)[1]);
    if (row.added) {
      node.Set("dateAdded", *row.added);
    }
    node.Set("children", std::move(kids));
    top.Append(std::move(node));
  }
  result.Set("children", std::move(top));
  return result;
}

struct LoginsOutcome {
  base::ListValue items;
  int undecryptable = 0;
};

bool ReadLoginsDatabase(const base::FilePath& file,
                        const BrowserKey& key,
                        std::atomic<bool>* cancel,
                        std::set<std::string>* seen,
                        LoginsOutcome* outcome,
                        ImportError* error) {
  Snapshot snapshot;
  if (!snapshot.Open(file, sql::Database::Tag("Passwords"))) {
    error->code = "unreadable";
    error->message = "Couldn't open the login database";
    return false;
  }
  if (!snapshot.TableExists("logins")) {
    error->code = "unreadable";
    error->message = "Login Data has no logins table";
    return false;
  }
  sql::Statement statement(snapshot.db()->GetUniqueStatement(
      "SELECT origin_url, signon_realm, username_value, password_value, "
      "date_created, date_last_used, times_used, blacklisted_by_user FROM "
      "logins"));
  int index = 0;
  while (statement.Step()) {
    if (index++ % 128 == 0 && cancel->load()) {
      error->code = "cancelled";
      error->message = "Import cancelled";
      return false;
    }
    if (statement.ColumnInt(7) != 0) {
      continue;
    }
    base::span<const uint8_t> blob = statement.ColumnBlob(3);
    if (blob.empty()) {
      continue;
    }
    std::optional<std::string> password =
        DecryptValue(key, blob, &outcome->undecryptable);
    if (!password || password->empty()) {
      continue;
    }
    std::string origin = statement.ColumnString(0);
    std::string realm = statement.ColumnString(1);
    std::string username = statement.ColumnString(2);
    std::string dedupe = (realm.empty() ? origin : realm) +
                         std::string(1, '\0') + username;
    if (!seen->insert(dedupe).second) {
      continue;
    }
    base::DictValue item;
    item.Set("url", origin.empty() ? realm : origin);
    item.Set("username", username);
    item.Set("password", *password);
    if (!realm.empty()) {
      item.Set("realm", realm);
    }
    if (std::optional<double> created =
            FromWebKit(statement.ColumnInt64(4))) {
      item.Set("created", *created);
    }
    if (std::optional<double> last = FromWebKit(statement.ColumnInt64(5))) {
      item.Set("lastUsed", *last);
    }
    if (statement.GetColumnType(6) != sql::ColumnType::kNull) {
      item.Set("timesUsed", statement.ColumnInt(6));
    }
    outcome->items.Append(std::move(item));
  }
  return true;
}

bool ReadLogins(const base::FilePath& profile,
                const BrowserKey& key,
                std::atomic<bool>* cancel,
                LoginsOutcome* outcome,
                ImportError* error) {
  std::vector<base::FilePath> files;
  for (const char* name : {"Login Data", "Login Data For Account"}) {
    base::FilePath file = profile.AppendASCII(name);
    if (base::PathExists(file)) {
      files.push_back(file);
    }
  }
  if (files.empty()) {
    error->code = "empty";
    error->message = "No saved passwords in this profile";
    return false;
  }
  std::set<std::string> seen;
  for (const base::FilePath& file : files) {
    if (!ReadLoginsDatabase(file, key, cancel, &seen, outcome, error)) {
      return false;
    }
  }
  return true;
}

bool IsExtensionId(std::string_view id) {
  if (id.size() != 32) {
    return false;
  }
  for (char c : id) {
    if (c < 'a' || c > 'p') {
      return false;
    }
  }
  return true;
}

std::optional<std::string> ExtensionName(const std::string& id,
                                         const base::DictValue& entry,
                                         const base::FilePath& profile) {
  const base::DictValue* manifest = entry.FindDict("manifest");
  base::DictValue loaded_manifest;
  base::FilePath dir;
  const std::string* path = entry.FindString("path");
  if (path && !base::StartsWith(*path, "/") &&
      path->find("..") == std::string::npos) {
    dir = AppendRelative(profile.AppendASCII("Extensions"), *path);
    if (!manifest) {
      std::string data;
      if (base::ReadFileToString(dir.AppendASCII("manifest.json"), &data)) {
        std::optional<base::DictValue> parsed = base::JSONReader::ReadDict(data, base::JSON_PARSE_RFC);
        if (parsed) {
          loaded_manifest = std::move(*parsed);
          manifest = &loaded_manifest;
        }
      }
    }
  }
  if (!manifest) {
    return std::nullopt;
  }
  const std::string* raw = manifest->FindString("name");
  if (!raw) {
    return std::nullopt;
  }
  std::string name(base::TrimWhitespaceASCII(*raw, base::TRIM_ALL));
  if (name.empty()) {
    return std::nullopt;
  }
  if (!base::StartsWith(name, "__MSG_") || !base::EndsWith(name, "__")) {
    return name;
  }
  std::string key =
      base::ToLowerASCII(name.substr(6, name.size() - 8));
  const std::string* locale = manifest->FindString("default_locale");
  if (dir.empty() || !locale) {
    return std::nullopt;
  }
  std::string messages_data;
  if (!base::ReadFileToString(
          AppendRelative(dir, "_locales/" + *locale + "/messages.json"),
          &messages_data)) {
    return std::nullopt;
  }
  std::optional<base::DictValue> messages =
      base::JSONReader::ReadDict(messages_data, base::JSON_PARSE_RFC);
  if (!messages) {
    return std::nullopt;
  }
  for (auto [message_key, value] : *messages) {
    if (base::ToLowerASCII(message_key) == key && value.is_dict()) {
      const std::string* message = value.GetDict().FindString("message");
      if (message && !message->empty()) {
        return *message;
      }
    }
  }
  return std::nullopt;
}

base::ListValue ListExtensions(const base::FilePath& profile) {
  static const base::NoDestructor<std::set<std::string>> kNotOffered(
      std::set<std::string>{"cjpalhdlnbpafiamejdnhcphjbkeiagm",
                            "ddkjiahejlhfcafbddmgiahcphecmpfh"});
  base::DictValue settings;
  for (const char* file : {"Preferences", "Secure Preferences"}) {
    std::string data;
    if (!base::ReadFileToString(profile.AppendASCII(file), &data)) {
      continue;
    }
    std::optional<base::DictValue> root =
        base::JSONReader::ReadDict(data, base::JSON_PARSE_CHROMIUM_EXTENSIONS);
    if (!root) {
      continue;
    }
    const base::DictValue* found =
        root->FindDictByDottedPath("extensions.settings");
    if (!found) {
      continue;
    }
    for (auto [id, value] : *found) {
      if (value.is_dict() && !settings.contains(id)) {
        settings.Set(id, value.Clone());
      }
    }
  }
  struct Item {
    std::string id;
    std::string name;
  };
  std::vector<Item> items;
  for (auto [id, value] : settings) {
    if (!IsExtensionId(id) || kNotOffered->count(id) || !value.is_dict()) {
      continue;
    }
    const base::DictValue& entry = value.GetDict();
    if (entry.FindBool("from_webstore") != true) {
      continue;
    }
    std::optional<int> location = entry.FindInt("location");
    if (location && *location != 1) {
      continue;
    }
    items.push_back({id, ExtensionName(id, entry, profile).value_or(id)});
  }
  std::stable_sort(items.begin(), items.end(), [](const Item& a, const Item& b) {
    return base::ToLowerASCII(a.name) < base::ToLowerASCII(b.name);
  });
  base::ListValue out;
  for (const Item& item : items) {
    base::DictValue dict;
    dict.Set("id", item.id);
    dict.Set("name", item.name);
    dict.Set("webStoreUrl",
             "https://chromewebstore.google.com/detail/" + item.id);
    out.Append(std::move(dict));
  }
  return out;
}

base::FilePath LatestSessionFile(const base::FilePath& profile) {
  int64_t best = -1;
  base::FilePath best_file;
  for (const char* dir : {"Sessions", "Sessions_Encrypted"}) {
    base::FileEnumerator files(profile.AppendASCII(dir), false,
                               base::FileEnumerator::FILES);
    for (base::FilePath p = files.Next(); !p.empty(); p = files.Next()) {
      std::string name = p.BaseName().AsUTF8Unsafe();
      if (!base::StartsWith(name, "Session_")) {
        continue;
      }
      int64_t stamp = 0;
      if (base::StringToInt64(name.substr(8), &stamp) && stamp > best) {
        best = stamp;
        best_file = p;
      }
    }
  }
  if (!best_file.empty()) {
    return best_file;
  }
  for (const char* legacy : {"Current Session", "Last Session"}) {
    base::FilePath p = profile.AppendASCII(legacy);
    if (base::PathExists(p)) {
      return p;
    }
  }
  return base::FilePath();
}

class SpanReader {
 public:
  explicit SpanReader(base::span<const uint8_t> data) : data_(data) {}

  size_t remaining() const { return data_.size() - offset_; }

  std::optional<base::span<const uint8_t>> Bytes(size_t n) {
    if (remaining() < n) {
      return std::nullopt;
    }
    base::span<const uint8_t> out = data_.subspan(offset_, n);
    offset_ += n;
    return out;
  }

  bool Skip(size_t n) { return Bytes(n).has_value(); }

  std::optional<uint8_t> U8() {
    auto b = Bytes(1);
    return b ? std::optional<uint8_t>((*b)[0]) : std::nullopt;
  }
  std::optional<uint16_t> U16() {
    auto b = Bytes(2);
    return b ? std::optional<uint16_t>(base::U16FromLittleEndian(b->first<2>()))
             : std::nullopt;
  }
  std::optional<uint32_t> U32() {
    auto b = Bytes(4);
    return b ? std::optional<uint32_t>(base::U32FromLittleEndian(b->first<4>()))
             : std::nullopt;
  }
  std::optional<int32_t> I32() {
    auto v = U32();
    return v ? std::optional<int32_t>(static_cast<int32_t>(*v)) : std::nullopt;
  }
  std::optional<uint64_t> U64() {
    auto b = Bytes(8);
    return b ? std::optional<uint64_t>(base::U64FromLittleEndian(b->first<8>()))
             : std::nullopt;
  }
  std::optional<int64_t> I64() {
    auto v = U64();
    return v ? std::optional<int64_t>(static_cast<int64_t>(*v)) : std::nullopt;
  }

 private:
  base::span<const uint8_t> data_;
  size_t offset_ = 0;
};

std::string GroupId(uint64_t high, uint64_t low) {
  return base::StringPrintf("%016llX%016llX",
                            static_cast<unsigned long long>(high),
                            static_cast<unsigned long long>(low));
}

struct Navigation {
  int32_t index = 0;
  std::string url;
  std::string title;
};

struct TabState {
  int32_t window_id = 0;
  int32_t visual_index = 0;
  std::vector<Navigation> navigations;
  int32_t current = 0;
  bool pinned = false;
  std::optional<std::string> group;
  std::optional<double> last_active;

  size_t Closest(int32_t index) const {
    for (size_t i = 0; i < navigations.size(); ++i) {
      if (navigations[i].index >= index) {
        return i;
      }
    }
    return navigations.size();
  }

  void Prune(int32_t index, int32_t count) {
    if (current >= index && current < index + count) {
      current = index - 1;
    } else if (current >= index + count) {
      current -= count;
    }
    size_t from = Closest(index);
    size_t to = std::max(from, Closest(index + count));
    navigations.erase(navigations.begin() + from, navigations.begin() + to);
    for (Navigation& nav : navigations) {
      if (nav.index >= index) {
        nav.index -= count;
      }
    }
  }
};

struct WindowState {
  int32_t selected_tab = 0;
  std::optional<int32_t> type;
};

struct SessionState {
  std::map<int32_t, TabState> tabs;
  std::map<int32_t, WindowState> windows;
  std::map<std::string, base::DictValue> groups;
};

static const char* const kGroupColors[] = {"grey",  "blue",   "red",
                                           "yellow", "green", "pink",
                                           "purple", "cyan",  "orange"};

constexpr uint8_t kSetTabWindow = 0;
constexpr uint8_t kSetTabIndexInWindow = 2;
constexpr uint8_t kPrunedFromBack = 5;
constexpr uint8_t kPrunedFromFront = 11;
constexpr uint8_t kPruned = 24;
constexpr uint8_t kUpdateTabNavigation = 6;
constexpr uint8_t kSetSelectedNavigationIndex = 7;
constexpr uint8_t kSetSelectedTabInIndex = 8;
constexpr uint8_t kSetWindowType = 9;
constexpr uint8_t kSetPinnedState = 12;
constexpr uint8_t kTabClosed = 16;
constexpr uint8_t kWindowClosed = 17;
constexpr uint8_t kLastActiveTime = 21;
constexpr uint8_t kSetTabGroup = 25;
constexpr uint8_t kSetTabGroupMetadata2 = 27;

void ApplyCommand(SessionState* state,
                  uint8_t id,
                  base::span<const uint8_t> payload) {
  SpanReader r(payload);
  switch (id) {
    case kSetTabWindow: {
      auto window = r.I32();
      auto tab = r.I32();
      if (window && tab) {
        state->tabs[*tab].window_id = *window;
      }
      break;
    }
    case kSetTabIndexInWindow: {
      auto tab = r.I32();
      auto index = r.I32();
      if (tab && index) {
        state->tabs[*tab].visual_index = *index;
      }
      break;
    }
    case kPrunedFromBack: {
      auto tab = r.I32();
      auto index = r.I32();
      if (tab && index) {
        TabState& t = state->tabs[*tab];
        t.navigations.erase(t.navigations.begin() + t.Closest(*index),
                            t.navigations.end());
      }
      break;
    }
    case kPrunedFromFront: {
      auto tab = r.I32();
      auto count = r.I32();
      if (tab && count && *count > 0) {
        state->tabs[*tab].Prune(0, *count);
      }
      break;
    }
    case kPruned: {
      auto tab = r.I32();
      auto index = r.I32();
      auto count = r.I32();
      if (tab && index && count && *index >= 0 && *count > 0) {
        state->tabs[*tab].Prune(*index, *count);
      }
      break;
    }
    case kUpdateTabNavigation: {
      base::PickleIterator it = base::PickleIterator::WithData(payload);
      int tab = 0;
      int index = 0;
      std::string url;
      std::u16string title;
      if (it.ReadInt(&tab) && it.ReadInt(&index) && it.ReadString(&url) &&
          it.ReadString16(&title)) {
        TabState& t = state->tabs[tab];
        Navigation nav;
        nav.index = index;
        nav.url = url;
        nav.title = base::UTF16ToUTF8(title);
        size_t i = t.Closest(index);
        if (i < t.navigations.size() && t.navigations[i].index == index) {
          t.navigations[i] = std::move(nav);
        } else {
          t.navigations.insert(t.navigations.begin() + i, std::move(nav));
        }
      }
      break;
    }
    case kSetSelectedNavigationIndex: {
      auto tab = r.I32();
      auto index = r.I32();
      if (tab && index) {
        state->tabs[*tab].current = *index;
      }
      break;
    }
    case kSetSelectedTabInIndex: {
      auto window = r.I32();
      auto index = r.I32();
      if (window && index) {
        state->windows[*window].selected_tab = *index;
      }
      break;
    }
    case kSetWindowType: {
      auto window = r.I32();
      auto type = r.I32();
      if (window && type) {
        state->windows[*window].type = *type;
      }
      break;
    }
    case kSetPinnedState: {
      auto tab = r.I32();
      auto pinned = r.U8();
      if (tab && pinned) {
        state->tabs[*tab].pinned = *pinned != 0;
      }
      break;
    }
    case kTabClosed: {
      auto tab = r.I32();
      if (tab) {
        state->tabs.erase(*tab);
      }
      break;
    }
    case kWindowClosed: {
      auto window = r.I32();
      if (window) {
        state->windows.erase(*window);
      }
      break;
    }
    case kLastActiveTime: {
      auto tab = r.I32();
      if (tab && r.Skip(4)) {
        auto micros = r.I64();
        if (micros) {
          state->tabs[*tab].last_active = FromWebKit(*micros);
        }
      }
      break;
    }
    case kSetTabGroup: {
      auto tab = r.I32();
      if (tab && r.Skip(4)) {
        auto high = r.U64();
        auto low = r.U64();
        auto has = r.U8();
        if (high && low && has) {
          state->tabs[*tab].group =
              *has != 0 ? std::optional<std::string>(GroupId(*high, *low))
                        : std::nullopt;
        }
      }
      break;
    }
    case kSetTabGroupMetadata2: {
      base::PickleIterator it = base::PickleIterator::WithData(payload);
      uint64_t high = 0;
      uint64_t low = 0;
      std::u16string title;
      uint32_t color = 0;
      if (it.ReadUInt64(&high) && it.ReadUInt64(&low) &&
          it.ReadString16(&title) && it.ReadUInt32(&color)) {
        bool collapsed = false;
        if (!it.ReadBool(&collapsed)) {
          collapsed = false;
        }
        std::string group_id = GroupId(high, low);
        base::DictValue group;
        group.Set("id", group_id);
        group.Set("title", base::UTF16ToUTF8(title));
        group.Set("color", color < std::size(kGroupColors)
                               ? kGroupColors[color]
                               : "grey");
        group.Set("collapsed", collapsed);
        state->groups[group_id] = std::move(group);
      }
      break;
    }
    default:
      break;
  }
}

void SessionToTabs(const SessionState& state,
                   base::ListValue* tabs,
                   base::ListValue* groups) {
  std::vector<int32_t> window_ids;
  for (const auto& [id, window] : state.windows) {
    if (window.type == 0) {
      window_ids.push_back(id);
    }
  }
  std::sort(window_ids.begin(), window_ids.end());
  std::set<std::string> used_groups;
  for (size_t window_index = 0; window_index < window_ids.size();
       ++window_index) {
    int32_t window_id = window_ids[window_index];
    std::vector<std::pair<int32_t, const TabState*>> window_tabs;
    for (const auto& [tab_id, tab] : state.tabs) {
      if (tab.window_id == window_id && !tab.navigations.empty()) {
        window_tabs.emplace_back(tab_id, &tab);
      }
    }
    std::sort(window_tabs.begin(), window_tabs.end(),
              [](const auto& a, const auto& b) {
                if (a.second->visual_index != b.second->visual_index) {
                  return a.second->visual_index < b.second->visual_index;
                }
                return a.first < b.first;
              });
    auto window_it = state.windows.find(window_id);
    int selected =
        window_it != state.windows.end() ? window_it->second.selected_tab : 0;
    for (size_t position = 0; position < window_tabs.size(); ++position) {
      const TabState& tab = *window_tabs[position].second;
      size_t i = tab.Closest(tab.current);
      const Navigation& nav =
          i < tab.navigations.size() ? tab.navigations[i] : tab.navigations.back();
      if (nav.url.empty()) {
        continue;
      }
      if (tab.group) {
        used_groups.insert(*tab.group);
      }
      base::DictValue dict;
      dict.Set("url", nav.url);
      dict.Set("title", nav.title);
      dict.Set("pinned", tab.pinned);
      if (tab.group) {
        dict.Set("groupId", *tab.group);
      }
      dict.Set("windowIndex", static_cast<int>(window_index));
      dict.Set("active", static_cast<int>(position) == selected);
      if (tab.last_active) {
        dict.Set("lastActive", *tab.last_active);
      }
      tabs->Append(std::move(dict));
    }
  }
  for (const std::string& id : used_groups) {
    auto it = state.groups.find(id);
    if (it != state.groups.end()) {
      groups->Append(it->second.Clone());
    } else {
      base::DictValue group;
      group.Set("id", id);
      group.Set("title", "");
      group.Set("color", "grey");
      group.Set("collapsed", false);
      groups->Append(std::move(group));
    }
  }
}

bool ReadSession(const base::FilePath& profile,
                 const std::optional<BrowserKey>& key,
                 base::ListValue* tabs,
                 base::ListValue* groups,
                 ImportError* error) {
  base::FilePath file = LatestSessionFile(profile);
  if (file.empty()) {
    error->code = "empty";
    error->message = "No session file in this profile";
    return false;
  }
  std::string contents;
  if (!base::ReadFileToString(file, &contents)) {
    error->code = "unreadable";
    error->message = "Couldn't read the session file";
    return false;
  }
  base::span<const uint8_t> data = base::as_byte_span(contents);
  SpanReader reader(data);
  auto signature = reader.U32();
  auto version = reader.U32();
  if (!signature || *signature != 0x53534E53 || !version) {
    error->code = "unreadable";
    error->message = "Not a Chromium session file";
    return false;
  }
  SessionState state;
  if (*version == 1 || *version == 3) {
    while (true) {
      auto size = reader.U16();
      if (!size || *size < 1) {
        break;
      }
      auto body = reader.Bytes(*size);
      if (!body) {
        break;
      }
      ApplyCommand(&state, (*body)[0], body->subspan(1u));
    }
  } else if (*version == 5) {
    if (!key || key->windows || key->cbc_key.empty()) {
      error->code = "locked";
      error->message = "This session file is encrypted; unlock the browser first";
      return false;
    }
    bool saw_marker = false;
    while (true) {
      auto size = reader.U32();
      if (!size) {
        break;
      }
      auto blob = reader.Bytes(*size);
      if (!blob) {
        break;
      }
      if (blob->size() < 3) {
        break;
      }
      std::optional<std::string> plain =
          AesCbcDecrypt(key->cbc_key, blob->subspan(3u));
      if (!plain || plain->empty()) {
        break;
      }
      base::span<const uint8_t> bytes = base::as_byte_span(*plain);
      if (bytes.size() == 1 && bytes[0] == 255) {
        saw_marker = true;
      }
      ApplyCommand(&state, bytes[0], bytes.subspan(1u));
    }
    if (!saw_marker) {
      error->code = "locked";
      error->message = "Couldn't decrypt the session file with this key";
      return false;
    }
  } else {
    error->code = "unsupported";
    error->message = "Unsupported session file version";
    return false;
  }
  SessionToTabs(state, tabs, groups);
  return true;
}

std::string DecodeEntities(const std::string& s) {
  if (s.find('&') == std::string::npos) {
    return s;
  }
  std::string out;
  for (size_t i = 0; i < s.size();) {
    if (s[i] == '&') {
      size_t semi = s.find(';', i);
      if (semi != std::string::npos && semi - i <= 12) {
        std::string name = s.substr(i + 1, semi - i - 1);
        std::optional<std::string> replacement;
        if (name == "amp") {
          replacement = "&";
        } else if (name == "lt") {
          replacement = "<";
        } else if (name == "gt") {
          replacement = ">";
        } else if (name == "quot") {
          replacement = "\"";
        } else if (name == "apos") {
          replacement = "'";
        } else if (name == "nbsp") {
          replacement = "\xC2\xA0";
        } else if ((base::StartsWith(name, "#x") ||
                    base::StartsWith(name, "#X"))) {
          uint32_t v = 0;
          if (base::HexStringToUInt(name.substr(2), &v) && v <= 0x10FFFF) {
            std::u16string u = {static_cast<char16_t>(v)};
            replacement = base::UTF16ToUTF8(u);
          }
        } else if (base::StartsWith(name, "#")) {
          uint32_t v = 0;
          if (base::StringToUint(name.substr(1), &v) && v <= 0x10FFFF) {
            std::u16string u = {static_cast<char16_t>(v)};
            replacement = base::UTF16ToUTF8(u);
          }
        }
        if (replacement) {
          out += *replacement;
          i = semi + 1;
          continue;
        }
      }
    }
    out.push_back(s[i]);
    ++i;
  }
  return out;
}

std::optional<double> BookmarkSeconds(const std::string* text) {
  double v = 0;
  if (!text || !base::StringToDouble(*text, &v) || v <= 0) {
    return std::nullopt;
  }
  return v * 1000.0;
}

base::DictValue ParseNetscapeBookmarks(const std::string& html) {
  struct Node {
    base::DictValue dict;
  };
  auto make_folder = [](const std::string& title) {
    base::DictValue folder;
    folder.Set("type", "folder");
    folder.Set("title", title);
    folder.Set("children", base::ListValue());
    return folder;
  };
  std::vector<base::DictValue> stack;
  stack.push_back(make_folder("Bookmarks"));
  std::optional<base::DictValue> pending;
  bool saw_root = false;

  auto append_child = [](base::DictValue& parent, base::DictValue child) {
    base::ListValue* children = parent.FindList("children");
    if (!children) {
      parent.Set("children", base::ListValue());
      children = parent.FindList("children");
    }
    children->Append(std::move(child));
  };

  size_t i = 0;
  const size_t n = html.size();
  auto lower = [](std::string s) { return base::ToLowerASCII(s); };

  auto read_text_until = [&](const std::string& tag) -> std::string {
    std::string out;
    while (i < n) {
      if (html[i] == '<') {
        size_t save = i;
        size_t j = i + 1;
        bool closing = j < n && html[j] == '/';
        if (closing) {
          ++j;
        }
        std::string name;
        while (j < n && (base::IsAsciiAlpha(html[j]) ||
                         base::IsAsciiDigit(html[j]))) {
          name.push_back(html[j]);
          ++j;
        }
        std::string lname = lower(name);
        if (closing && lname == tag) {
          i = save;
          return out;
        }
        if (!closing && (lname == "dt" || lname == "dl" || lname == "h3" ||
                         lname == "a")) {
          i = save;
          return out;
        }
        i = save + 1;
        continue;
      }
      out.push_back(html[i]);
      ++i;
    }
    return out;
  };

  while (i < n) {
    if (html[i] != '<') {
      ++i;
      continue;
    }
    if (i + 3 < n && html[i + 1] == '!' && html[i + 2] == '-' &&
        html[i + 3] == '-') {
      i += 4;
      while (i + 2 < n &&
             !(html[i] == '-' && html[i + 1] == '-' && html[i + 2] == '>')) {
        ++i;
      }
      i += 3;
      continue;
    }
    ++i;
    bool closing = i < n && html[i] == '/';
    if (closing) {
      ++i;
    }
    std::string name;
    while (i < n && (base::IsAsciiAlpha(html[i]) || base::IsAsciiDigit(html[i]))) {
      name.push_back(html[i]);
      ++i;
    }
    if (name.empty()) {
      continue;
    }
    std::map<std::string, std::string> attrs;
    while (i < n && html[i] != '>') {
      if (base::IsAsciiWhitespace(html[i]) || html[i] == '/') {
        ++i;
        continue;
      }
      std::string key;
      while (i < n && !base::IsAsciiWhitespace(html[i]) && html[i] != '=' &&
             html[i] != '>') {
        key.push_back(html[i]);
        ++i;
      }
      std::string value;
      if (i < n && html[i] == '=') {
        ++i;
        if (i < n && (html[i] == '"' || html[i] == '\'')) {
          char quote = html[i];
          ++i;
          while (i < n && html[i] != quote) {
            value.push_back(html[i]);
            ++i;
          }
          if (i < n) {
            ++i;
          }
        } else {
          while (i < n && !base::IsAsciiWhitespace(html[i]) && html[i] != '>') {
            value.push_back(html[i]);
            ++i;
          }
        }
      }
      if (!key.empty()) {
        attrs[lower(key)] = value;
      }
    }
    if (i < n) {
      ++i;
    }
    std::string tag = lower(name);

    if (!closing && tag == "h3") {
      std::string title = DecodeEntities(read_text_until("h3"));
      title = std::string(base::TrimWhitespaceASCII(title, base::TRIM_ALL));
      base::DictValue folder = make_folder(title);
      auto attr = [&](const std::string& k) -> const std::string* {
        auto it = attrs.find(k);
        return it == attrs.end() ? nullptr : &it->second;
      };
      if ((attr("personal_toolbar_folder") &&
           base::ToLowerASCII(*attr("personal_toolbar_folder")) == "true") ||
          (attr("id") && *attr("id") == "com.apple.FavoritesBar")) {
        folder.Set("role", "toolbar");
      } else if (attr("unfiled_bookmarks_folder") &&
                 base::ToLowerASCII(*attr("unfiled_bookmarks_folder")) ==
                     "true") {
        folder.Set("role", "other");
      } else if (attr("id") && *attr("id") == "com.apple.ReadingList") {
        folder.Set("role", "readingList");
      }
      if (std::optional<double> added = BookmarkSeconds(attr("add_date"))) {
        folder.Set("dateAdded", *added);
      }
      if (pending) {
        append_child(stack.back(), std::move(*pending));
      }
      pending = std::move(folder);
    } else if (!closing && tag == "dl") {
      if (pending) {
        stack.push_back(std::move(*pending));
        pending.reset();
      } else if (!saw_root) {
        saw_root = true;
      } else {
        stack.push_back(make_folder(""));
      }
    } else if (closing && tag == "dl") {
      if (pending) {
        append_child(stack.back(), std::move(*pending));
        pending.reset();
      }
      if (stack.size() > 1) {
        base::DictValue done = std::move(stack.back());
        stack.pop_back();
        append_child(stack.back(), std::move(done));
      }
    } else if (!closing && tag == "a") {
      std::string title = DecodeEntities(read_text_until("a"));
      title = std::string(base::TrimWhitespaceASCII(title, base::TRIM_ALL));
      auto href_it = attrs.find("href");
      if (href_it == attrs.end() || href_it->second.empty()) {
        continue;
      }
      std::string href = DecodeEntities(href_it->second);
      if (pending) {
        append_child(stack.back(), std::move(*pending));
        pending.reset();
      }
      base::DictValue link;
      link.Set("type", "url");
      link.Set("title", title.empty() ? href : title);
      link.Set("url", href);
      auto date_it = attrs.find("add_date");
      if (std::optional<double> added = BookmarkSeconds(
              date_it == attrs.end() ? nullptr : &date_it->second)) {
        link.Set("dateAdded", *added);
      }
      append_child(stack.back(), std::move(link));
    }
  }
  if (pending) {
    append_child(stack.back(), std::move(*pending));
  }
  while (stack.size() > 1) {
    base::DictValue done = std::move(stack.back());
    stack.pop_back();
    append_child(stack.back(), std::move(done));
  }
  return std::move(stack.front());
}

std::vector<std::vector<std::string>> ParseCsv(const std::string& text) {
  std::vector<std::vector<std::string>> rows;
  std::vector<std::string> row;
  std::string field;
  bool quoted = false;
  size_t i = 0;
  if (text.size() >= 3 && static_cast<uint8_t>(text[0]) == 0xEF &&
      static_cast<uint8_t>(text[1]) == 0xBB &&
      static_cast<uint8_t>(text[2]) == 0xBF) {
    i = 3;
  }
  auto end_row = [&]() {
    row.push_back(field);
    field.clear();
    if (!(row.size() == 1 && row[0].empty())) {
      rows.push_back(row);
    }
    row.clear();
  };
  for (; i < text.size(); ++i) {
    char c = text[i];
    if (quoted) {
      if (c == '"') {
        if (i + 1 < text.size() && text[i + 1] == '"') {
          field.push_back('"');
          ++i;
        } else {
          quoted = false;
        }
      } else {
        field.push_back(c);
      }
      continue;
    }
    if (c == '"' && field.empty()) {
      quoted = true;
    } else if (c == ',') {
      row.push_back(field);
      field.clear();
    } else if (c == '\r') {
      if (i + 1 < text.size() && text[i + 1] == '\n') {
        ++i;
      }
      end_row();
    } else if (c == '\n') {
      end_row();
    } else {
      field.push_back(c);
    }
  }
  if (!field.empty() || !row.empty()) {
    end_row();
  }
  return rows;
}

bool ParsePasswordsCsv(const std::string& text,
                       base::ListValue* out,
                       ImportError* error) {
  std::vector<std::vector<std::string>> rows = ParseCsv(text);
  if (rows.empty()) {
    error->code = "unreadable";
    error->message = "The file is empty";
    return false;
  }
  std::vector<std::string> header;
  for (const std::string& h : rows[0]) {
    header.push_back(
        base::ToLowerASCII(std::string(base::TrimWhitespaceASCII(h, base::TRIM_ALL))));
  }
  auto column = [&](const std::vector<std::string>& keys) -> std::optional<size_t> {
    for (const std::string& key : keys) {
      auto it = std::find(header.begin(), header.end(), key);
      if (it != header.end()) {
        return static_cast<size_t>(it - header.begin());
      }
    }
    return std::nullopt;
  };
  auto single = [&](const std::string& key) -> std::optional<size_t> {
    auto it = std::find(header.begin(), header.end(), key);
    return it == header.end() ? std::nullopt
                              : std::optional<size_t>(it - header.begin());
  };
  std::optional<size_t> url = column(
      {"url", "login_uri", "website", "web site", "origin", "hostname",
       "login url"});
  std::optional<size_t> pass = column({"password", "login_password", "pass"});
  if (!url || !pass) {
    error->code = "unsupported";
    error->message = "This CSV doesn't have url and password columns";
    return false;
  }
  std::optional<size_t> user =
      column({"username", "login_username", "login", "user", "email", "user name"});
  std::optional<size_t> title = column({"name", "title"});
  std::optional<size_t> note = column({"note", "notes", "extra"});
  std::optional<size_t> otp = single("otpauth");
  std::optional<size_t> realm = single("httprealm");
  std::optional<size_t> created = single("timecreated");
  std::optional<size_t> last_used = single("timelastused");

  auto field = [](const std::vector<std::string>& row,
                  std::optional<size_t> idx) -> std::optional<std::string> {
    if (!idx || *idx >= row.size() || row[*idx].empty()) {
      return std::nullopt;
    }
    return row[*idx];
  };

  for (size_t r = 1; r < rows.size(); ++r) {
    const std::vector<std::string>& row = rows[r];
    std::optional<std::string> site = field(row, url);
    std::optional<std::string> password = field(row, pass);
    if (!site || !password) {
      continue;
    }
    base::DictValue item;
    item.Set("url", *site);
    item.Set("username", field(row, user).value_or(""));
    item.Set("password", *password);
    if (std::optional<std::string> v = field(row, realm)) {
      item.Set("realm", *v);
    }
    if (std::optional<std::string> v = field(row, title)) {
      item.Set("title", *v);
    }
    if (std::optional<std::string> v = field(row, note)) {
      item.Set("note", *v);
    }
    if (std::optional<std::string> v = field(row, otp)) {
      item.Set("otpAuth", *v);
    }
    double number = 0;
    if (std::optional<std::string> v = field(row, created)) {
      if (base::StringToDouble(*v, &number)) {
        item.Set("created", number);
      }
    }
    if (std::optional<std::string> v = field(row, last_used)) {
      if (base::StringToDouble(*v, &number)) {
        item.Set("lastUsed", number);
      }
    }
    out->Append(std::move(item));
  }
  return true;
}

base::DictValue BuildSource(const Def& def,
                            const std::vector<DiscoveredProfile>& profiles) {
  base::DictValue source;
  source.Set("id", def.id);
  source.Set("name", def.name);
  source.Set("family", FamilyName(def.family));
  source.Set("requiresExport", false);
  bool has_passwords = false;
  base::ListValue profile_list;
  for (const DiscoveredProfile& profile : profiles) {
    base::DictValue dict;
    dict.Set("id", profile.id);
    dict.Set("name", profile.name);
    dict.Set("path", profile.path);
    if (profile.email) {
      dict.Set("email", *profile.email);
    }
    if (profile.avatar_path) {
      dict.Set("avatarPath", *profile.avatar_path);
    }
    if (profile.color) {
      dict.Set("color", *profile.color);
    }
    dict.Set("isDefault", profile.is_default);
    base::ListValue available;
    for (const std::string& kind : profile.available) {
      available.Append(kind);
      if (kind == "passwords") {
        has_passwords = true;
      }
    }
    dict.Set("available", std::move(available));
    profile_list.Append(std::move(dict));
  }
  bool needs_keychain = false;
#if BUILDFLAG(IS_LINUX)
  needs_keychain = def.family != Family::kFirefox && has_passwords;
#else
  std::ignore = has_passwords;
#endif
  source.Set("needsKeychain", needs_keychain);
  source.Set("needsFullDiskAccess", false);
  source.Set("profiles", std::move(profile_list));
  return source;
}

base::ListValue ListBrowsers() {
  base::ListValue out;
  static const base::NoDestructor<std::vector<Def>> defs(Definitions());
  for (const Def& def : *defs) {
    if (def.family == Family::kArc) {
      continue;
    }
#if BUILDFLAG(IS_LINUX)
    if (def.win_only) {
      continue;
    }
#endif
    std::vector<DiscoveredProfile> profiles;
    if (def.family == Family::kFirefox) {
      profiles = FirefoxProfiles(def);
    } else {
      base::FilePath dir = DataDir(def);
      if (dir.empty() || !base::PathExists(dir)) {
        continue;
      }
      profiles = ChromiumProfiles(def);
    }
    if (profiles.empty()) {
      continue;
    }
    out.Append(BuildSource(def, profiles));
  }
  return out;
}

const char* const kKindOrder[] = {"bookmarks", "history",  "tabs",
                                   "passwords", "cookies",  "autofill",
                                   "spaces",    "pinnedTabs", "favorites"};

std::string CountWord(int n, const std::string& word) {
  return base::NumberToString(n) + " " + word + (n == 1 ? "" : "s");
}

base::DictValue RunImport(const std::string& job_id,
                          const std::string& browser_id,
                          const std::string& profile_id,
                          const std::vector<std::string>& kinds,
                          const HistoryOptions& history_options,
                          std::atomic<bool>* cancel,
                          const Event& event,
                          scoped_refptr<base::SequencedTaskRunner> reply,
                          ImportError* fatal) {
  const Def* def = FindDef(browser_id);
  base::DictValue result;
  if (!def) {
    fatal->code = "notFound";
    fatal->message = "Unknown browser " + browser_id;
    return result;
  }
  base::FilePath dir = ProfileDir(*def, profile_id);
  if (dir.empty() || !base::PathExists(dir)) {
    fatal->code = "notFound";
    fatal->message = "Profile " + profile_id + " not found";
    return result;
  }

  result.Set("browserId", browser_id);
  result.Set("profileId", profile_id);
  base::ListValue history;
  base::ListValue tabs;
  base::ListValue tab_groups;
  base::ListValue credentials;
  base::ListValue spaces;
  base::ListValue favorites;
  base::ListValue failed;
  base::ListValue warnings;
  int history_count = 0;

  auto warn = [&](const std::string& kind, const std::string& code,
                  const std::string& message) {
    base::DictValue w;
    if (!kind.empty()) {
      w.Set("kind", kind);
    }
    w.Set("code", code);
    w.Set("message", message);
    warnings.Append(std::move(w));
  };
  auto send_progress = [&](const std::string& kind, const char* phase,
                           int processed) {
    base::DictValue body;
    body.Set("jobId", job_id);
    body.Set("type", "progress");
    body.Set("kind", kind);
    body.Set("phase", phase);
    body.Set("processed", processed);
    reply->PostTask(FROM_HERE, base::BindOnce(event, std::move(body)));
  };

  std::optional<BrowserKey> key = ImportState::Get().KeyFor(browser_id);
#if BUILDFLAG(IS_WIN)
  if (!key && ImportState::Get().Unlock(browser_id, nullptr)) {
    key = ImportState::Get().KeyFor(browser_id);
  }
#endif

  for (const char* ordered : kKindOrder) {
    std::string kind = ordered;
    if (std::find(kinds.begin(), kinds.end(), kind) == kinds.end()) {
      continue;
    }
    if (cancel->load()) {
      fatal->code = "cancelled";
      fatal->message = "Import cancelled";
      return result;
    }
    if (kind != "history") {
      send_progress(kind, "start", 0);
    }
    int count = 0;
    bool succeeded = false;
    ImportError error;

    if (kind == "bookmarks" &&
        (def->family == Family::kChromium || def->family == Family::kArc)) {
      std::optional<base::DictValue> bookmarks = LoadChromiumBookmarks(dir);
      if (bookmarks) {
        count = BookmarkLinkCount(*bookmarks);
        result.Set("bookmarks", std::move(*bookmarks));
        succeeded = true;
      } else {
        error.code = "empty";
        error.message = "No bookmarks in this profile";
      }
    } else if (kind == "bookmarks" && def->family == Family::kFirefox) {
      std::optional<base::DictValue> bookmarks =
          LoadFirefoxBookmarks(dir.AppendASCII("places.sqlite"), &error);
      if (bookmarks) {
        count = BookmarkLinkCount(*bookmarks);
        result.Set("bookmarks", std::move(*bookmarks));
        succeeded = true;
      }
    } else if (kind == "history") {
      HistoryOutcome outcome;
      if (ReadHistory(dir.AppendASCII(def->family == Family::kFirefox
                                          ? "places.sqlite"
                                          : "History"),
                      def->family == Family::kFirefox, history_options, job_id,
                      cancel, event, reply, &outcome, &error)) {
        history = std::move(outcome.entries);
        history_count = outcome.count;
        count = outcome.count;
        succeeded = true;
      }
    } else if (kind == "tabs" && def->family == Family::kChromium) {
      if (ReadSession(dir, key, &tabs, &tab_groups, &error)) {
        count = static_cast<int>(tabs.size());
        succeeded = true;
      }
    } else if (kind == "passwords" &&
               (def->family == Family::kChromium ||
                def->family == Family::kArc)) {
      if (!key) {
        error.code = "locked";
        error.message = "Unlock " + def->name + " to import passwords";
      } else {
        LoginsOutcome outcome;
        if (ReadLogins(dir, *key, cancel, &outcome, &error)) {
          count = static_cast<int>(outcome.items.size());
          credentials = std::move(outcome.items);
          succeeded = true;
          if (outcome.undecryptable > 0) {
            warn(kind, "undecryptable",
                 CountWord(outcome.undecryptable, "password") +
                     " couldn't be decrypted");
            if (credentials.empty()) {
              error.code = "locked";
              error.message =
                  "The " + def->name + " key didn't decrypt any passwords";
              succeeded = false;
            }
          }
        }
      }
    } else {
      error.code = "unsupported";
      error.message = def->name + " has no " + kind + " to import";
    }

    if (error.code == "cancelled") {
      fatal->code = "cancelled";
      fatal->message = "Import cancelled";
      return result;
    }
    if (!succeeded) {
      if (error.code == "empty") {
        warn(kind, "empty", error.message);
      } else {
        failed.Append(kind);
        warn(kind, error.code.empty() ? "unreadable" : error.code,
             error.message);
      }
    }
    if (kind != "history" || !succeeded) {
      send_progress(kind, "end", count);
    }
  }

  result.Set("history", std::move(history));
  result.Set("historyCount", history_count);
  result.Set("tabs", std::move(tabs));
  result.Set("tabGroups", std::move(tab_groups));
  result.Set("credentials", std::move(credentials));
  result.Set("spaces", std::move(spaces));
  result.Set("favorites", std::move(favorites));
  result.Set("failed", std::move(failed));
  result.Set("warnings", std::move(warnings));
  result.Set("cookieCount", 0);
  result.Set("addressCount", 0);
  result.Set("cardCount", 0);
  return result;
}

const scoped_refptr<base::SequencedTaskRunner>& Sequence() {
  static base::NoDestructor<scoped_refptr<base::SequencedTaskRunner>> sequence(
      base::ThreadPool::CreateSequencedTaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE}));
  return *sequence;
}

void RunListBrowsers(scoped_refptr<base::SequencedTaskRunner> reply,
                     Done done) {
  Sequence()->PostTask(
      FROM_HERE,
      base::BindOnce(
          [](scoped_refptr<base::SequencedTaskRunner> reply, Done done) {
            base::ListValue list = ListBrowsers();
            base::DictValue reply_value = JsonReply(list);
            reply->PostTask(FROM_HERE,
                            base::BindOnce(std::move(done), std::move(reply_value)));
          },
          std::move(reply), std::move(done)));
}

void RunReadFile(const std::string& method,
                 base::FilePath path,
                 scoped_refptr<base::SequencedTaskRunner> reply,
                 Done done) {
  Sequence()->PostTask(
      FROM_HERE,
      base::BindOnce(
          [](std::string method, base::FilePath path,
             scoped_refptr<base::SequencedTaskRunner> reply, Done done) {
            base::DictValue reply_value;
            std::string data;
            if (!base::ReadFileToString(path, &data)) {
              reply_value = ErrorReply("notFound",
                                       "Couldn't read " + path.AsUTF8Unsafe());
            } else if (method == "importBookmarksHTML") {
              base::DictValue node = ParseNetscapeBookmarks(data);
              if (BookmarkLinkCount(node) == 0 &&
                  (node.FindList("children") == nullptr ||
                   node.FindList("children")->empty())) {
                reply_value = ErrorReply("unreadable", "No bookmarks found");
              } else {
                reply_value = JsonReply(node);
              }
            } else {
              base::ListValue items;
              ImportError error;
              if (ParsePasswordsCsv(data, &items, &error)) {
                reply_value = JsonReply(items);
              } else {
                reply_value = ErrorReply(error.code, error.message);
              }
            }
            reply->PostTask(FROM_HERE, base::BindOnce(std::move(done),
                                                      std::move(reply_value)));
          },
          method, std::move(path), std::move(reply), std::move(done)));
}

void RunListExtensions(const std::string& browser_id,
                       const std::string& profile_id,
                       scoped_refptr<base::SequencedTaskRunner> reply,
                       Done done) {
  Sequence()->PostTask(
      FROM_HERE,
      base::BindOnce(
          [](std::string browser_id, std::string profile_id,
             scoped_refptr<base::SequencedTaskRunner> reply, Done done) {
            const Def* def = FindDef(browser_id);
            base::ListValue list;
            if (def && (def->family == Family::kChromium ||
                        def->family == Family::kArc)) {
              base::FilePath dir = ProfileDir(*def, profile_id);
              if (!dir.empty() && base::PathExists(dir)) {
                list = ListExtensions(dir);
              }
            }
            base::DictValue reply_value = JsonReply(list);
            reply->PostTask(FROM_HERE, base::BindOnce(std::move(done),
                                                      std::move(reply_value)));
          },
          browser_id, profile_id, std::move(reply), std::move(done)));
}

HistoryOptions ParseHistoryOptions(const base::DictValue& args) {
  HistoryOptions options;
  if (std::optional<int> limit = args.FindInt("historyLimit")) {
    options.limit = *limit;
  }
  if (std::optional<double> since = args.FindDouble("historySince")) {
    options.since_ms = *since;
  }
  options.stream = args.FindBool("streamHistory").value_or(false);
  if (std::optional<int> chunk = args.FindInt("chunkSize")) {
    options.chunk_size = std::max(1, *chunk);
  }
  return options;
}

}

void ImportCall(const std::string& method,
                base::DictValue args,
                Event event,
                Done done) {
  scoped_refptr<base::SequencedTaskRunner> reply =
      base::SequencedTaskRunner::GetCurrentDefault();

  if (method == "listBrowsers") {
    RunListBrowsers(reply, std::move(done));
    return;
  }

  if (method == "isBrowserUnlocked") {
    const std::string* id = args.FindString("browserId");
    bool unlocked = id && ImportState::Get().IsUnlocked(*id);
    std::move(done).Run(JsonReply(base::Value(unlocked)));
    return;
  }

  if (method == "forgetUnlockedKeys") {
    ImportState::Get().Forget();
    std::move(done).Run(JsonReply(base::Value()));
    return;
  }

  if (method == "cancelImport") {
    const std::string* job_id = args.FindString("jobId");
    if (job_id) {
      ImportState::Get().CancelJob(*job_id);
    }
    std::move(done).Run(JsonReply(base::Value()));
    return;
  }

  if (method == "unlockBrowser") {
    const std::string* id = args.FindString("browserId");
    std::string browser_id = id ? *id : std::string();
    Sequence()->PostTask(
        FROM_HERE,
        base::BindOnce(
            [](std::string browser_id,
               scoped_refptr<base::SequencedTaskRunner> reply, Done done) {
              std::string message;
              base::DictValue reply_value;
              if (ImportState::Get().Unlock(browser_id, &message)) {
                reply_value = JsonReply(base::Value());
              } else {
                reply_value = ErrorReply(
                    "locked", message.empty() ? "Couldn't unlock the browser"
                                              : message);
              }
              reply->PostTask(FROM_HERE, base::BindOnce(std::move(done),
                                                        std::move(reply_value)));
            },
            browser_id, reply, std::move(done)));
    return;
  }

  if (method == "listExtensions") {
    const std::string* browser_id = args.FindString("browserId");
    const std::string* profile_id = args.FindString("profileId");
    RunListExtensions(browser_id ? *browser_id : std::string(),
                      profile_id ? *profile_id : std::string(), reply,
                      std::move(done));
    return;
  }

  if (method == "importBookmarksHTML" || method == "importPasswordsCSV") {
    const std::string* path = args.FindString("path");
    RunReadFile(method,
                base::FilePath::FromUTF8Unsafe(path ? *path : std::string()),
                reply, std::move(done));
    return;
  }

  if (method == "importData") {
    const std::string* job_id = args.FindString("jobId");
    const std::string* browser_id = args.FindString("browserId");
    const std::string* profile_id = args.FindString("profileId");
    if (!job_id || !browser_id || !profile_id) {
      std::move(done).Run(ErrorReply("unreadable", "Missing import arguments"));
      return;
    }
    std::vector<std::string> kinds;
    if (const base::ListValue* list = args.FindList("kinds")) {
      for (const base::Value& v : *list) {
        if (v.is_string()) {
          kinds.push_back(v.GetString());
        }
      }
    }
    HistoryOptions history_options = ParseHistoryOptions(args);
    std::shared_ptr<std::atomic<bool>> cancel =
        ImportState::Get().StartJob(*job_id);
    Sequence()->PostTask(
        FROM_HERE,
        base::BindOnce(
            [](std::string job_id, std::string browser_id,
               std::string profile_id, std::vector<std::string> kinds,
               HistoryOptions history_options,
               std::shared_ptr<std::atomic<bool>> cancel, Event event,
               scoped_refptr<base::SequencedTaskRunner> reply, Done done) {
              ImportError fatal;
              base::DictValue result =
                  RunImport(job_id, browser_id, profile_id, kinds,
                            history_options, cancel.get(), event, reply, &fatal);
              base::DictValue reply_value =
                  fatal.code.empty() ? JsonReply(result)
                                     : ErrorReply(fatal.code, fatal.message);
              ImportState::Get().FinishJob(job_id);
              reply->PostTask(FROM_HERE, base::BindOnce(std::move(done),
                                                        std::move(reply_value)));
            },
            *job_id, *browser_id, *profile_id, std::move(kinds),
            history_options, std::move(cancel), event, reply,
            std::move(done)));
    return;
  }

  std::move(done).Run(ErrorReply("unsupported", "Unknown method " + method));
}

}

