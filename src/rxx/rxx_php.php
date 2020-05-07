<?php
# Copyright (c) 2003-2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# See comment at top of rxx_python.py for a description of the Rx protocol
# JSON has been built in to PHP since 5.2 -- no support planned for
# earlier versions.

# rx matching in PHP

class Evaluator {
    private $op, $pattern, $options, $regex, $subjectText, $requestPacket;

    public function __construct($requestString) {
        $requestPacket = json_decode($requestString, 1);
        $this->op = $requestPacket['operation'];
        $this->pattern = $requestPacket['pattern'];
        $this->options = $requestPacket['options'];
        $this->subjectText = $requestPacket['text'];
        if (array_key_exists('openDelimiter', $requestPacket)) {
           $this->openDelimiter = $requestPacket['openDelimiter'];
        } else {
           $this->openDelimiter = '/';
        }
        if (array_key_exists('closeDelimiter', $requestPacket)) {
           $this->closeDelimiter = $requestPacket['closeDelimiter'];
        } else {
           $this->closeDelimiter = '/';
        }
        $this->requestPacket = $requestPacket;
    }
    
    public function init() {
       $this->regex = $this->compile();
    }
    
    private function do_single_match($ptn, $sub, $offset) {
        $matches = array();
        $res = preg_match($ptn, $sub,
                          $matches, PREG_OFFSET_CAPTURE, $offset);
        if (!$res) {
            return null;
        }
        return $this->_groups_from_match_obj($matches);
    }
    
    private function do_match() {
        $res = $this->do_single_match($this->regex, $this->subjectText, 0);
        if ($res) {
            return array (
                    'status' =>  'ok',
                    'result' => array($res),
                    'lastNumGroups' => count($res) - 1
                    );
        } else {
            return array('status' => 'matchFailure' );
        }
    }
    
    private function do_matchAll() {
        $groupObjs = array();
        $inputPos = 0;
        $ptn = $this->regex;
        $inputText = $this->subjectText;
        while (true) {
            $res = $this->do_single_match($ptn, $inputText, $inputPos);
            if (!$res) {
                break;
            }
            array_push($groupObjs, $res);
            $span = $res[0]['span'];
            //print "Span:";
            //print_r($span);
            $endPoint = $span[1];
            if ($inputPos == $endPoint) {
                $inputPos += 1;
            } else {
                $inputPos = $endPoint;
            }
        }
        if (count($groupObjs) == 0) {
            return array ('status' => 'matchFailure');
        } else {
           return array (
               'status' => 'ok',
               'result' => $groupObjs,
               'lastNumGroups' => count($groupObjs[0]) - 1
          );
        }
    }
    
    private function do_split() {
        return array (
            'status' => 'ok',
            'result' => preg_split($this->regex, $this->subjectText),
        );
    }
    
    private function do_replace() {
        $res = $this->do_match();
        if ($res['status'] != 'ok') {
            return $res;
        }
        $replacement = $this->requestPacket['replacement'];
        $res['replacedText'] = $replacedText = preg_replace($this->regex, $replacement, $this->subjectText, 1);
        
        # And calc the substitution, similar to the way it's done in Perl
        $matchedSpan = $res['result'][0][0]['span'];
        $matchedPartStart = $matchedSpan[0];
        $diff = strlen($replacedText) - strlen($this->subjectText);
        $res['substitutions'] = array(
            substr($replacedText, $matchedPartStart,
                   $matchedSpan[1] - $matchedPartStart + $diff)
            );
        return $res;
    }
    
    private function do_replaceAll() {
        $res = $this->do_matchAll();
        if ($res['status'] != 'ok') {
            return $res;
        }
        $replacement = $this->requestPacket['replacement'];
        $res['replacedText'] = $replacedText = preg_replace($this->regex, $replacement, $this->subjectText);
        # Not totally right, as this won't handle look-left assertions.
        # More accurate to calc the substitutions the way Perl does. 
        $substitutions = array();
        $inputPos = 0;
        $inputText = $this->subjectText;
        $matchedIndex = 0;
        $originalLength = strlen($inputText);
        $results = $res['result'];
        while (strlen($inputText) > 0 && $matchedIndex < count($results)) {
            $span = $results[$matchedIndex][0]['span'];
            $thisSub = preg_replace($this->regex, $replacement, $inputText, 1);
            $numCharsToIgnore = $originalLength - $span[1];
            if ($numCharsToIgnore > 0) {
                $fixedSub = substr($thisSub, $span[0] - $inputPos, -1 * $numCharsToIgnore);
            } else {
                $fixedSub = substr($thisSub, $span[0] - $inputPos);
            }
            array_push($substitutions, $fixedSub);
            $inputText = substr($inputText, $span[1] - $inputPos);
            $inputPos = $span[1];
            $matchedIndex += 1;
        }
        $res['substitutions'] = $substitutions;
        return $res;
    }
    
    public function run() {
     $methodName = "do_" . $this->op;
     $res = $this->$methodName();
     $res['operation'] = $this->op;
     $res['lastGroupNames'] = array(); # Available in PHP?
     return $res;
    }
    
    public function compile() {
       return $this->openDelimiter . $this->pattern . $this->closeDelimiter . $this->options;
    }
    
    private function _groups_from_match_obj($matchData, $inputPos = 0) {
        // These loops duplicate name and positional info over two
        // identical entries.  For example, /(?P<name1>\w)(\w)(?P<name2>\w)/ =~ 'abc' ==>
        // this matchData:
        //
        // 0 => ["abc", 0], 
        // name1 => ["a", 0], 
        // 1 => ["a", 0], 
        // 2 => ["b", 1], 
        // name2 => ["c", 2], 
        // 3 => ["c", 2]
        
        $groups = array();
        $skip_next_item = false;
        $next_expected_key = 0;
        foreach ($matchData as $key => $matchInfo) {
            if ($skip_next_item) {
                // print("    _groups_from_match_obj: skip item $key:");
                $skip_next_item = false;
                continue;
            }
            $matchedText = $matchInfo[0];
            $matchedStart = $matchInfo[1];
            if ($key == $next_expected_key) {
                $name = null;
            } else {
                $name = $key;
                $skip_next_item = true;
            }
            if ($matchedStart == -1) {
                $value = array(
                    'name' => null,
                    'span' => array(-1, -1),
                    'value' => null
                );
            } else {
                $value = array(
                    'name' => $name,
                    'span' => array($matchedStart + $inputPos,
                                    $matchedStart + strlen($matchedText) + $inputPos),
                    'value' => $matchedText
                );
            }
            array_push($groups, $value);
            $next_expected_key += 1;
        }
        return $groups;
     }
} # class Evaluator

function main($requestString=null) {
  if (!$requestString) {
    $requestString = "";
    $in = fopen("php://stdin", "r");
    while ($data = fgets($in, 1024)) {
        $requestString .= $data;
    }
    fclose($in);
  }
  $evaluator = new Evaluator($requestString);
  $evaluator->init();
  try {
      return $evaluator->run();
  } catch(Exception $e) {
      return array(
          'status' => 'matchError',
          'exception' => $e->getMessage()
      );
  }
}

//$packets = array(
//array(
//      'text' => 'Ècole',
//      'pattern' => '(\w)(\w)',
//      'operation' => 'match',
//      'options' => 'u',
//),
//array(
//    'text' => 'はじめ まして さかな woofy.',
//    'pattern' => '(\\w+)(\\W+)',
//    'operation' => 'matchAll',
//    'options' => 'u',
//),
//array(
//    'text' => 'école_ÇÉLÈBE',
//    'pattern' => '(\\w)',
//    'operation' => 'matchAll',
//    'options' => 'u',
//),
//
//array(
//    'text' => ';!@Lang@!UTF-8! Lannng Lanng b',
//    'pattern' => 'La(n+)g',
//    'operation' => 'matchAll',
//    'options' => 'u',
//),
//array(
//    'text' => ';!@Lang@!UTF-8! Lannng Lanng b',
//    'pattern' => 'La(n+)g',
//    'operation' => 'split',
//    'options' => 'u',
//),
//array(
//      'text' => 'Ècole',
//      'pattern' => '(\w)(\w)',
//      'operation' => 'replace',
//      'replacement' => '<<[\2]v[\1]>>',
//      'options' => 'u',
//),
//array(
//    'text' => 'moose33 abc35 722e33',
//    'pattern' => '(\\w)(\\d)',
//    'operation' => 'replaceAll',
//    'replacement' => '[\\2:\\1]',
//    'options' => ''
//),
//array(
//    'text' => 'stuff before13:moo x55:you   99:moose',
//      'pattern' => '\\w+?(\\d+):(\\w+)',
//    'operation' => 'replaceAll',
//    'replacement' => '<<[\2]v[\1]>>'
//),
//array(
//    'text' => ';!@Lang@!UTF-8! Lannng Lanng b',
//    'pattern' => 'La(n+)g',
//    'operation' => 'replaceAll',
//    'replacement' => 'feesh26:\1',
//    'options' => 'u',
//)
//);
//foreach ($packets as $packet) {
//    $str = json_encode($packet);
//    print("$str\n");
//    $responsePacket = main($str);
//    printf("%s :", $packet['operation']);
//    print_r($responsePacket);
//    $jsonResult = json_encode($responsePacket);
//    print $jsonResult;
//}
$str = null;
# $str = json_encode($packets[0]);
$responsePacket = main($str);
$jsonResult = json_encode($responsePacket);
print $jsonResult;
?>
