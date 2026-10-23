Pod::Spec.new do |s|
  s.name           = 'AstroShaders'
  s.version        = '0.0.0'
  s.summary        = 'Metal shader views'
  s.author         = ''
  s.homepage       = 'https://github.com/astro'
  s.license        = 'Apache-2.0'
  s.platforms      = { :osx => '14.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Metal', 'MetalKit'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
