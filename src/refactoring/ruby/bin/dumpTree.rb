# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

require 'ripper'
require 'awesome_print'
require 'optparse'

require 'refactoring.rb'
# Write this as a standalone thing, and then rewrite with libraries

# Input: Path, currentLine(1-based), currentColumn (1-based)
# 
# Usage: See main
# Output: JSON directives to reverse the blocks, written to STDOUT

$usageString = "Usage: {-v|--verbose}... path|STDIN"

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
  
  if options[:input]
    src = File.open(options[:input], 'r') {|fd| fd.read}
  else
    src = $stdin.read
  end
  tree = Ripper.sexp(src)
  ap tree
  return 0
end
#a = { :abc => 3, "blip" => 4, :beep => [1,2]}

if $0 == __FILE__
  main
end
