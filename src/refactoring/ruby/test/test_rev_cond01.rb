require 'test/unit'

$: << File.join(File.dirname(File.dirname($0)), "lib")
require 'refactoring.rb'
require 'refactoring/reverseConditional'
include Refactoring::ReverseConditional

class TestReverseConditional < Test::Unit::TestCase
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
    actions = ReverseConditional.new.main(src, 3, 0)
    assert_equal actions[0][:deleteText][:start], [6, 0]
    assert_equal actions[0][:deleteText][:end],   [6, 16]
    assert_equal actions[1][:insertText][:start], [6, 0]
    assert_equal actions[1][:insertText][:text], "    puts \"Line 1\"\n    puts \"Line 2\""
    assert_equal actions[2][:deleteText][:start], [3, 0]
    assert_equal actions[2][:deleteText][:end],   [4, 16]
    assert_equal actions[3][:insertText][:start], [3, 0]
    assert_equal actions[3][:insertText][:text], "    puts \"Line 3\""
    assert_equal actions[4][:deleteText][:start], [2, 7]
    assert_equal actions[4][:deleteText][:length], 1
    assert_equal actions[5][:insertText][:start], [2, 7]
    assert_equal actions[5][:insertText][:text], ">="
    assert_equal actions[5][:highlight], true
  end
  
  def test_rc02
    src = <<-EOD
def f(a, b, c)
  if a < b
    puts "Line 1"
  else
    puts "Line 3"
  end
end
    EOD
    # Lines are 1-based, columns 0-based
    actions = ReverseConditional.new.main(src, 3, 0)
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
end
