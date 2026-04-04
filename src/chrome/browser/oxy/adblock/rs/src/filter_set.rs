// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

use adblock::lists::FilterSet as InnerFilterSet;
use cxx::CxxVector;

pub struct FilterSet(InnerFilterSet);

impl Default for Box<FilterSet> {
    fn default() -> Self {
        new_filter_set()
    }
}

pub fn new_filter_set() -> Box<FilterSet> {
    Box::new(FilterSet(InnerFilterSet::new(false)))
}

impl FilterSet {
    pub fn add_filter_list(&mut self, rules: &CxxVector<u8>) -> bool {
        match std::str::from_utf8(rules.as_slice()) {
            Ok(rules_str) => {
                self.0
                    .add_filter_list(rules_str, Default::default());
                true
            }
            Err(_) => false,
        }
    }

    pub(crate) fn into_inner(self) -> InnerFilterSet {
        self.0
    }
}
