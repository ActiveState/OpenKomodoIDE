require 'test/unit'

$: << File.join(File.dirname(File.dirname($0)), "lib")
require 'refactoring.rb'
require 'refactoring/reverseConditional'
include Refactoring::ReverseConditional

class TestReverseConditionalElse < Test::Unit::TestCase
  @@code01Raw = <<-EOD
def f(a, b, c)<1>
 <2> <3>i<4>f<5> <6> <7>a < <8>b<9>
 <10>   <11>pu<12>ts "Line 1<13>"<14>
 <15> <16>e<17>ls<18>e<19>
<20>    <21>p<22>uts "Line 3<23>"<24>
<25>  <26>e<27>nd<28>
<29>end<30>
    EOD
  @@code01, @@dataPositions = unmark_text_by_line_column(@@code01Raw)
  puts @@code01
  @@expectedFailures = [1, 2, 29, 30]
  @@expectedSuccesses = [3 .. 28].to_a
  def verify_src1_switch(actions)
    assert_equal actions[0][:deleteText][:start], [5, 0]
    assert_equal actions[0][:deleteText][:end],   [5, 16]
    assert_equal actions[1][:insertText][:start], [5, 0]
    assert_equal actions[1][:insertText][:text], "    puts \"Line 1\""
    assert_equal actions[2][:deleteText][:start], [3, 0]
    assert_equal actions[2][:deleteText][:end],   [3, 16]
    assert_equal actions[3][:insertText][:start], [3, 0]
    assert_equal actions[3][:insertText][:text], "    puts \"Line 3\""
    assert_equal actions[4][:deleteText][:start], [2, 8]
    assert_equal actions[4][:deleteText][:length], 1
    assert_equal actions[5][:insertText][:start], [2, 8]
    assert_equal actions[5][:insertText][:text], ">="
    assert_equal actions[5][:highlight], true
  end
  def test_rc01_cursor_on_else_block
    src = @@code01
    # Lines are 1-based, columns 0-based
    actions = ReverseConditional.new.main(src, 5, 0)
    verify_src1_switch(actions)
  end

  def test_sitting_on_if_test
    src = @@code01
    # Lines are 1-based, columns 0-based
    actions = ReverseConditional.new.main(src, 5, 0)
    verify_src1_switch(actions)
  end
  
  def test_cursor_before_if
    src = @@code01
    # Lines are 1-based, columns 0-based
    assert_raise(Exception) do
      ReverseConditional.new.main(src, 2, 0)
    end
    lines = src.split(/\r?\n/)
    line2 = lines[1]
    posn = line2.index("if")
    if posn > 0
      assert_raise(Exception) do
        ReverseConditional.new.main(src, 2, posn - 1) # before <|> if
      end
    end
    
    actions = ReverseConditional.new.main(src, 2, posn) # at <|>if
    verify_src1_switch(actions)
    
    actions = ReverseConditional.new.main(src, 2, posn + 1) # in i<|>f
    verify_src1_switch(actions)
    
    m = /(\s*if\s*)/.match(line2)
    if m
      actions = ReverseConditional.new.main(src, 2, m[1].size) # after if  <|>x
      verify_src1_switch(actions)
      actions = ReverseConditional.new.main(src, 2, m[1].size + 1) # after if  x<|>
      verify_src1_switch(actions)
    end
    
  end
end
