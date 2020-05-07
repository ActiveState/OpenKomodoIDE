# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Put Tree Transformations here

module Refactoring
  module Transform
    BinaryOps = { :== => :!=,
                  :!= => :==,
                  :< => :>=,
                  :<= => :>,
                  :> => :<=,
                  :>= => :<,
    }
    def negateCondition(coordinateBlock, if_start, if_condition, if_block_cond_end,
                        srcLines)
      # Types of conversions we can do:
      # [unary, :!, T] ==> T
      # [:binary, T1, op1, T2] => [:binary, T1, opposite(op1), T2]
      #
      # Note: operators don't have coordinates in the AST, so we need to
      # find them in the source.
      if if_condition[0] == :unary && if_condition[1] == :!
        if_start_line = if_start[1][0]
        if_start_end_column = if_start[1][1] + if_start[0].size
        srcContext = srcLines[if_start_line][if_start_end_column .. -1]
        srcContextStripped = strip_ruby_source(srcContext)
        if srcContextStripped.size == 0
          #XXX: Any point in looking down subsequent lines when the current line
          # starts with an 'if'?   No, I didn't think so.
          raise Exception.new("@@@ Can't find start of condition")
        end
        if_start_end_column += (srcContext.size - srcContextStripped.size)
        srcContext = srcContextStripped
        m = srcContext.match(/^!/)
        if m
          coordinateBlock[:actions] = [
            deleteText: { start: [if_start_line, if_start_end_column],
              length: 1,
              textCheck: "!"
            },
          ]
          return
        end
      end
      if if_condition[0] == :binary
        currentOp = if_condition[2]
        negatedOp = BinaryOps[currentOp]
        if negatedOp
          currentOp = currentOp.to_s
          arg1_coordinate = find_last_coordinate(if_condition[1])
          op_line = arg1_coordinate[0]
          op_end_column = arg1_coordinate[2]
          srcContext = srcLines[op_line][op_end_column .. -1]
          srcContextStripped = strip_ruby_source(srcContext)
          if srcContextStripped.size == 0
            #XXX: Any point in looking down subsequent lines when the current line
            # starts with an 'if'?   No, I didn't think so.
            raise Exception.new("@@@ Can't find start of condition")
          end
          op_end_column += (srcContext.size - srcContextStripped.size)
          srcContext = srcContextStripped
          # None of the characters in the ops need escaping
          if srcContext.index(currentOp) != 0
            raise Exception.new("@@@ Expected to see #{currentOp} at start of '#{srcContext}'")
          end
          coordinateBlock[:actions] = [
            {deleteText: { start: [op_line, op_end_column],
              length: currentOp.size,
              textCheck: currentOp,
            }},
            {insertText: { start: [op_line, op_end_column],
              text: negatedOp.to_s
            },
              highlight: true},
          ]
          return
        end
      end
      if_start_line = if_start[1][0]
      if_start_end_column = if_start[1][1] + if_start[0].size
      coordinateBlock[:actions] = [
        addText: { start: [if_block_cond_end[0], if_block_cond_end[2]], text:")"},
        addText: { start: [if_start_line, if_start_end_column] , text: "!(" },
      ]
    end
    module_function :negateCondition
  end
end

if $0 == __FILE__
  $: << File::dirname(File::dirname($0))
  require 'refactoring/utils'
  include Refactoring::Utils
  Refactoring::Transform::negateCondition({}, [1, 3], [1, 5], [1, 8],
                                        "acb\ndef\ghi")
end
