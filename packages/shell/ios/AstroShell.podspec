Pod::Spec.new do |s|
  s.name           = 'AstroShell'
  s.version        = '0.0.0'
  s.summary        = 'Window chrome and menus'
  s.author         = ''
  s.homepage       = 'https://github.com/astro'
  s.license        = 'Apache-2.0'
  s.platforms      = { :osx => '14.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'Sparkle', '~> 2.9'
  s.frameworks     = 'AppKit', 'LocalAuthentication', 'ServiceManagement', 'UniformTypeIdentifiers', 'UserNotifications', 'CoreImage', 'Security', 'NaturalLanguage', 'SwiftUI'
  s.weak_frameworks = 'Translation'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
