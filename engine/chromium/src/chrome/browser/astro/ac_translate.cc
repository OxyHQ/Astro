// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_translate.h"

#include <algorithm>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/containers/fixed_flat_set.h"
#include "base/files/file.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/important_file_writer.h"
#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "base/i18n/language_tag.h"
#include "base/json/json_reader.h"
#include "base/memory/scoped_refptr.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "chrome/browser/profiles/profile.h"
#include "components/translate/core/language_detection/language_detection_util.h"
#include "crypto/hash.h"
#include "net/base/net_errors.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "net/http/http_request_headers.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "third_party/zstd/src/lib/zstd.h"
#include "url/gurl.h"

namespace astro {
namespace {

using Done = base::OnceCallback<void(base::Value)>;

constexpr base::FilePath::CharType kTranslationsDirectory[] =
    FILE_PATH_LITERAL("Astro Translations");
constexpr base::FilePath::CharType kDownloadExtension[] =
    FILE_PATH_LITERAL(".download");
constexpr char kRecordsUrl[] =
    "https://firefox.settings.services.mozilla.com/v1/buckets/main/"
    "collections/";
constexpr char kAttachmentsUserAgent[] = "Astro";
constexpr char kAttachmentsUrl[] =
    "https://firefox-settings-attachments.cdn.mozilla.net/";
constexpr auto kCollections = base::MakeFixedFlatSet<std::string_view>({
    "translations-models-v2",
    "translations-wasm-v2",
});
constexpr size_t kHashLength = 64;
constexpr size_t kMaxLocationLength = 512;
constexpr size_t kMaxRecordsBytes = 5 * 1024 * 1024;
constexpr int64_t kMaxAttachmentBytes = 192 * 1024 * 1024;
constexpr int64_t kMaxPlainBytes = 256 * 1024 * 1024;
constexpr size_t kMaxDetectBytes = 64 * 1024;
constexpr size_t kMaxNames = 64;
constexpr base::TimeDelta kRecordsFresh = base::Hours(24);

constexpr net::NetworkTrafficAnnotationTag kAnnotation =
    net::DefineNetworkTrafficAnnotation("astro_translation_models", R"(
      semantics {
        sender: "Astro page translation"
        description:
          "Astro translates pages on the device with Mozilla's Bergamot "
          "translator. It downloads the list of language models and the "
          "translator from Mozilla's Remote Settings service, then the model "
          "files for the languages the user translates between. Page text "
          "never leaves the device."
        trigger:
          "Opening a page in another language, or translating one."
        data: "None: the requests name only the files they fetch."
        destination: OTHER
      }
      policy {
        cookies_allowed: NO
        setting: "Not translating pages."
        policy_exception_justification: "Not implemented."
      })");

struct Attachment {
  std::string location;
  std::string sha256;
  int64_t size = 0;
  std::string plain_sha256;
  int64_t plain_size = 0;
};

struct CachedRecords {
  std::string json;
  bool fresh = false;
};

const scoped_refptr<base::SequencedTaskRunner>& Sequence() {
  static base::NoDestructor<scoped_refptr<base::SequencedTaskRunner>> sequence(
      base::ThreadPool::CreateSequencedTaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
           base::TaskShutdownBehavior::SKIP_ON_SHUTDOWN}));
  return *sequence;
}

std::map<base::FilePath, std::vector<Done>>& Waiting() {
  static base::NoDestructor<std::map<base::FilePath, std::vector<Done>>>
      waiting;
  return *waiting;
}

base::Value Failure(std::string_view message) {
  return base::Value(base::DictValue().Set("error", message));
}

bool IsHash(std::string_view text) {
  return text.size() == kHashLength && std::ranges::all_of(text, [](char c) {
           return base::IsAsciiDigit(c) || (c >= 'a' && c <= 'f');
         });
}

bool IsLocation(std::string_view location) {
  return !location.empty() && location.size() <= kMaxLocationLength &&
         location.front() != '/' &&
         location.find("..") == std::string_view::npos &&
         std::ranges::all_of(location, [](char c) {
           return base::IsAsciiAlphaNumeric(c) || c == '-' || c == '_' ||
                  c == '.' || c == '/';
         });
}

std::optional<int64_t> Size(const base::DictValue& args, std::string_view key) {
  const base::Value* value = args.Find(key);
  if (!value) {
    return std::nullopt;
  }
  if (value->is_int()) {
    return value->GetInt();
  }
  if (value->is_double() && value->GetDouble() >= 0 &&
      value->GetDouble() <= static_cast<double>(kMaxPlainBytes)) {
    return static_cast<int64_t>(value->GetDouble());
  }
  return std::nullopt;
}

std::string Sha256(std::string_view data) {
  return base::HexEncodeLower(crypto::hash::Sha256(data));
}

base::FilePath Directory(Profile* profile) {
  return profile->GetPath().Append(kTranslationsDirectory);
}

base::Value Detect(std::string text) {
  bool reliable = false;
  float score = 0;
  std::optional<base::i18n::LanguageTag> language =
      translate::DetermineTextLanguage(text, &reliable, score);
  base::DictValue result;
  result.Set("reliable", reliable);
  result.Set("score", static_cast<double>(score));
  if (language) {
    result.Set("language", std::string(language->tag_string()));
  }
  return base::Value(std::move(result));
}

std::optional<CachedRecords> ReadRecords(const base::FilePath& file) {
  base::File::Info info;
  std::string json;
  if (!base::GetFileInfo(file, &info) ||
      !base::ReadFileToStringWithMaxSize(file, &json, kMaxRecordsBytes)) {
    return std::nullopt;
  }
  return CachedRecords{std::move(json),
                       base::Time::Now() - info.last_modified < kRecordsFresh};
}

bool IsRecordList(std::string_view json) {
  std::optional<base::DictValue> parsed =
      base::JSONReader::ReadDict(json, base::JSON_PARSE_RFC);
  return parsed && parsed->FindList("data");
}

void RecordsFetched(base::FilePath file,
                    std::optional<CachedRecords> cached,
                    Done done,
                    std::unique_ptr<network::SimpleURLLoader> loader,
                    std::optional<std::string> body) {
  if (body && IsRecordList(*body)) {
    Sequence()->PostTask(FROM_HERE,
                         base::BindOnce(
                             [](base::FilePath file, std::string json) {
                               if (base::CreateDirectory(file.DirName())) {
                                 base::ImportantFileWriter::WriteFileAtomically(
                                     file, json);
                               }
                             },
                             file, *body));
    std::move(done).Run(
        base::Value(base::DictValue().Set("records", std::move(*body))));
    return;
  }
  if (cached) {
    std::move(done).Run(base::Value(base::DictValue()
                                        .Set("records", std::move(cached->json))
                                        .Set("stale", true)));
    return;
  }
  std::move(done).Run(Failure(body ? "the language list is unreadable"
                                   : net::ErrorToString(loader->NetError())));
}

void FetchRecords(scoped_refptr<network::SharedURLLoaderFactory> factory,
                  std::string collection,
                  base::FilePath file,
                  bool refresh,
                  Done done,
                  std::optional<CachedRecords> cached) {
  if (cached && cached->fresh && !refresh) {
    std::move(done).Run(
        base::Value(base::DictValue().Set("records", std::move(cached->json))));
    return;
  }
  auto request = std::make_unique<network::ResourceRequest>();
  request->url = GURL(std::string(kRecordsUrl) + collection + "/records");
  request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  auto loader =
      network::SimpleURLLoader::Create(std::move(request), kAnnotation);
  loader->SetRetryOptions(
      2, network::SimpleURLLoader::RETRY_ON_NETWORK_CHANGE |
             network::SimpleURLLoader::RETRY_ON_NAME_NOT_RESOLVED);
  network::SimpleURLLoader* raw = loader.get();
  raw->DownloadToString(
      factory.get(),
      base::BindOnce(&RecordsFetched, std::move(file), std::move(cached),
                     std::move(done), std::move(loader)),
      kMaxRecordsBytes);
}

std::optional<std::string> Decompress(std::string_view compressed,
                                      int64_t expected) {
  std::unique_ptr<ZSTD_DCtx, decltype(&ZSTD_freeDCtx)> context(
      ZSTD_createDCtx(), &ZSTD_freeDCtx);
  if (!context || expected <= 0 || expected > kMaxPlainBytes) {
    return std::nullopt;
  }
  std::string plain(static_cast<size_t>(expected) + 1, '\0');
  ZSTD_inBuffer input = {compressed.data(), compressed.size(), 0};
  ZSTD_outBuffer output = {plain.data(), plain.size(), 0};
  size_t result = 0;
  do {
    result = ZSTD_decompressStream(context.get(), &output, &input);
    if (ZSTD_isError(result) || output.pos == output.size) {
      return std::nullopt;
    }
  } while (input.pos < input.size);
  if (result != 0) {
    return std::nullopt;
  }
  plain.resize(output.pos);
  return plain;
}

std::string Install(const base::FilePath& download,
                    const base::FilePath& target,
                    const Attachment& attachment) {
  std::string body;
  const bool read = base::ReadFileToStringWithMaxSize(
      download, &body, static_cast<size_t>(kMaxAttachmentBytes));
  base::DeleteFile(download);
  if (!read) {
    return "the download couldn't be read";
  }
  if (static_cast<int64_t>(body.size()) != attachment.size ||
      Sha256(body) != attachment.sha256) {
    return "the download doesn't match its record";
  }
  if (!attachment.plain_sha256.empty()) {
    std::optional<std::string> plain =
        Decompress(body, attachment.plain_size);
    if (!plain || static_cast<int64_t>(plain->size()) != attachment.plain_size ||
        Sha256(*plain) != attachment.plain_sha256) {
      return "the language file doesn't match its record";
    }
    body = std::move(*plain);
  }
  if (!base::ImportantFileWriter::WriteFileAtomically(target, body)) {
    return "the language file couldn't be saved";
  }
  return std::string();
}

void Finish(const base::FilePath& target, std::string error) {
  auto waiting = Waiting().extract(target);
  if (waiting.empty()) {
    return;
  }
  const std::string file =
      std::string(kTranslationFilesPath) + target.BaseName().AsUTF8Unsafe();
  for (Done& done : waiting.mapped()) {
    std::move(done).Run(error.empty()
                            ? base::Value(base::DictValue().Set("file", file))
                            : Failure(error));
  }
}

void Downloaded(base::FilePath target,
                Attachment attachment,
                std::unique_ptr<network::SimpleURLLoader> loader,
                base::FilePath download) {
  if (download.empty()) {
    return Finish(target, "the download failed (" +
                              net::ErrorToString(loader->NetError()) + ")");
  }
  Sequence()->PostTaskAndReplyWithResult(
      FROM_HERE, base::BindOnce(&Install, download, target, attachment),
      base::BindOnce(&Finish, target));
}

void DownloadIfMissing(scoped_refptr<network::SharedURLLoaderFactory> factory,
                       base::FilePath target,
                       Attachment attachment,
                       bool present) {
  if (present) {
    return Finish(target, std::string());
  }
  auto request = std::make_unique<network::ResourceRequest>();
  request->url = GURL(std::string(kAttachmentsUrl) + attachment.location);
  request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  request->headers.SetHeader(net::HttpRequestHeaders::kUserAgent,
                             kAttachmentsUserAgent);
  auto loader =
      network::SimpleURLLoader::Create(std::move(request), kAnnotation);
  loader->SetRetryOptions(
      2, network::SimpleURLLoader::RETRY_ON_NETWORK_CHANGE |
             network::SimpleURLLoader::RETRY_ON_NAME_NOT_RESOLVED);
  network::SimpleURLLoader* raw = loader.get();
  const base::FilePath download = target.AddExtension(kDownloadExtension);
  raw->DownloadToFile(factory.get(),
                      base::BindOnce(&Downloaded, target, std::move(attachment),
                                     std::move(loader)),
                      download, kMaxAttachmentBytes);
}

void Fetch(Profile* profile, const base::DictValue& args, Done done) {
  Attachment attachment;
  const std::string* location = args.FindString("location");
  const std::string* sha256 = args.FindString("sha256");
  const std::string* plain_sha256 = args.FindString("plainSha256");
  std::optional<int64_t> size = Size(args, "size");
  std::optional<int64_t> plain_size = Size(args, "plainSize");
  if (!location || !IsLocation(*location) || !sha256 || !IsHash(*sha256) ||
      !size || *size <= 0 || *size > kMaxAttachmentBytes ||
      (plain_sha256 && !plain_sha256->empty() &&
       (!IsHash(*plain_sha256) || !plain_size || *plain_size <= 0))) {
    return std::move(done).Run(Failure("not a language file"));
  }
  attachment.location = *location;
  attachment.sha256 = *sha256;
  attachment.size = *size;
  if (plain_sha256 && !plain_sha256->empty()) {
    attachment.plain_sha256 = *plain_sha256;
    attachment.plain_size = *plain_size;
  }
  const bool compressed = !attachment.plain_sha256.empty();
  const std::string& name =
      compressed ? attachment.plain_sha256 : attachment.sha256;
  const int64_t stored_size =
      compressed ? attachment.plain_size : attachment.size;
  const base::FilePath directory = Directory(profile);
  const base::FilePath target = directory.AppendASCII(name);
  std::vector<Done>& waiting = Waiting()[target];
  waiting.push_back(std::move(done));
  if (waiting.size() > 1) {
    return;
  }
  Sequence()->PostTaskAndReplyWithResult(
      FROM_HERE,
      base::BindOnce(
          [](base::FilePath directory, base::FilePath target,
             int64_t expected) {
            base::CreateDirectory(directory);
            std::optional<int64_t> size = base::GetFileSize(target);
            return size && *size == expected;
          },
          directory, target, stored_size),
      base::BindOnce(&DownloadIfMissing, profile->GetURLLoaderFactory(),
                     target, std::move(attachment)));
}

void Present(Profile* profile, const base::DictValue& args, Done done) {
  const base::ListValue* names = args.FindList("names");
  if (!names || names->size() > kMaxNames) {
    return std::move(done).Run(Failure("not a list of language files"));
  }
  std::vector<std::string> hashes;
  for (const base::Value& name : *names) {
    if (name.is_string() && IsHash(name.GetString())) {
      hashes.push_back(name.GetString());
    }
  }
  Sequence()->PostTaskAndReplyWithResult(
      FROM_HERE,
      base::BindOnce(
          [](base::FilePath directory, std::vector<std::string> hashes) {
            base::ListValue present;
            for (const std::string& hash : hashes) {
              if (base::PathExists(directory.AppendASCII(hash))) {
                present.Append(hash);
              }
            }
            return base::Value(base::DictValue().Set("present", std::move(present)));
          },
          Directory(profile), std::move(hashes)),
      std::move(done));
}

}

void TranslateCall(Profile* profile,
                   const std::string& method,
                   const base::DictValue& args,
                   Done done) {
  if (method == "detect") {
    const std::string* text = args.FindString("text");
    if (!text) {
      return std::move(done).Run(Failure("no text"));
    }
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE,
        {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
         base::TaskShutdownBehavior::SKIP_ON_SHUTDOWN},
        base::BindOnce(&Detect, std::string(base::TruncateUTF8ToByteSize(
                                    *text, kMaxDetectBytes))),
        std::move(done));
    return;
  }
  if (!profile || profile->IsOffTheRecord()) {
    return std::move(done).Run(Failure("no profile to keep languages in"));
  }
  if (method == "records") {
    const std::string* collection = args.FindString("collection");
    if (!collection || !kCollections.contains(*collection)) {
      return std::move(done).Run(Failure("not a language list"));
    }
    const base::FilePath file =
        Directory(profile).AppendASCII(*collection + ".json");
    Sequence()->PostTaskAndReplyWithResult(
        FROM_HERE, base::BindOnce(&ReadRecords, file),
        base::BindOnce(&FetchRecords, profile->GetURLLoaderFactory(),
                       *collection, file,
                       args.FindBool("refresh").value_or(false),
                       std::move(done)));
    return;
  }
  if (method == "fetch") {
    return Fetch(profile, args, std::move(done));
  }
  if (method == "present") {
    return Present(profile, args, std::move(done));
  }
  if (method == "clear") {
    Sequence()->PostTaskAndReplyWithResult(
        FROM_HERE,
        base::BindOnce(
            [](base::FilePath directory) {
              return base::Value(base::DictValue().Set(
                  "cleared", base::DeletePathRecursively(directory)));
            },
            Directory(profile)),
        std::move(done));
    return;
  }
  std::move(done).Run(Failure("not a translate call"));
}

std::optional<base::FilePath> TranslationFile(const base::FilePath& profile_dir,
                                              std::string_view path) {
  if (!base::StartsWith(path, kTranslationFilesPath)) {
    return std::nullopt;
  }
  std::string_view name = path.substr(sizeof(kTranslationFilesPath) - 1);
  name = name.substr(0, name.find_first_of("?#"));
  if (!IsHash(name)) {
    return std::nullopt;
  }
  return profile_dir.Append(kTranslationsDirectory).AppendASCII(name);
}

}
