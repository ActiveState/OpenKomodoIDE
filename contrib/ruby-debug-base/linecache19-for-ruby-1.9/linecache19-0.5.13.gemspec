$LOAD_PATH.unshift 'lib'

Gem::Specification.new do |s|
  s.name              = "linecache19"
  s.version           = "0.5.13"
  s.date              = Time.now.strftime('%Y-%m-%d')
  s.summary           = "Do no use"
  s.homepage          = "http://github.com/robmathews/linecache19-0.5.13"
  s.email             = "noreply@noemail.com"
  s.authors           = [ "Do Not Use" ]
  s.has_rdoc          = false
  s.files             = %w( README )
  s.files            += Dir.glob("lib/**/*")
  s.files            += Dir.glob("bin/**/*")
  s.files            += Dir.glob("man/**/*")
  s.files            += Dir.glob("test/**/*")
#  s.executables       = %w( #{name} )
  s.description       = "Do not use"
  s.required_ruby_version = '>= 1.9.3'
end
