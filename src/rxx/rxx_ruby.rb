#/usr/bin/env ruby
# Copyright (c) 2003-2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# See comment at top of rxx_python.py for a description of the Rx protocol

# rx matching in Ruby

begin
  require 'json'
rescue LoadError
  require 'rubygems'
  require 'json'
end

class Evaluator

  def initialize(requestString)
    requestPacket = JSON.parse(requestString)
    @op = requestPacket['operation']
    @pattern = requestPacket['pattern']
    @options = requestPacket['options']
    @subjectText = requestPacket['text']
    @requestPacket = requestPacket
  end

  def init
    @regex = compile()
  end
  
  def do_match
    m = @regex.match(@subjectText)
    if m
      groups = [_groups_from_match_obj(m)]
      return {
        'status' =>  'ok',
        'result' => groups,
        'lastNumGroups' => m.length - 1
      }
    else
      return { 'status' => 'matchFailure' } 
    end
  end
  
  def do_matchAll
    groupObjs = []
    text = @subjectText
    inputPos = 0
    last_match = nil
    while text.length > 0 and (m = @regex.match(text))
      groupObjs << _groups_from_match_obj(m, inputPos)
      matchEndPos = m.offset(0)[1]
      # Always move at least one character ahead
      matchEndPos = 1 if matchEndPos == 0
      inputPos += matchEndPos
      text = text[matchEndPos .. -1]
      last_match = m
    end
    if groupObjs.size == 0
      return { 'status' => 'matchFailure' }
    else
      return { 'status' => 'ok',
        'result' => groupObjs,
        'lastNumGroups' => last_match.length - 1,
      }
    end
  end

  def do_split()
    return { 'status' => 'ok',
             'result' => @subjectText.split(@regex) }
  end

  def do_replace
    res = do_match
    return res if res['status'] != 'ok'
    #groupObjs = res['result']
    #res['groupObjs'] = groupObjs
    replacement = @requestPacket['replacement']
    res['replacedText'] = replacedText = @subjectText.sub(@regex, replacement)
    # And calc the substitution, similar to the way it's done in Perl
    m = @regex.match(@subjectText)
    if m
      matchedPartStart = m.offset(0)[0]
      diff = replacedText.length - @subjectText.length
      res['substitutions'] = [replacedText[matchedPartStart,
                                           m[0].length + diff]]
    end
    return res
  end

  def do_replaceAll
    res = do_matchAll()
    return res if res['status'] != 'ok'
    replacement = @requestPacket['replacement']
    res['replacedText'] = replacedText = @subjectText.gsub(@regex, replacement)
    # Not totally right, as this won't handle look-left assertions.
    # More accurate to calc the substitutions the way Perl does.
    substitutions = []
    @subjectText.gsub(@regex) do |m|
      substitutions << m.sub(@regex, replacement)
    end
    res['substitutions'] = substitutions
    return res
  end

  def run
    methodName = "do_" + @op
    res = self.send(methodName)
    res['operation'] = @op
    res['lastGroupNames'] = []; #Not available in Ruby
    return res
  end

  private
  def compile
    lettersToValues = {
      'i' => Regexp::IGNORECASE,
      'x' => Regexp::EXTENDED,
      's' => Regexp::MULTILINE,
    }
    # Ruby 1.9: String no longer mixes in Enumerable, so split the
    # string, even though it's redundant for Ruby 1.8
    options = @options.split(//).inject(0) {|final, opt|
      final | lettersToValues.fetch(opt, 0)
    }
    if RUBY_VERSION.to_f <= 1.8
      lang = @options =~ /u/i ? "u" : nil
    else
      # bug 88290: 1.9.* warns encoding option 'u' is ignored
      lang = nil
    end
    return Regexp.new(@pattern, options, lang)
  end
  
  def _groups_from_match_obj(matchData, inputPos = 0)
    return (0 .. matchData.length - 1).map { |i|
      (matchData.offset(i)[0].nil? || matchData.offset(i)[1].nil?) ?
       {
        'name' => nil,
        'span' => [-1, -1],
        'value' => nil
        } : {
        'name' => nil,
        'span' => [matchData.offset(i)[0] + inputPos,
                 matchData.offset(i)[1] + inputPos],
        'value' => matchData.to_a[i]
        }
    }
  end
end # class Evaluator

def main(requestString=nil)
  if not requestString
    requestString = $stdin.read()
  end
  begin
    evaluator = Evaluator.new(requestString)
    evaluator.init
  rescue Exception
    res = { 'status' => 'matchError',
            'exception' => $!.message }
    return res
  end
  return evaluator.run()
end

#packets = [
#{
#      'text' => 'école'.unpack('C*').pack('U*'), # for JSON
#      'pattern' => '(\w)(\w)',
#      'operation' => 'match',
#      'options' => 'u',
#}, {
#    'text' => ';!@Lang@!UTF-8! Lannng Lanng b',
#    'pattern' => 'La(n+)g',
#    'operation' => 'matchAll',
#    'options' => 'u',
#},  {
#    'text' => ';!@Lang@!UTF-8! Lannng Lanng b',
#    'pattern' => 'La(n+)g',
#    'operation' => 'split',
#    'options' => 'u',
#}, 
#{
#      'text' => 'école'.unpack('C*').pack('U*'), # for JSON
#      'pattern' => '(\w)(\w)',
#      'operation' => 'replace',
#      'replacement' => '<<[\2]v[\1]>>',
#      'options' => 'u',
#},
#  {
#    'text' => ';!@Lang@!UTF-8! Lannng Lanng b',
#    'pattern' => 'La(n+)g',
#    'operation' => 'replaceAll',
#    'replacement' => 'feesh26:\1',
#    'options' => 'u',
#}]
#packets.each {|packet|
#  str = JSON.generate(packet)
#  puts str
#  responsePacket = main(str)
#  require 'pp'
#  puts "#{packet['operation']} :"
#  pp(responsePacket)
#  jsonResult = responsePacket.to_json()
#  print jsonResult
#} if false
str = nil
#str = JSON.generate(packets[0])
responsePacket = main(str)
jsonResult = responsePacket.to_json()
print jsonResult
