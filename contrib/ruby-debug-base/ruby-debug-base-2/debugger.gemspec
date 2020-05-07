# -*- encoding: utf-8 -*-
require 'rubygems' unless defined? Gem
require File.dirname(__FILE__) + "/lib/debugger/version"

Gem::Specification.new do |s|
  s.name = %q{debugger}
  s.version = Debugger::VERSION
  s.authors = ["Kent Sibilev", "Mark Moseley", "Gabriel Horner"]
  s.email = "gabriel.horner@gmail.com"
  s.homepage = "http://github.com/cldwalker/debugger"
  s.summary = %q{Fast Ruby debugger - base + cli}
  s.description = %q{debugger is a fast implementation of the standard Ruby debugger debug.rb.
It is implemented by utilizing a new Ruby C API hook. The core component
provides support that front-ends can build on. It provides breakpoint
handling, bindings for stack frames among other things.
}
  s.required_rubygems_version = ">= 1.3.6"
  s.extra_rdoc_files = [ "README.md" ]
  s.files = `git ls-files`.split("\n")
  s.extensions << "ext/ruby_debug/extconf.rb"
  s.executables = ["rdebug"]
  s.add_dependency "columnize", ">= 0.3.1"
  s.add_dependency "debugger-ruby_core_source", '~> 1.2.0'
  s.add_dependency "debugger-linecache", '~> 1.2.0'
  s.add_development_dependency 'rake', '~> 0.9.2.2'
  s.add_development_dependency 'rake-compiler', '~> 0.8.0'
  s.add_development_dependency 'minitest', '~> 2.12.1'
  s.add_development_dependency 'mocha', '~> 0.13.0'
  s.license = "BSD"
end
