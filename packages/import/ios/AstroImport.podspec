Pod::Spec.new do |s|
  s.name           = 'AstroImport'
  s.version        = '0.0.0'
  s.summary        = 'Import bookmarks, history, tabs and logins from other browsers'
  s.author         = ''
  s.homepage       = 'https://github.com/astro'
  s.license        = 'Apache-2.0'
  s.platforms      = { :osx => '14.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'AstroCore'
  s.frameworks     = 'AppKit', 'Security'
  s.libraries      = 'sqlite3'
  s.source_files   = 'ImportModule.swift', 'ImportWriter.swift', 'Core/**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
