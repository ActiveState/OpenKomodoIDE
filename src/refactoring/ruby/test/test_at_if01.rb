require 'test/unit'

$: << File.join(File.dirname(File.dirname($0)), "lib")
require 'refactoring.rb'
require 'refactoring/reverseConditional'
include Refactoring::ReverseConditional

class TestReverseConditionalElse < Test::Unit::TestCase
  @@code01 = <<-EOD
def f(a, b, c)
  if a < b
    puts "Line 1"
  else
    puts "Line 3"
  end
end
    EOD
  def verify_src1_switch(actions)
    assert_equal actions[0][:deleteText][:start], [5, 0]
    assert_equal actions[0][:deleteText][:end],   [5, 16]
    assert_equal actions[1][:insertText][:start], [5, 0]
    assert_equal actions[1][:insertText][:text], "    puts \"Line 1\""
    assert_equal actions[2][:deleteText][:start], [3, 0]
    assert_equal actions[2][:deleteText][:end],   [3, 16]
    assert_equal actions[3][:insertText][:start], [3, 0]
    assert_equal actions[3][:insertText][:text], "    puts \"Line 3\""
    assert_equal actions[4][:deleteText][:start], [2, 7]
    assert_equal actions[4][:deleteText][:length], 1
    assert_equal actions[5][:insertText][:start], [2, 7]
    assert_equal actions[5][:insertText][:text], ">="
    assert_equal actions[5][:highlight], true
  end
  
  # Now sit on the else block.
  
end
