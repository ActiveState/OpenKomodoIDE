# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

require 'optparse'

$: << File.join(File.dirname(File.dirname($0)), 'lib')
require 'refactoring.rb'
require 'refactoring/reverseConditional'
include Refactoring::ReverseConditional

# Input: Path, currentLine(1-based), currentColumn (1-based)
# 
# Usage: See main
# Output: JSON directives to reverse the blocks, written to STDOUT

$usageString = "Usage: {-v|--verbose | --line=num | --column=num }... path|STDIN"

def usage(reason=nil)
  puts "reverseConditional.rb#{reason ? ": " + reason : ""}; #{$usageString}"
  exit 1
end

def getOptions
  options={}
  optparse = OptionParser.new do |opts|
    opts.banner = $usageString
    options[:verbose] = false
    opts.on('-v', '--verbose', 'verbose output') do options[:verbose] = true end

    options[:currentLine] = nil
    opts.on('-l N', '--line N', 'current line') do |lineNo| options[:currentLine] = lineNo.to_i end
    options[:currentColumn] = nil
    opts.on('-c N', '--column N', 'current column') do |columnNo| options[:currentColumn] = columnNo.to_i end

    opts.on('-h', '--help', 'Display this screen') do
      usage()
    end
  end
  optparse.parse!
  
  case ARGV.size
    when 0
    options[:stdin] = true
    options[:input] = nil
    when 1
    options[:stdin] = false
    options[:input] = ARGV[0]
  else
    usage("too many input files:#{ARGV.join(", ")}")
  end
  return options
end

def main
  options = getOptions
  usage("No current line given") if !options[:currentLine]
  usage("No current column given") if !options[:currentColumn]
  
  if options[:input]
    src = File.open(options[:input], 'r') {|fd| fd.read}
  else
    src = $stdin.read
  end
  actions = ReverseConditional.new.main(src, options[:currentLine].to_i,
                                          options[:currentColumn].to_i)
  require 'json'
  puts JSON.dump(actions)
  return 0
end

if $0 == __FILE__
  main
end
