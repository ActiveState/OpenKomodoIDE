require 'mocha/setup'
require 'pathname'

Debugger::Command.settings[:debuggertesting] = true
# $debugger_test_dir must be specified, it should point to the test/ directory
Dir.glob(File.expand_path("../test/*.rb", __FILE__)).each { |f| require f }
