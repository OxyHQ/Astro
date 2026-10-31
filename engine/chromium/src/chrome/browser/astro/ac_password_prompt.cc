// Copyright 2026 Oxy. Apache-2.0.

#include <string>

#include "base/memory/weak_ptr.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/ui/passwords/passwords_model_delegate.h"
#include "components/password_manager/core/browser/password_form.h"
#include "components/password_manager/core/browser/password_string.h"
#include "components/password_manager/core/common/password_manager_ui.h"
#include "content/public/browser/web_contents.h"
#include "url/origin.h"

extern bool (*g_astro_password_bubble)(content::WebContents* web_contents);

namespace astro {
namespace {

using password_manager::ui::State;

base::WeakPtr<PasswordsModelDelegate> ModelFor(content::WebContents* contents) {
  return contents ? PasswordsModelDelegateFromWebContents(contents) : nullptr;
}

std::optional<base::DictValue> PasswordPrompt(content::WebContents* contents) {
  base::WeakPtr<PasswordsModelDelegate> model = ModelFor(contents);
  if (!model) {
    return std::nullopt;
  }
  const State state = model->GetState();
  const char* name = nullptr;
  switch (state) {
    case State::PENDING_PASSWORD_STATE:
      name = "save";
      break;
    case State::PENDING_PASSWORD_UPDATE_STATE:
      name = "update";
      break;
    case State::SAVE_CONFIRMATION_STATE:
    case State::UPDATE_CONFIRMATION_STATE:
      name = "saved";
      break;
    default:
      return std::nullopt;
  }
  std::string username;
  int length = 0;
  std::string federation;
  if (state != State::UPDATE_CONFIRMATION_STATE) {
    const password_manager::PasswordForm& form = model->GetPendingPassword();
    username = base::UTF16ToUTF8(form.username_value);
    length = static_cast<int>(form.password_value.size());
    if (form.federation_origin.IsValid()) {
      federation = form.federation_origin.Serialize();
    }
  }
  base::ListValue usernames;
  for (const auto& form : model->GetCurrentForms()) {
    if (form && !form->username_value.empty()) {
      usernames.Append(base::UTF16ToUTF8(form->username_value));
    }
  }
  return base::DictValue()
      .Set("state", name)
      .Set("origin", model->GetOrigin().Serialize())
      .Set("username", username)
      .Set("passwordLength", length)
      .Set("federation", federation)
      .Set("usernames", std::move(usernames));
}

bool OfferPasswordSave(content::WebContents* contents) {
  if (!HostShowsTab(contents)) {
    return false;
  }
  std::optional<base::DictValue> prompt = PasswordPrompt(contents);
  if (!prompt) {
    return false;
  }
  base::WeakPtr<PasswordsModelDelegate> model = ModelFor(contents);
  model->OnBubbleShown();
  HostTabEvent(contents, "passwordPrompt", std::move(*prompt));
  if (model && (model->GetState() == State::SAVE_CONFIRMATION_STATE ||
                model->GetState() == State::UPDATE_CONFIRMATION_STATE)) {
    model->OnBubbleHidden();
  }
  return true;
}

}

void InstallPasswordPrompts() {
  g_astro_password_bubble = &OfferPasswordSave;
}

void ResolvePasswordPrompt(content::WebContents* contents,
                           const std::string& action,
                           const std::string& username,
                           const std::string& password) {
  base::WeakPtr<PasswordsModelDelegate> model = ModelFor(contents);
  if (!model) {
    return;
  }
  const State state = model->GetState();
  const bool offers_save = state == State::PENDING_PASSWORD_STATE ||
                           state == State::PENDING_PASSWORD_UPDATE_STATE;
  if (((action == "save" || action == "update") && !offers_save) ||
      (action == "never" && state != State::PENDING_PASSWORD_STATE) ||
      (action == "nope" && state != State::PENDING_PASSWORD_UPDATE_STATE)) {
    return;
  }
  if (action == "save" || action == "update") {
    const password_manager::PasswordForm& pending = model->GetPendingPassword();
    model->SavePassword(
        username.empty() ? pending.username_value : base::UTF8ToUTF16(username),
        password.empty()
            ? pending.password_value
            : password_manager::PasswordString(base::UTF8ToUTF16(password)));
  } else if (action == "never") {
    model->NeverSavePassword();
  } else if (action == "nope") {
    model->OnNopeUpdateClicked();
  } else if (action != "dismiss") {
    return;
  }
  if (model) {
    model->OnBubbleHidden();
  }
}

}
