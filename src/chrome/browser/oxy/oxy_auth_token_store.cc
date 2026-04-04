// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/oxy_auth_token_store.h"

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/logging.h"
#include "base/path_service.h"
#include "chrome/common/chrome_paths.h"
#include "components/os_crypt/sync/os_crypt.h"

namespace oxy {

namespace {

constexpr char kAccessTokenFile[] = "OxyAccessToken";
constexpr char kRefreshTokenFile[] = "OxyRefreshToken";

base::FilePath GetTokenDir() {
  base::FilePath user_data_dir;
  base::PathService::Get(chrome::DIR_USER_DATA, &user_data_dir);
  return user_data_dir.AppendASCII("OxyAuth");
}

bool StoreEncrypted(const std::string& filename,
                    const std::string& plaintext) {
  if (plaintext.empty()) {
    return false;
  }

  std::string ciphertext;
  if (!OSCrypt::EncryptString(plaintext, &ciphertext)) {
    LOG(ERROR) << "Oxy: Failed to encrypt token";
    return false;
  }

  base::FilePath dir = GetTokenDir();
  if (!base::CreateDirectory(dir)) {
    LOG(ERROR) << "Oxy: Failed to create token directory";
    return false;
  }

  base::FilePath path = dir.AppendASCII(filename);
  if (!base::WriteFile(path, ciphertext)) {
    LOG(ERROR) << "Oxy: Failed to write token file";
    return false;
  }

  return true;
}

std::string LoadEncrypted(const std::string& filename) {
  base::FilePath path = GetTokenDir().AppendASCII(filename);

  std::string ciphertext;
  if (!base::ReadFileToString(path, &ciphertext)) {
    return "";
  }

  std::string plaintext;
  if (!OSCrypt::DecryptString(ciphertext, &plaintext)) {
    LOG(ERROR) << "Oxy: Failed to decrypt token";
    return "";
  }

  return plaintext;
}

}  // namespace

// static
bool OxyAuthTokenStore::StoreAccessToken(const std::string& token) {
  return StoreEncrypted(kAccessTokenFile, token);
}

// static
bool OxyAuthTokenStore::StoreRefreshToken(const std::string& token) {
  return StoreEncrypted(kRefreshTokenFile, token);
}

// static
std::string OxyAuthTokenStore::LoadAccessToken() {
  return LoadEncrypted(kAccessTokenFile);
}

// static
std::string OxyAuthTokenStore::LoadRefreshToken() {
  return LoadEncrypted(kRefreshTokenFile);
}

// static
void OxyAuthTokenStore::ClearTokens() {
  base::FilePath dir = GetTokenDir();
  base::DeleteFile(dir.AppendASCII(kAccessTokenFile));
  base::DeleteFile(dir.AppendASCII(kRefreshTokenFile));
}

}  // namespace oxy
