// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_OXY_AUTH_TOKEN_STORE_H_
#define CHROME_BROWSER_OXY_OXY_AUTH_TOKEN_STORE_H_

#include <string>

namespace oxy {

// Securely stores and retrieves Oxy authentication tokens
// using Chromium's OSCrypt (OS-level keychain/credential store).
class OxyAuthTokenStore {
 public:
  OxyAuthTokenStore() = delete;

  // Store tokens (encrypts before persisting)
  static bool StoreAccessToken(const std::string& token);
  static bool StoreRefreshToken(const std::string& token);

  // Load tokens (decrypts from storage)
  static std::string LoadAccessToken();
  static std::string LoadRefreshToken();

  // Clear all stored tokens
  static void ClearTokens();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_AUTH_TOKEN_STORE_H_
