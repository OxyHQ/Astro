// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_sync_files.h"

#include <algorithm>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/base64.h"
#include "base/environment.h"
#include "base/files/file_enumerator.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/important_file_writer.h"
#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "base/memory/scoped_refptr.h"
#include "base/no_destructor.h"
#include "base/path_service.h"
#include "base/strings/cstring_view.h"
#include "base/strings/strcat.h"
#include "base/strings/string_util.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "build/build_config.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/chrome_paths.h"
#include "components/os_crypt/async/browser/os_crypt_async.h"
#include "components/os_crypt/async/common/encryptor.h"
#include "net/base/network_interfaces.h"

namespace astro {
namespace {

using Done = base::OnceCallback<void(base::Value)>;

constexpr std::string_view kTagAlphabet = "abcdefghijklmnopqrstuvwxyz234567";
constexpr size_t kTagLength = 26;
constexpr size_t kMaxAccountLength = 64;
constexpr std::string_view kFileSuffix = ".nns";
constexpr size_t kMaxSyncFileBytes = 64 * 1024 * 1024;
constexpr size_t kMaxKeyFileBytes = 64 * 1024;
constexpr base::FilePath::CharType kFolderName[] =
    FILE_PATH_LITERAL("Astro Sync");
constexpr base::FilePath::CharType kKeyDirectory[] =
    FILE_PATH_LITERAL("Astro Sync Key");

const scoped_refptr<base::SequencedTaskRunner>& Sequence() {
  static base::NoDestructor<scoped_refptr<base::SequencedTaskRunner>> sequence(
      base::ThreadPool::CreateSequencedTaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
           base::TaskShutdownBehavior::BLOCK_SHUTDOWN}));
  return *sequence;
}

base::Value Failure(std::string_view message) {
  return base::Value(base::DictValue().Set("error", message));
}

bool IsTag(std::string_view name) {
  return name.size() == kTagLength &&
         std::ranges::all_of(name, [](char c) {
           return kTagAlphabet.find(c) != std::string_view::npos;
         });
}

bool IsAccount(std::string_view name) {
  return !name.empty() && name.size() <= kMaxAccountLength &&
         std::ranges::all_of(name, [](char c) {
           return base::IsAsciiAlphaNumeric(c) || c == '_' || c == '-';
         });
}

std::optional<base::FilePath> AbsolutePath(const base::DictValue& args,
                                           std::string_view key) {
  const std::string* text = args.FindString(key);
  if (!text || text->empty()) {
    return std::nullopt;
  }
  base::FilePath path = base::FilePath::FromUTF8Unsafe(*text);
  if (!path.IsAbsolute() || path.ReferencesParent()) {
    return std::nullopt;
  }
  return path.StripTrailingSeparators();
}

std::optional<std::string> TagArg(const base::DictValue& args,
                                  std::string_view key) {
  const std::string* text = args.FindString(key);
  if (!text || !IsTag(*text)) {
    return std::nullopt;
  }
  return *text;
}

std::optional<base::FilePath> EnvPath(base::Environment& env,
                                      base::cstring_view name) {
  std::optional<std::string> value = env.GetVar(name);
  if (!value || value->empty()) {
    return std::nullopt;
  }
  base::FilePath path = base::FilePath::FromUTF8Unsafe(*value);
  return path.IsAbsolute() ? std::optional(path) : std::nullopt;
}

base::FilePath DefaultFolder() {
  std::unique_ptr<base::Environment> env = base::Environment::Create();
  if (std::optional<base::FilePath> test =
          EnvPath(*env, "ASTRO_SYNC_DEFAULT_FOLDER")) {
    return *test;
  }
  if (std::optional<base::FilePath> data = EnvPath(*env, "ASTRO_DATA_DIR")) {
    return data->Append(kFolderName);
  }
#if BUILDFLAG(IS_WIN)
  if (std::optional<base::FilePath> one_drive = EnvPath(*env, "OneDrive")) {
    return one_drive->Append(kFolderName);
  }
  base::FilePath documents;
  if (base::PathService::Get(chrome::DIR_USER_DOCUMENTS, &documents)) {
    return documents.Append(kFolderName);
  }
#endif
  return base::GetHomeDir().Append(kFolderName);
}

bool HasSyncData(const base::FilePath& folder) {
  base::FileEnumerator entries(
      folder, false,
      base::FileEnumerator::FILES | base::FileEnumerator::DIRECTORIES);
  for (base::FilePath path = entries.Next(); !path.empty();
       path = entries.Next()) {
    if (IsTag(path.BaseName().AsUTF8Unsafe())) {
      return true;
    }
  }
  return false;
}

base::Value FolderInfo(std::optional<base::FilePath> requested) {
  const base::FilePath fallback = DefaultFolder();
  const base::FilePath folder = requested.value_or(fallback);
  const bool exists = base::DirectoryExists(folder);
  return base::Value(
      base::DictValue()
          .Set("path", folder.AsUTF8Unsafe())
          .Set("defaultPath", fallback.AsUTF8Unsafe())
          .Set("exists", exists)
          .Set("writable", exists && base::PathIsWritable(folder))
          .Set("hasSyncData", exists && HasSyncData(folder)));
}

base::Value ChainExists(base::FilePath folder, std::string chain) {
  return base::Value(
      base::DictValue()
          .Set("folder", base::DirectoryExists(folder))
          .Set("chain", base::DirectoryExists(folder.AppendASCII(chain))));
}

base::Value CreateChain(base::FilePath folder, std::string chain) {
  return base::CreateDirectory(folder.AppendASCII(chain))
             ? base::Value(true)
             : Failure("couldn't create the sync folder");
}

base::Value DeleteChain(base::FilePath folder, std::string chain) {
  const base::FilePath directory = folder.AppendASCII(chain);
  if (!base::PathExists(directory)) {
    return base::Value(true);
  }
  return base::DeletePathRecursively(directory)
             ? base::Value(true)
             : Failure("couldn't delete the synced data");
}

std::string FileName(std::string_view id) {
  return base::StrCat({id, kFileSuffix});
}

base::Value List(base::FilePath directory, std::set<std::string> known) {
  std::vector<std::pair<std::string, base::Time>> entries;
  base::FileEnumerator files(directory, false, base::FileEnumerator::FILES);
  for (base::FilePath path = files.Next(); !path.empty(); path = files.Next()) {
    const std::string name = path.BaseName().AsUTF8Unsafe();
    if (!name.ends_with(kFileSuffix)) {
      continue;
    }
    std::string id = name.substr(0, name.size() - kFileSuffix.size());
    if (IsTag(id)) {
      entries.emplace_back(std::move(id),
                           files.GetInfo().GetLastModifiedTime());
    }
  }
  std::ranges::sort(entries);
  base::ListValue present;
  base::ListValue unread;
  for (const auto& [id, modified] : entries) {
    present.Append(id);
    if (known.contains(id)) {
      continue;
    }
    base::DictValue file =
        base::DictValue().Set("id", id).Set(
            "mtime", modified.InMillisecondsFSinceUnixEpochIgnoringNull());
    std::string data;
    if (base::ReadFileToStringWithMaxSize(directory.AppendASCII(FileName(id)),
                                          &data, kMaxSyncFileBytes)) {
      file.Set("data", base::Base64Encode(data));
    }
    unread.Append(std::move(file));
  }
  return base::Value(base::DictValue()
                         .Set("present", std::move(present))
                         .Set("files", std::move(unread)));
}

base::Value Write(base::FilePath directory, std::string id, std::string data) {
  if (!base::CreateDirectory(directory)) {
    return Failure("couldn't create the sync folder");
  }
  return base::ImportantFileWriter::WriteFileAtomically(
             directory.AppendASCII(FileName(id)), data)
             ? base::Value(true)
             : Failure("couldn't write to the sync folder");
}

base::Value Remove(base::FilePath directory, std::vector<std::string> ids) {
  for (const std::string& id : ids) {
    base::DeleteFile(directory.AppendASCII(FileName(id)));
  }
  return base::Value(true);
}

base::Value WriteText(base::FilePath path, std::string text) {
  return base::ImportantFileWriter::WriteFileAtomically(path, text)
             ? base::Value(true)
             : Failure("couldn't save the file");
}

base::Value SaveKey(base::FilePath file,
                    std::string secret,
                    scoped_refptr<os_crypt_async::Encryptor> encryptor) {
  if (!encryptor->IsEncryptionAvailable()) {
    return Failure("encryption isn't available");
  }
  std::optional<std::vector<uint8_t>> sealed =
      encryptor->EncryptString(secret);
  if (!sealed) {
    return Failure("couldn't encrypt the key");
  }
  if (!base::CreateDirectory(file.DirName())) {
    return Failure("couldn't save the key");
  }
  return base::ImportantFileWriter::WriteFileAtomically(
             file, std::string_view(reinterpret_cast<const char*>(
                                        sealed->data()),
                                    sealed->size()))
             ? base::Value(true)
             : Failure("couldn't save the key");
}

base::Value LoadKey(base::FilePath file,
                    scoped_refptr<os_crypt_async::Encryptor> encryptor) {
  std::string sealed;
  if (!base::ReadFileToStringWithMaxSize(file, &sealed, kMaxKeyFileBytes)) {
    return base::Value();
  }
  std::optional<std::string> secret =
      encryptor->DecryptData(base::as_byte_span(sealed));
  return secret ? base::Value(base::Base64Encode(*secret)) : base::Value();
}

base::Value DeleteKey(base::FilePath file) {
  return base::Value(base::DeleteFile(file));
}

base::Value DeviceName() {
  std::string name = net::GetHostName();
  return name.empty() ? base::Value() : base::Value(std::move(name));
}

template <typename Task>
void Run(Task task, Done done) {
  Sequence()->PostTaskAndReplyWithResult(FROM_HERE, std::move(task),
                                         std::move(done));
}

void WithEncryptor(
    base::OnceCallback<base::Value(scoped_refptr<os_crypt_async::Encryptor>)>
        task,
    Done done) {
  g_browser_process->os_crypt_async()->GetInstance(base::BindOnce(
      [](base::OnceCallback<base::Value(
             scoped_refptr<os_crypt_async::Encryptor>)> task,
         Done done, scoped_refptr<os_crypt_async::Encryptor> encryptor) {
        if (!encryptor) {
          return std::move(done).Run(Failure("encryption isn't available"));
        }
        Run(base::BindOnce(std::move(task), std::move(encryptor)),
            std::move(done));
      },
      std::move(task), std::move(done)));
}

void KeyCall(Profile* profile,
             const std::string& method,
             const base::DictValue& args,
             Done done) {
  const std::string* account = args.FindString("account");
  if (!account || !IsAccount(*account)) {
    return std::move(done).Run(Failure("invalid account"));
  }
  const base::FilePath file =
      profile->GetPath().Append(kKeyDirectory).AppendASCII(*account);
  if (method == "keyDelete") {
    return Run(base::BindOnce(&DeleteKey, file), std::move(done));
  }
  if (method == "keyLoad") {
    return WithEncryptor(base::BindOnce(&LoadKey, file), std::move(done));
  }
  const std::string* data = args.FindString("data");
  std::string secret;
  if (!data || !base::Base64Decode(*data, &secret) || secret.empty()) {
    return std::move(done).Run(Failure("invalid key"));
  }
  WithEncryptor(base::BindOnce(&SaveKey, file, std::move(secret)),
                std::move(done));
}

std::optional<std::vector<std::string>> TagList(const base::DictValue& args,
                                                std::string_view key) {
  const base::ListValue* list = args.FindList(key);
  if (!list) {
    return std::nullopt;
  }
  std::vector<std::string> tags;
  for (const base::Value& item : *list) {
    if (!item.is_string() || !IsTag(item.GetString())) {
      return std::nullopt;
    }
    tags.push_back(item.GetString());
  }
  return tags;
}

void FolderCall(const std::string& method,
                const base::DictValue& args,
                Done done) {
  std::optional<base::FilePath> folder = AbsolutePath(args, "folder");
  std::optional<std::string> chain = TagArg(args, "chain");
  if (!folder || !chain) {
    return std::move(done).Run(Failure("invalid sync folder"));
  }
  if (method == "chainExists") {
    return Run(base::BindOnce(&ChainExists, *folder, *chain), std::move(done));
  }
  if (method == "createChain") {
    return Run(base::BindOnce(&CreateChain, *folder, *chain), std::move(done));
  }
  if (method == "deleteChain") {
    return Run(base::BindOnce(&DeleteChain, *folder, *chain), std::move(done));
  }
  std::optional<std::string> scope = TagArg(args, "scope");
  if (!scope) {
    return std::move(done).Run(Failure("invalid scope"));
  }
  const base::FilePath directory =
      folder->AppendASCII(*chain).AppendASCII(*scope);
  if (method == "list") {
    std::optional<std::vector<std::string>> known = TagList(args, "known");
    if (!known) {
      return std::move(done).Run(Failure("invalid ids"));
    }
    return Run(base::BindOnce(&List, directory,
                              std::set<std::string>(known->begin(),
                                                    known->end())),
               std::move(done));
  }
  if (method == "remove") {
    std::optional<std::vector<std::string>> ids = TagList(args, "ids");
    if (!ids) {
      return std::move(done).Run(Failure("invalid ids"));
    }
    return Run(base::BindOnce(&Remove, directory, std::move(*ids)),
               std::move(done));
  }
  if (method == "write") {
    std::optional<std::string> id = TagArg(args, "id");
    const std::string* data = args.FindString("data");
    std::string bytes;
    if (!id || !data || !base::Base64Decode(*data, &bytes)) {
      return std::move(done).Run(Failure("invalid file"));
    }
    return Run(base::BindOnce(&Write, directory, *id, std::move(bytes)),
               std::move(done));
  }
  std::move(done).Run(Failure("unknown method"));
}

}

void SyncFilesCall(Profile* profile,
                   const std::string& method,
                   const base::DictValue& args,
                   Done done) {
  if (method == "folderInfo") {
    std::optional<base::FilePath> path;
    if (args.FindString("path")) {
      path = AbsolutePath(args, "path");
      if (!path) {
        return std::move(done).Run(Failure("invalid path"));
      }
    }
    return Run(base::BindOnce(&FolderInfo, path), std::move(done));
  }
  if (method == "deviceName") {
    return Run(base::BindOnce(&DeviceName), std::move(done));
  }
  if (method == "writeTextFile") {
    std::optional<base::FilePath> path = AbsolutePath(args, "path");
    const std::string* text = args.FindString("text");
    if (!path || !text) {
      return std::move(done).Run(Failure("invalid path"));
    }
    return Run(base::BindOnce(&WriteText, *path, *text), std::move(done));
  }
  if (method == "keySave" || method == "keyLoad" || method == "keyDelete") {
    return KeyCall(profile, method, args, std::move(done));
  }
  if (method == "chainExists" || method == "createChain" ||
      method == "deleteChain" || method == "list" || method == "write" ||
      method == "remove") {
    return FolderCall(method, args, std::move(done));
  }
  std::move(done).Run(Failure("unknown method"));
}

}
