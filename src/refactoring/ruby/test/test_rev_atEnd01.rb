require 'test/unit'

$: << File.join(File.dirname(File.dirname($0)), "lib")
require 'refactoring.rb'
require 'refactoring/reverseConditional'
include Refactoring::ReverseConditional

class TestRevCondAfterLastEnd < Test::Unit::TestCase
  def test_rc01
    src = <<-EOD
def f(a, b, c)
  if a < b
    puts "Line 1"
    puts "Line 2"
  else
    puts "Line 3"
  end
end
    EOD
    # Lines are 1-based, columns 0-based
    assert_raise(Exception) do
      ReverseConditional.new.main(src, 8, 0)
    end
  end
end