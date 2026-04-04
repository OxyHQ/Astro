// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

//! CXX FFI bridge for adblock-rust, used by Astro's built-in ad blocker.

mod convert;
mod engine;
mod filter_set;
mod result;

use engine::*;
use filter_set::*;

#[allow(unsafe_op_in_unsafe_fn)]
#[cxx::bridge(namespace = "oxy::adblock")]
mod ffi {
    extern "Rust" {
        type FilterSet;
        fn new_filter_set() -> Box<FilterSet>;
        fn add_filter_list(&mut self, rules: &CxxVector<u8>) -> bool;
    }

    extern "Rust" {
        type Engine;

        /// Creates a new engine with no rules.
        fn new_engine() -> Box<Engine>;

        /// Creates a new engine from a populated FilterSet.
        fn engine_from_filter_set(filter_set: Box<FilterSet>) -> Box<Engine>;

        /// Configures the adblock domain resolver to call the C++
        /// `resolve_domain_position` function.
        fn set_domain_resolver() -> bool;

        /// Checks if a request should be blocked.
        fn engine_matches(
            engine: &Engine,
            url: &CxxString,
            hostname: &CxxString,
            source_hostname: &CxxString,
            request_type: &CxxString,
            third_party_request: bool,
        ) -> BlockerResult;

        /// Returns CSP directives to inject for a given request.
        fn engine_get_csp_directives(
            engine: &Engine,
            url: &CxxString,
            hostname: &CxxString,
            source_hostname: &CxxString,
            request_type: &CxxString,
            third_party_request: bool,
        ) -> String;

        /// Serializes the engine to a binary format for caching.
        fn engine_serialize(engine: &Engine) -> Vec<u8>;

        /// Deserializes a cached engine from binary data.
        fn engine_deserialize(engine: &mut Engine, data: &CxxVector<u8>) -> bool;

        /// Returns JSON-serialized cosmetic filter resources for a URL.
        fn engine_url_cosmetic_resources(engine: &Engine, url: &CxxString) -> String;

        /// Returns CSS selectors to hide elements based on classes/ids.
        fn engine_hidden_class_id_selectors(
            engine: &Engine,
            classes: &CxxVector<CxxString>,
            ids: &CxxVector<CxxString>,
            exceptions: &CxxVector<CxxString>,
        ) -> Vec<String>;
    }

    unsafe extern "C++" {
        include!("chrome/browser/oxy/adblock/adblock_domain_resolver.h");

        /// Wrapper for net::registry_controlled_domains::GetDomainAndRegistry.
        fn resolve_domain_position(host: &CxxString) -> DomainPosition;
    }

    struct DomainPosition {
        start: u32,
        end: u32,
    }

    #[derive(Default)]
    struct BlockerResult {
        matched: bool,
        important: bool,
        has_exception: bool,
        redirect: String,
        rewritten_url: String,
    }
}
