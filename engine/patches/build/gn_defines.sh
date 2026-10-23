# GN args for the Astro engine build, all of them (02-gn-args.sh writes args.gn from this list).
_gn_args=(
  is_official_build=true
  chrome_pgo_phase=2
  is_debug=false
  dcheck_always_on=false
  symbol_level=0 blink_symbol_level=0 v8_symbol_level=0
  is_component_build=false
  forbid_non_component_debug_builds=false
  "target_cpu=\"$AC_TARGET_CPU\""
  # Codecs: H.264 / AAC (VideoToolbox + ffmpeg "Chrome" branding), MPEG2-TS MSE, Widevine.
  proprietary_codecs=true
  'ffmpeg_branding="Chrome"'
  enable_mse_mpeg2ts_stream_parser=true
  enable_widevine=true
  # Newer SDK than Chromium expects: never fail on warnings.
  treat_warnings_as_errors=false
  fatal_linker_warnings=false
  clang_use_chrome_plugins=false
  enable_precompiled_headers=false
  safe_browsing_mode=0
  enable_reporting=false
  disable_fieldtrial_testing_config=true
  enable_hangout_services_extension=false
  enable_remoting=false
  exclude_unwind_tables=true
  'google_api_key=""'
  'google_default_client_id=""'
  'google_default_client_secret=""'
  use_official_google_api_keys=false
  use_unofficial_version_number=false
  v8_drumbrake_bounds_checks=true
  enable_iterator_debugging=false
  enable_updater=false
  # Formerly merged in by CEF's tools/gn_args.py; the values the shipped builds had.
  enable_background_mode=false
  enable_downgrade_processing=false
  enable_resource_allowlist_generation=false
  optimize_webui=true
  # Astro's bundle and team id (webauthn/payments keychain access groups);
  # product names stay "Chromium" (chromium-branding.patch).
  'branding_file_path="//chrome/app/theme/astro/BRANDING"'
)
if [[ $AC_PLATFORM == macos ]]; then
  _gn_args+=(
    enable_cdm_host_verification=true
    enable_cdm_storage_id=true
    # Widevine's storage id: changing it loses every user's licences.
    'alternate_cdm_storage_id_key="968b476909da4373b08903c28e859454"'
    enable_rlz=true
  )
else
  # Chromium allows CDM host verification, storage ids and RLZ only on Windows and macOS. The rest is Helium's Linux set.
  _gn_args+=(
    use_sysroot=true
    use_vaapi=true
    rtc_use_pipewire=true
    use_kerberos=false
  )
fi
# AC_ENGINE_PROFILE=dev: no official build, PGO or LTO, and line tables for backtraces; much faster to build and link.
if [[ ${AC_ENGINE_PROFILE:-release} == dev ]]; then
  _dev_args=()
  for _arg in "${_gn_args[@]}"; do
    case $_arg in
      is_official_build=*) _dev_args+=(is_official_build=false) ;;
      chrome_pgo_phase=*) _dev_args+=(chrome_pgo_phase=0) ;;
      symbol_level=*) _dev_args+=(symbol_level=1) ;;
      *) _dev_args+=("$_arg") ;;
    esac
  done
  _gn_args=("${_dev_args[@]}")
  unset _dev_args _arg
fi
export GN_DEFINES="${_gn_args[*]}"
