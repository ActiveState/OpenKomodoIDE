# -*- encoding: utf-8 -*-

Gem::Specification.new do |s|
  s.name = %q{ruby_core_source}
  s.version = "0.1.4"

  s.required_rubygems_version = Gem::Requirement.new(">= 0") if s.respond_to? :required_rubygems_version=
  s.authors = ["Mark Moseley"]
  s.date = %q{2009-08-15}
  s.description = %q{Retrieve Ruby core source files}
  s.email = %q{mark@fast-software.com}
  s.extra_rdoc_files = [
    "README",
     "lib/ruby_core_source.rb"
  ]
  s.files = [
     "README",
     "lib/ruby_core_source.rb",
     "lib/contrib/uri_ext.rb",
     "lib/contrib/progressbar.rb"
  ]
  s.homepage = %q{http://github.com/mark-moseley/ruby_core_source}
  s.rdoc_options = ["--charset=UTF-8"]
  s.require_paths = ["lib"]
  s.required_ruby_version = Gem::Requirement.new(">= 1.8.2")
  s.rubygems_version = %q{1.3.4}
  s.summary = %q{Retrieve Ruby core source files}
  s.add_dependency("archive-tar-minitar", ">= 0.5.2")

  if s.respond_to? :specification_version then
    current_version = Gem::Specification::CURRENT_SPECIFICATION_VERSION
    s.specification_version = 3

    if Gem::Version.new(Gem::RubyGemsVersion) >= Gem::Version.new('1.2.0') then
    else
    end
  else
  end
end
