// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

use std::collections::HashSet;

use adblock::url_parser::ResolvesDomain;
use adblock::Engine as InnerEngine;
use cxx::{let_cxx_string, CxxString, CxxVector};

use crate::ffi::{resolve_domain_position, BlockerResult};
use crate::filter_set::FilterSet;

pub struct Engine {
    inner: InnerEngine,
}

impl Default for Box<Engine> {
    fn default() -> Self {
        new_engine()
    }
}

pub fn new_engine() -> Box<Engine> {
    Box::new(Engine {
        inner: InnerEngine::default(),
    })
}

pub fn engine_from_filter_set(filter_set: Box<FilterSet>) -> Box<Engine> {
    let engine = InnerEngine::from_filter_set(filter_set.into_inner(), true);
    Box::new(Engine { inner: engine })
}

struct DomainResolver;

impl ResolvesDomain for DomainResolver {
    fn get_host_domain(&self, host: &str) -> (usize, usize) {
        let_cxx_string!(host_cxx = host);
        let pos = resolve_domain_position(&host_cxx);
        (pos.start as usize, pos.end as usize)
    }
}

pub fn set_domain_resolver() -> bool {
    adblock::url_parser::set_domain_resolver(Box::new(DomainResolver)).is_ok()
}

pub fn engine_matches(
    engine: &Engine,
    url: &CxxString,
    hostname: &CxxString,
    source_hostname: &CxxString,
    request_type: &CxxString,
    third_party_request: bool,
) -> BlockerResult {
    let result = engine.inner.check_network_request_subset(
        &adblock::request::Request::preparsed(
            url.to_str().unwrap_or_default(),
            hostname.to_str().unwrap_or_default(),
            source_hostname.to_str().unwrap_or_default(),
            request_type.to_str().unwrap_or_default(),
            third_party_request,
        ),
        false, // previously_matched_rule
        false, // force_check_exceptions
    );
    result.into()
}

pub fn engine_get_csp_directives(
    engine: &Engine,
    url: &CxxString,
    hostname: &CxxString,
    source_hostname: &CxxString,
    request_type: &CxxString,
    third_party_request: bool,
) -> String {
    engine
        .inner
        .get_csp_directives(&adblock::request::Request::preparsed(
            url.to_str().unwrap_or_default(),
            hostname.to_str().unwrap_or_default(),
            source_hostname.to_str().unwrap_or_default(),
            request_type.to_str().unwrap_or_default(),
            third_party_request,
        ))
        .unwrap_or_default()
}

pub fn engine_serialize(engine: &Engine) -> Vec<u8> {
    engine.inner.serialize()
}

pub fn engine_deserialize(engine: &mut Engine, data: &CxxVector<u8>) -> bool {
    engine.inner.deserialize(data.as_slice()).is_ok()
}

pub fn engine_url_cosmetic_resources(engine: &Engine, url: &CxxString) -> String {
    let resources = engine
        .inner
        .url_cosmetic_resources(url.to_str().unwrap_or_default());
    serde_json::to_string(&resources).unwrap_or_default()
}

pub fn engine_hidden_class_id_selectors(
    engine: &Engine,
    classes: &CxxVector<CxxString>,
    ids: &CxxVector<CxxString>,
    exceptions: &CxxVector<CxxString>,
) -> Vec<String> {
    let classes: Vec<String> = classes
        .iter()
        .filter_map(|s| s.to_str().ok().map(String::from))
        .collect();
    let ids: Vec<String> = ids
        .iter()
        .filter_map(|s| s.to_str().ok().map(String::from))
        .collect();
    let exceptions: HashSet<String> = exceptions
        .iter()
        .filter_map(|s| s.to_str().ok().map(String::from))
        .collect();
    engine
        .inner
        .hidden_class_id_selectors(&classes, &ids, &exceptions)
}
