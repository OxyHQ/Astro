// Copyright 2026 Oxy. Apache-2.0.

#include <memory>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/sequenced_task_runner.h"
#include "base/time/time.h"
#include "base/types/expected.h"
#include "base/values.h"
#include "chrome/browser/astro/ac_engine.h"
#include "chrome/browser/astro/ac_passwords.h"
#include "chrome/browser/astro/ac_sensitive_args.h"
#include "chrome/browser/password_manager/factories/account_password_store_factory.h"
#include "chrome/browser/password_manager/factories/profile_password_store_factory.h"
#include "components/keyed_service/core/service_access_type.h"
#include "components/password_manager/core/browser/password_store/password_store_backend_error.h"
#include "components/password_manager/core/browser/password_store/password_store_consumer.h"
#include "components/password_manager/core/browser/password_store/password_store_interface.h"
#include "components/password_manager/core/browser/password_store/stored_credential.h"

namespace astro {
namespace {

using password_manager::PasswordStoreBackendError;
using password_manager::PasswordStoreInterface;
using password_manager::StoredCredential;
using Credentials = std::vector<StoredCredential>;

double CreatedMilliseconds(base::Time created) {
  return created.ToDeltaSinceWindowsEpoch().InMicroseconds() > 0
             ? created.InMillisecondsFSinceUnixEpoch()
             : 0;
}

std::string UrlOf(const StoredCredential& credential) {
  const std::string& url = credential.url.possibly_invalid_spec();
  return url.empty() ? credential.signon_realm : url;
}

void Forget(Credentials& credentials) {
  for (StoredCredential& credential : credentials) {
    credential.password_value.clear();
  }
  credentials.clear();
}

base::ListValue SyncedLogins(Credentials& profile_logins,
                             Credentials& account_logins) {
  base::ListValue logins;
  std::set<std::string> seen;
  for (Credentials* store : {&profile_logins, &account_logins}) {
    for (const StoredCredential& credential : *store) {
      if (credential.blocked_by_user || credential.password_value.empty() ||
          credential.signon_realm.empty()) {
        continue;
      }
      std::string username = base::UTF16ToUTF8(credential.username_value);
      if (!seen.insert(credential.signon_realm + '\0' + username).second) {
        continue;
      }
      std::u16string password16 = credential.password_value.value();
      std::string password = base::UTF16ToUTF8(password16);
      Cleanse(password16);
      logins.Append(base::DictValue()
                        .Set("origin", credential.signon_realm)
                        .Set("url", UrlOf(credential))
                        .Set("username", std::move(username))
                        .Set("password", password)
                        .Set("created",
                             CreatedMilliseconds(credential.date_created)));
      Cleanse(password);
    }
  }
  Forget(profile_logins);
  Forget(account_logins);
  return logins;
}

class SyncLoginsReader : public password_manager::PasswordStoreConsumer {
 public:
  using Finished = base::OnceCallback<void(SyncLoginsReader*)>;

  SyncLoginsReader(Reply reply, Finished finished)
      : reply_(std::move(reply)), finished_(std::move(finished)) {}
  SyncLoginsReader(const SyncLoginsReader&) = delete;
  SyncLoginsReader& operator=(const SyncLoginsReader&) = delete;
  ~SyncLoginsReader() override {
    Forget(profile_logins_);
    Forget(account_logins_);
  }

  void Start(scoped_refptr<PasswordStoreInterface> profile_store,
             scoped_refptr<PasswordStoreInterface> account_store) {
    profile_store_ = std::move(profile_store);
    account_store_ = std::move(account_store);
    pending_ = account_store_ ? 2 : 1;
    profile_store_->GetAllLogins(weak_factory_.GetWeakPtr());
    if (account_store_) {
      account_store_->GetAllLogins(weak_factory_.GetWeakPtr());
    }
  }

  void OnGetPasswordStoreResultsOrErrorFrom(
      PasswordStoreInterface* store,
      base::expected<Credentials, PasswordStoreBackendError> results) override {
    if (!results.has_value()) {
      failed_ = true;
    } else if (store == profile_store_.get()) {
      profile_logins_ = std::move(results.value());
    } else {
      account_logins_ = std::move(results.value());
    }
    if (--pending_ > 0) {
      return;
    }
    if (failed_) {
      Forget(profile_logins_);
      Forget(account_logins_);
      reply_.Error("saved passwords couldn't be read");
    } else {
      reply_.Send(base::DictValue().Set(
          "logins", SyncedLogins(profile_logins_, account_logins_)));
    }
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(std::move(finished_), this));
  }

 private:
  Reply reply_;
  Finished finished_;
  scoped_refptr<PasswordStoreInterface> profile_store_;
  scoped_refptr<PasswordStoreInterface> account_store_;
  Credentials profile_logins_;
  Credentials account_logins_;
  int pending_ = 0;
  bool failed_ = false;
  base::WeakPtrFactory<SyncLoginsReader> weak_factory_{this};
};

class SyncLoginsState : public ProfileState {
 public:
  explicit SyncLoginsState(Profile* profile) : ProfileState(profile) {}

  void Read(Reply reply) {
    scoped_refptr<PasswordStoreInterface> profile_store =
        ProfilePasswordStoreFactory::GetForProfile(
            profile(), ServiceAccessType::EXPLICIT_ACCESS);
    if (!profile_store) {
      return reply.Error("no password store");
    }
    scoped_refptr<PasswordStoreInterface> account_store =
        AccountPasswordStoreFactory::GetForProfile(
            profile(), ServiceAccessType::EXPLICIT_ACCESS);
    auto reader = std::make_unique<SyncLoginsReader>(
        std::move(reply), base::BindOnce(&SyncLoginsState::Finished,
                                         weak_factory_.GetWeakPtr()));
    SyncLoginsReader* started = reader.get();
    readers_.push_back(std::move(reader));
    started->Start(std::move(profile_store), std::move(account_store));
  }

 private:
  void Release() override {
    weak_factory_.InvalidateWeakPtrs();
    readers_.clear();
  }

  void Finished(SyncLoginsReader* reader) {
    std::erase_if(readers_, [reader](const auto& owned) {
      return owned.get() == reader;
    });
  }

  std::vector<std::unique_ptr<SyncLoginsReader>> readers_;
  base::WeakPtrFactory<SyncLoginsState> weak_factory_{this};
};

}
}

AC_ENGINE_CALL(ac_passwords_sync_read) {
  astro::Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  astro::StateFor<astro::SyncLoginsState>(call.profile())
      .Read(call.TakeReply());
}
