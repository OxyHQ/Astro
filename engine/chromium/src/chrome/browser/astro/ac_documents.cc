// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_documents.h"

#include <algorithm>
#include <utility>

#include "base/files/file_enumerator.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/important_file_writer.h"
#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "base/no_destructor.h"
#include "base/strings/string_util.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"

namespace astro {
namespace {

constexpr base::FilePath::CharType kDocumentsDir[] =
    FILE_PATH_LITERAL("Astro Documents");
constexpr size_t kMaxNameLength = 128;

const scoped_refptr<base::SequencedTaskRunner>& Sequence() {
  static base::NoDestructor<scoped_refptr<base::SequencedTaskRunner>> sequence(
      base::ThreadPool::CreateSequencedTaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
           base::TaskShutdownBehavior::BLOCK_SHUTDOWN}));
  return *sequence;
}

base::FilePath DocumentsDir(const base::FilePath& profile_dir) {
  return profile_dir.Append(kDocumentsDir);
}

base::DictValue ReadAll(const base::FilePath& dir) {
  base::DictValue documents;
  base::FileEnumerator files(dir, false, base::FileEnumerator::FILES);
  for (base::FilePath path = files.Next(); !path.empty(); path = files.Next()) {
    const std::string name = path.BaseName().AsUTF8Unsafe();
    std::string contents;
    if (IsDocumentName(name) && base::ReadFileToString(path, &contents) &&
        base::IsStringUTF8(contents)) {
      documents.Set(name, std::move(contents));
    }
  }
  return documents;
}

void Write(const base::FilePath& dir,
           const std::string& name,
           const std::string& contents) {
  if (base::CreateDirectory(dir)) {
    base::ImportantFileWriter::WriteFileAtomically(dir.AppendASCII(name),
                                                   contents);
  }
}

void Remove(const base::FilePath& dir, const std::string& name) {
  base::DeleteFile(dir.AppendASCII(name));
}

}

bool IsDocumentName(std::string_view name) {
  return !name.empty() && name.size() <= kMaxNameLength &&
         name.front() != '.' && std::ranges::all_of(name, [](char c) {
           return base::IsAsciiAlphaNumeric(c) || c == '.' || c == '-' ||
                  c == '_';
         });
}

void ReadDocuments(const base::FilePath& profile_dir,
                   base::OnceCallback<void(base::DictValue)> done) {
  Sequence()->PostTaskAndReplyWithResult(
      FROM_HERE, base::BindOnce(&ReadAll, DocumentsDir(profile_dir)),
      std::move(done));
}

void WriteDocument(const base::FilePath& profile_dir,
                   std::string name,
                   std::string contents) {
  if (!IsDocumentName(name)) {
    return;
  }
  Sequence()->PostTask(FROM_HERE,
                       base::BindOnce(&Write, DocumentsDir(profile_dir),
                                      std::move(name), std::move(contents)));
}

void RemoveDocument(const base::FilePath& profile_dir, std::string name) {
  if (!IsDocumentName(name)) {
    return;
  }
  Sequence()->PostTask(FROM_HERE, base::BindOnce(&Remove,
                                                 DocumentsDir(profile_dir),
                                                 std::move(name)));
}

}
