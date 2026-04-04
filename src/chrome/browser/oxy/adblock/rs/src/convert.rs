// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

use crate::ffi::BlockerResult;
use adblock::blocker::BlockerResult as InnerBlockerResult;

impl From<InnerBlockerResult> for BlockerResult {
    fn from(result: InnerBlockerResult) -> Self {
        Self {
            matched: result.matched,
            important: result.important,
            has_exception: result.exception.is_some(),
            redirect: result.redirect.unwrap_or_default(),
            rewritten_url: result.rewritten_url.unwrap_or_default(),
        }
    }
}
