// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_trash.h"

#include <utility>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/single_thread_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/threading/scoped_blocking_call.h"
#include "build/build_config.h"

#if BUILDFLAG(IS_WIN)
#include <windows.h>

#include <shellapi.h>
#include <shobjidl.h>
#include <wrl/client.h>
#include <wrl/implements.h>
#endif

#if BUILDFLAG(IS_LINUX)
#include <gio/gio.h>
#endif

namespace astro {
namespace {

#if BUILDFLAG(IS_WIN)
class RecycleOnlySink
    : public Microsoft::WRL::RuntimeClass<
          Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,
          IFileOperationProgressSink> {
 public:
  RecycleOnlySink() = default;
  RecycleOnlySink(const RecycleOnlySink&) = delete;
  RecycleOnlySink& operator=(const RecycleOnlySink&) = delete;

  HRESULT result() const { return result_; }

  IFACEMETHODIMP PreDeleteItem(DWORD flags, IShellItem*) override {
    return flags & TSF_DELETE_RECYCLE_IF_POSSIBLE ? S_OK : E_ABORT;
  }
  IFACEMETHODIMP PostDeleteItem(DWORD,
                                IShellItem*,
                                HRESULT hr,
                                IShellItem*) override {
    Keep(hr);
    return S_OK;
  }
  IFACEMETHODIMP FinishOperations(HRESULT hr) override {
    Keep(hr);
    return S_OK;
  }
  IFACEMETHODIMP StartOperations() override { return S_OK; }
  IFACEMETHODIMP PreRenameItem(DWORD, IShellItem*, PCWSTR) override {
    return S_OK;
  }
  IFACEMETHODIMP PostRenameItem(DWORD,
                                IShellItem*,
                                PCWSTR,
                                HRESULT,
                                IShellItem*) override {
    return S_OK;
  }
  IFACEMETHODIMP PreMoveItem(DWORD, IShellItem*, IShellItem*, PCWSTR) override {
    return S_OK;
  }
  IFACEMETHODIMP PostMoveItem(DWORD,
                              IShellItem*,
                              IShellItem*,
                              PCWSTR,
                              HRESULT,
                              IShellItem*) override {
    return S_OK;
  }
  IFACEMETHODIMP PreCopyItem(DWORD, IShellItem*, IShellItem*, PCWSTR) override {
    return S_OK;
  }
  IFACEMETHODIMP PostCopyItem(DWORD,
                              IShellItem*,
                              IShellItem*,
                              PCWSTR,
                              HRESULT,
                              IShellItem*) override {
    return S_OK;
  }
  IFACEMETHODIMP PreNewItem(DWORD, IShellItem*, PCWSTR) override {
    return S_OK;
  }
  IFACEMETHODIMP PostNewItem(DWORD,
                             IShellItem*,
                             PCWSTR,
                             PCWSTR,
                             DWORD,
                             HRESULT,
                             IShellItem*) override {
    return S_OK;
  }
  IFACEMETHODIMP UpdateProgress(UINT, UINT) override { return S_OK; }
  IFACEMETHODIMP ResetTimer() override { return S_OK; }
  IFACEMETHODIMP PauseTimer() override { return S_OK; }
  IFACEMETHODIMP ResumeTimer() override { return S_OK; }

 protected:
  ~RecycleOnlySink() override = default;

 private:
  void Keep(HRESULT hr) {
    if (SUCCEEDED(result_)) {
      result_ = hr;
    }
  }

  HRESULT result_ = S_OK;
};
#endif

bool TrashNow(const base::FilePath& path) {
  base::ScopedBlockingCall blocking(FROM_HERE, base::BlockingType::MAY_BLOCK);
  if (!base::PathExists(path)) {
    return false;
  }
#if BUILDFLAG(IS_WIN)
  Microsoft::WRL::ComPtr<IShellItem> item;
  Microsoft::WRL::ComPtr<IFileOperation> operation;
  if (FAILED(SHCreateItemFromParsingName(path.value().c_str(), nullptr,
                                         IID_PPV_ARGS(&item))) ||
      FAILED(CoCreateInstance(CLSID_FileOperation, nullptr,
                              CLSCTX_INPROC_SERVER,
                              IID_PPV_ARGS(&operation))) ||
      FAILED(operation->SetOperationFlags(FOF_ALLOWUNDO | FOF_NO_UI |
                                          FOFX_RECYCLEONDELETE |
                                          FOFX_EARLYFAILURE))) {
    return false;
  }
  Microsoft::WRL::ComPtr<RecycleOnlySink> sink =
      Microsoft::WRL::Make<RecycleOnlySink>();
  if (FAILED(operation->DeleteItem(item.Get(), sink.Get())) ||
      FAILED(operation->PerformOperations())) {
    return false;
  }
  BOOL aborted = TRUE;
  return SUCCEEDED(operation->GetAnyOperationsAborted(&aborted)) && !aborted &&
         SUCCEEDED(sink->result()) && !base::PathExists(path);
#elif BUILDFLAG(IS_LINUX)
  GFile* file = g_file_new_for_path(path.value().c_str());
  GError* error = nullptr;
  const bool trashed = g_file_trash(file, nullptr, &error);
  if (error) {
    g_error_free(error);
  }
  g_object_unref(file);
  return trashed;
#else
  return false;
#endif
}

scoped_refptr<base::TaskRunner> TrashTaskRunner() {
  constexpr base::TaskTraits kTraits = {base::MayBlock(),
                                        base::TaskPriority::USER_VISIBLE};
#if BUILDFLAG(IS_WIN)
  return base::ThreadPool::CreateCOMSTATaskRunner(kTraits);
#else
  return base::ThreadPool::CreateSequencedTaskRunner(kTraits);
#endif
}

}

void MoveToTrash(const base::FilePath& path,
                 base::OnceCallback<void(bool)> done) {
  if (!path.IsAbsolute() || path.ReferencesParent()) {
    return std::move(done).Run(false);
  }
  TrashTaskRunner()->PostTaskAndReplyWithResult(
      FROM_HERE, base::BindOnce(&TrashNow, path), std::move(done));
}

}
