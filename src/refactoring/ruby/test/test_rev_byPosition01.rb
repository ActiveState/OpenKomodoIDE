require 'test/unit'

$: << File.join(File.dirname(File.dirname($0)), "lib")
require 'refactoring.rb'
require 'refactoring/reverseConditional'
include Refactoring::ReverseConditional

class TestReverseConditionalByPosn < Test::Unit::TestCase
  @@code01Raw = <<-EOD
def f(a, b, c)<1>
 <2> <3>i<4>f<5> <6> <7>a < <8>b<9>
 <10>   <11>pu<12>ts "Line 1<13>"<14>
 <15> <16>e<17>ls<18>e<19>
<20>    <21>p<22>uts "Line 3<23>"<24>
<25>  <26>e<27>nd<28>
<29>end<30>
    EOD
  @@Code01, @@DataPositions = unmark_text_by_line_column(@@code01Raw)
  @@ExpectedFailures = [1, 2, 29, 30]
  # 29?
  @@ExpectedSuccesses = (3 .. 28).to_a
  puts @@Code01
  def verify_src1_switch(actions, posn)
    msg = "In iter #{posn}"
    assert_equal actions[0][:deleteText][:start], [5, 0], msg
    assert_equal actions[0][:deleteText][:end],   [5, 16], msg
    assert_equal actions[1][:insertText][:start], [5, 0], msg
    assert_equal actions[1][:insertText][:text], "    puts \"Line 1\"", msg
    assert_equal actions[2][:deleteText][:start], [3, 0], msg
    assert_equal actions[2][:deleteText][:end],   [3, 16], msg
    assert_equal actions[3][:insertText][:start], [3, 0], msg
    assert_equal actions[3][:insertText][:text], "    puts \"Line 3\"", msg
    assert_equal actions[4][:deleteText][:start], [2, 8], msg
    assert_equal actions[4][:deleteText][:length], 1, msg
    assert_equal actions[5][:insertText][:start], [2, 8], msg
    assert_equal actions[5][:insertText][:text], ">=", msg
    assert_equal actions[5][:highlight], true, msg
  end
  def test_expected_successes
    @@ExpectedSuccesses.each do |posn|
      $stderr.puts("test_expected_successes: posn: #{posn}")
      lineNo, colPosn = @@DataPositions[posn]
      actions = ReverseConditional.new.main(@@Code01, lineNo, colPosn)
      verify_src1_switch(actions, posn)
    end
  end
  
  def test_expected_failures
    @@ExpectedFailures.each do |posn|
      $stderr.puts("test_expected_failures: posn: #{posn}")
      lineNo, colPosn = @@DataPositions[posn]
      assert_raise(Exception) do
        ReverseConditional.new.main(@@Code01, lineNo, colPosn)
        $stderr.puts("No exception for posn #{posn}")
      end
    end
  end
end
