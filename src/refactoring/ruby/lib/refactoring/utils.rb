# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Helpers for refactoring Ruby code

require 'bsearch'

module Refactoring
  module Utils
    def isCoordinateNode(node)
      node.class == Array && node.size == 2 && node.all?{|x| x.class == Fixnum}
    end

    def isCoordinateNodeParent(node)
      node.class == Array && isCoordinateNode(node[-1])
    end

    def compare_nodes(tok, coord)
      res = tok[0] <=> coord[0]
      res != 0 ? res : tok[2] <=> coord[1]
    end

    def get_token_index(tok_start, kwd_tokens, kwd)
      sub_tokens = kwd_tokens.find_all{|x| x[3] == kwd}
      index = sub_tokens.bsearch_lower_boundary {|x| compare_nodes(x, tok_start)}
      if index.nil?
        puts "No `#{kwd}' item for tok_start #{tok_start}"
        return nil
      end
      curr_tok = [sub_tokens[index][0], sub_tokens[index][2]]
      if index > 0
        prev_tok = [sub_tokens[index - 1][0], sub_tokens[index - 1][2]]
        if (curr_tok <=> tok_start) == 1 && (prev_tok <=> tok_start) == -1
          return sub_tokens[index - 1][0 .. 2]
        end
      end
      return sub_tokens[index ][0 .. 2]
    end
    
    def find_first_coordinate(root)
      if root.class != Array
        return nil
      end
      # Do we have a location at the end of the current branch?
      if isCoordinateNode(lastNode = root[-1])
        return lastNode + [lastNode[1] + root[-2].size]
      end
      root.each_with_index do |child, index|
        lastNode = find_first_coordinate(child)
        if lastNode
          return lastNode
        end
      end
    end
    
    def find_last_coordinate(root)
      if root.class != Array
        return nil
      end
      # Do we have a location at the end of the current branch?
      if isCoordinateNode(lastNode = root[-1])
        return lastNode + [lastNode[1] + root[-2].size]
      end
      Range.new(0, root.size - 1).to_a.reverse.each do |i|
        lastNode = find_last_coordinate(root[i])
        if lastNode
          return lastNode
        end
      end
      nil
    end
    
    def compare_nodes(tok, coord)
      res = tok[0] <=> coord[0]
      res != 0 ? res : tok[2] <=> coord[1]
    end
    
    def get_token_index(tok_start, kwd_tokens, kwd)
      sub_tokens = kwd_tokens.find_all{|x| x[3] == kwd}
      index = sub_tokens.bsearch_lower_boundary {|x| compare_nodes(x, tok_start)}
      if index.nil?
        puts "No `#{kwd}' item for tok_start #{tok_start}"
        return nil
      end
      curr_tok = [sub_tokens[index][0], sub_tokens[index][2]]
      if index > 0
        prev_tok = [sub_tokens[index - 1][0], sub_tokens[index - 1][2]]
        if (curr_tok <=> tok_start) == 1 && (prev_tok <=> tok_start) == -1
          return sub_tokens[index - 1][0 .. 2]
        end
      end
      return sub_tokens[index ][0 .. 2]
    end
    
    def strip_ruby_source(s)
      return s.sub(/^\s*(?:\#.*$)?/, '')
    end
    
    def unmark_text_by_line_column(markedup_text)
=begin comment
    {Parse text with potential markup as follows and return
    (<text>, <data-dict>).

        "<|>" indicates the current position (pos), defaults to the end
            of the text.
        "<+>" indicates the trigger position (trg_pos), if present.
        "<$>" indicates the start position (start_pos) for some kind of
            of processing, if present.
        "<N>" is a numbered marker. N can be any of 0-99. These positions
            are returned as the associate number key in <data-dict>.

    E.g.:
        >>> unmark_text('foo.<|>')
        ('foo.', {'pos': 4})
        >>> unmark_text('foo.<|><+>')
        ('foo.', {'trg_pos': 4, 'pos': 4})
        >>> unmark_text('foo.<+>ba<|>')
        ('foo.ba', {'trg_pos': 4, 'pos': 6})
        >>> unmark_text('fo<|>o.<+>ba')
        ('foo.ba', {'trg_pos': 4, 'pos': 2})
        >>> unmark_text('os.path.join<$>(<|>')
        ('os.path.join(', {'pos': 13, 'start_pos': 12})
        >>> unmark_text('abc<3>defghi<2>jk<4>lm<1>nopqrstuvwxyz')
        ('abcdefghijklmnopqrstuvwxyz', {1: 13, 2: 9, 3: 3, 4: 11, 'pos': 26})
    
    See the matching markup_text() below.
=end
      data = {}
      lineNo = 1 # Line-numbers are 1-based
      col = 0
      textBits = []
      markedup_text.scan(/\r?\n|<\d+>|[^<\r\n]+|</) do |w|
        if w["\n"]
          lineNo += 1
          col = 0
          textBits << w
        elsif (m = /^<(\d+)>$/.match(w))
          data[m[1].to_i] = [lineNo, col]
        else
          col += w.size
          textBits << w
        end
      end
      return textBits.join(""), data
    end
  end
end

if $0 == __FILE__
  include Refactoring::Utils
  src = <<-EOD
def f(a, b, c)<1>
 <2> <3>i<4>f<5> <6> <7>a < <8>b<9>
 <10>   <11>pu<12>ts "Line 1<13>"<14>
 <15> <16>e<17>ls<18>e<19>
<20>    <21>p<22>uts "Line 3<23>"<24>
<25>  <26>e<27>nd<28>
<29>end<30>
    EOD
  text, data = unmark_text_by_line_column(src)
  puts text
  require 'pp'
  pp data
end
