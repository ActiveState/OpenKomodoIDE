# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Put coordinates in ripper trees for
# ], }, 

module Refactoring
  module InsertPositions
    
    class InsertPositions
      attr_accessor :srcLines, :keywords
      # Don't grab end's, because the tree only shows the last part of each statement,
      # but doesn't show end's.
      @@kwds = [:if, :elsif, :else, :def, :module, :class, :while, :until, :unless,
                :begin, :rescue,
                ]
      def setup(srcLines, keywords)
        @keywords = keywords
        # line-numbers are 1-based, so add an empty 0-index string
        @srcLines = srcLines.unshift("")
        # Assume we have input
        @currentLineNo = 1
        @currentPos = 0
        @currentPosNext = 0
        @currentLine = srcLines[1]
      end
      
      def syncKeywords
        while @keywords.size > 0
          kwd1 = @keywords[0]
          kwdPosn = kwd1[0]
          if (kwdPosn[0] < @currentLineNo \
              || (kwdPosn[0] == @currentLineNo && kwdPosn[1] < @currentPos))
            puts "Dropping kwd #{kwd1[2]} from #{kwd1[0]}"
            @keywords.shift
          else
            break
          end
        end
      end
      
      def updateCurrentCoordinate(node, tokLen)
        newLineNo = node[0]
        @currentPos = node[1]
        @currentPosNext = @currentPos + tokLen
        if @currentLineNo < newLineNo
          @currentLine = @srcLines[newLineNo]
          @currentLineNo = newLineNo
        end
      end
      
      def updateCurrentTokenCoords(cLineNo, newPos, nextPos)
        if @currentLineNo < cLineNo
          @currentLineNo = cLineNo
          @currentLine = @srcLines[cLineNo] || ""
        end
        @currentPos = newPos
        @currentPosNext = nextPos
      end
      
      def advanceCurrentTokenCoords(nextPos)
        if nextPos >= @currentLine.length
          updateCurrentTokenCoords(@currentLineNo + 1, 0, 0)
        else
          @currentPos = @currentPosNext = nextPos
        end
      end
      
      def findToken(token)
        cLineNo = @currentLineNo
        cLineText = @currentLine
        cPosNext = @currentPosNext
        while cLineNo < @srcLines.size
          newPos = cLineText.index(token, cPosNext)
          if newPos
            if newPos > cPosNext 
              skipText = cLineText[cPosNext ... newPos].sub(/^\s*(?:\#.*$)?/, '')
              if skipText.size > 0
                $stderr.puts("Looking for #{token} starting at (#{@currentLineNo}, #{@currentPosNext})"\
                             + ", skip '#{skipText}'")
              end
            end
            updateCurrentTokenCoords(cLineNo, newPos, newPos + token.size)
            return [cLineNo, newPos]
          end
          cLineNo += 1
          cPosNext = 0
          cLineText = @srcLines[cLineNo]
        end
        $stderr.puts("Can't find #{token} starting at (#{@currentLineNo}, @{currentPosNext})")
        # Don't bother advancing the token, just position it wherever we are.
        return @currentLineNo, @currentPosNext
      end
      
      def findEmptyString()
        cLineNo = @currentLineNo
        cPosNext = @currentPosNext
        while cLineNo < @srcLines.length
          cLineText = @srcLines[cLineNo]
          cLineLength = cLineText.length
          while cPosNext < cLineLength - 1
            c = cLineText[cPosNext]
            if c == ' ' || c == '\t'
              # do nothing
            elsif c == '#'
              cPosNext = cLineLength
            elsif c == '\'' || c == '"' && cLineText[cPosNext + 1] == c
              updateCurrentTokenCoords(cLineNo, cPosNext, cPosNext + 2)
              return [cLineNo, cPosNext]
            elsif c == '%' && cLineText[cPosNext + 1].downcase == 'q'
              # Match %[Qq], assume it starts an empty string.
              updateCurrentTokenCoords(cLineNo, cPosNext, cPosNext + 4)
              return [cLineNo, cPosNext]
            elsif c == '<' && cLineText[cPosNext + 1] == '<'
              target = cLineText[cPosNext + 2 .. -1]
              if @srcLines[cLineNo + 1] == target
                @currentLineNo = cLineNo + 2
                @currentLine = @srcLines[@currentLineNo]
                @currentPos = 0
                @currentPosNext = 0
              end
              return [cLineNo, cPosNext]
            end
            cPosNext += 1
          end
          cLineNo += 1
          cPosNext = 0
        end
        $stderr.puts("Failed to find an empty string starting at line #{@currentLineNo}, pos#{@currentPosNext}, text [#{@currentLine}]")
        return @currentLineNo, @currentPosNext
      end
      
      def addWrappers(node_list, wrapper1, wrapper2, numNodes=1)
        # Convert [:hash, T]
        # to [:hash, [:braceOpen, "{", P], T, [:braceOpen, "}", P]]
        # wrapper1: [:braceOpen, "{"]
        # wrapper2: [:braceClose, "}"]
        # Find the location of the "{" between the last node processed
        # and the start of the next item (if any), and assign it a value.
        hashLineStart, hashColStart = findToken(wrapper1[1])
        node_list.insert(1, [wrapper1[0], wrapper1[1], [hashLineStart, hashColStart]])
        numNodes.times do |i|
          fix(node_list[2 + i])
        end
        hashLineStart, hashColStart = findToken(wrapper2[1])
        node_list << [wrapper2[0], wrapper2[1], [hashLineStart, hashColStart]]
      end
      
      def handleModifiedTest(node_list, kwd)
        # Change [:if_mod, cond, stmt]
        # to [:if_mod, stmt, cond, coords]
        fix(node_list[1])
        syncKeywords
        if @keywords[0][2] == kwd
          coords = @keywords[0][0]
          updateCurrentCoordinate(@keywords[0][0], kwd.size)
          @keywords.shift
        else
          coords = nil
        end
        fix(node_list[2])
        stmt_node = node_list.pop
        node_list.insert(1, stmt_node)
        if coords
          node_list << coords
        end
      end
      
      def fix(root)
        if root.class != Array
          return root
        end
        indexStart = 0
        if !isCoordinateNodeParent(root) && root[0].class == Symbol
          kwd = root[0]
          if @@kwds.member?(kwd)
            # Look to see if it's the next keyword
            syncKeywords
            if @keywords[0][2] == kwd.to_s
              # Push coordinate keywords down one level
              root[0] = [kwd, @keywords[0][0]]
              updateCurrentCoordinate(@keywords[0][0], kwd.size)
              @keywords.shift
            else
              # We don't know where it is, but it's easier if we push all the
              # keyword nodes down one level as well.
              root[0] = [kwd]
            end
            indexStart = 1
          end
        end
        
        # Things to do:
        # Reverse subtrees of :if_mod and :unless_mod (and add coordinates)
        # Add coordinates and tokens for {}, (), [], and empty strings
        # Remove null nodes
        
        if indexStart == 0
          case root[0]
          when :hash
            addWrappers(root, [:brace_open, "{"], [:brace_close, "}"])
            return
            
          when :brace_block
            addWrappers(root, [:brace_open, "{"], [:brace_close, "}"], 2)
            return
            
          when :array
           addWrappers(root, [:bracket_open, "["], [:bracket_close, "]"])
            return
            
          when :paren, :arg_paren
            addWrappers(root, [:paren_open, "("], [:paren_close, ")"])
            return
          
          when :if_mod
            handleModifiedTest(root, "if")
            return
          
          when :unless_mod
            handleModifiedTest(root, "unless")
            return
          
          when :string_literal
            if root[1].size == 1 and root[1][0] == :string_content
              root[1] << ""
              lineStart, lineColStart = findEmptyString()
              root[1] << [lineStart, lineColStart]
              return
            end
          end
        end
        
        root[indexStart .. -1].each do |node|
          self.fix(node)
          if isCoordinateNodeParent(node)
            if node[0] == :@tstring_content
              # Move the cursor past the terminating part
              coordinates = node[-1]
              delimStart = @currentLine[@currentPosNext ... coordinates[1]].lstrip
              case delimStart
              when '"', "'"
                advanceCurrentTokenCoords(coordinates[1] + node[1].size + 1)
              when /^(%.*)$/
                advanceCurrentTokenCoords(coordinates[1] + node[1].size + 1)
              else
                $stderr.puts("QQQ: Do here docs!~!")
                raise
              end 
            else
              updateCurrentCoordinate(node[-1], node[-2].size)
            end
          end
        end
        # Now delete all nil nodes
        root.delete_if {|node| node.nil? || (node.class == Array && node.size == 0) }
        a = "Stop here!"
        if root[0].class == Array && @@kwds.include?(root[0][0])
          # Are we looking at an 'end'?
          if m = @currentLine[@currentPosNext .. -1].match(/^(\s*)end\b/)
            #consumeToken("end")
            advanceCurrentTokenCoords(@currentPosNext + m[1].size + 3)
            root << [:end, [@currentLineNo, @currentPosNext + m[1].size]]
          end
        end
        return root
      end
    end
  end
end