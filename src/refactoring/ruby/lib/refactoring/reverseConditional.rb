# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

require 'ripper'
require 'awesome_print'

module Refactoring
  module ReverseConditional

    class ReverseConditional
      
      def getRoots(tree, path)
        node = tree
        roots = [node]
        path.each do |index|
          node = node[index]
          break unless node
          roots << node
        end
        return roots
      end
      
      def getRootTypes(roots)
        root_types = roots.map{|r|
           r[0].class == Array ? (r[0][0].class == Symbol ? r[0][0] : nil)
                                          : r[0] }
        if [:if, :else].include?(root_types[-1]) && root_types[-2] == root_types[-1]
          # Delete the last node
          roots.delete_at(-1)
          root_types.delete_at(-1)
        end
        return root_types
      end
      
      def getLastRootPosn(root_types)
        return Range.new(0, root_types.size - 1).to_a.reverse.detect{|i|[:if, :elsif, :else, :end].include?(root_types[i]) }
      end
      # This code figures out what we're looking at, and then sets up
      # the transformation
      def reverseConditional(tree, pathBefore, pathAfter, src, targetLine, targetColumn)
        rootsA = [getRoots(tree, pathBefore), getRoots(tree, pathAfter)]
        root_typesA = rootsA.map {|roots| getRootTypes(roots)}
        
        last_root_posnA = root_typesA.map{|root_types| getLastRootPosn(root_types)}
        if last_root_posnA[0].nil?
          # Not in an if-block at the current position
          raise Exception.new "@@@:There is no if/else/elsif, so nothing more to do"
        end
        # Check to see if one of the paths is nil
        if last_root_posnA[0].nil?
          # The first path doesn't go to an if
        end
        
     
        last_root_typesA = [0, 1].map{|index| root_typesA[index][last_root_posnA[index]] }
        if last_root_typesA.include?(:elsif)
          raise Exception.new "@@@:In an elsif block, give up now"
        elsif last_root_typesA.include?(:end)
          if last_root_typesA.all?{|t| t == :end}
            raise Exception.new "@@@:There is no if/else/elsif, so nothing more to do"
          # Which side are we on?
          elsif last_root_typesA[0] == :end
            # Just go with the second branch
            return reverseConditionalWithPath(tree, pathAfter, src,
                                              rootsA[1],
                                              root_typesA[1],
                                              last_root_posnA[1],
                                              last_root_typesA[1])
          elsif last_root_typesA[1] == :end
            raise Exception.new "@@@:There is no if/else/elsif, so nothing more to do"
          end
          return reverseConditionalWithPath(tree, pathAfter, src,
                                            rootsA[0],
                                            root_typesA[0],
                                            last_root_posnA[0],
                                            last_root_typesA[0])
        end
        begin
          return reverseConditionalWithPath(tree, pathBefore, src,
                                            rootsA[0],
                                            root_typesA[0],
                                            last_root_posnA[0],
                                            last_root_typesA[0])
        rescue
          raise if pathBefore == pathAfter
          return reverseConditionalWithPath(tree, pathAfter, src,
                                            rootsA[1],
                                            root_typesA[1],
                                            last_root_posnA[1],
                                            last_root_typesA[1])
        end
      end
      
      def reverseConditionalWithPath(tree, path, src,
                                     roots, root_types, last_root_posn,
                                     last_root_type)
        if last_root_type == :if
          if roots[last_root_posn].size <= 3
            raise Exception.new "@@@:In an if block with no following block"
            return
          end
          following_node = roots[last_root_posn][3]
          following_node_type = following_node[0][0]
          if following_node_type == :elsif
            raise Exception.new "@@@:In an if block followed by an elsif, so abort"
            return
          elsif following_node_type != :else
            raise Exception.new "@@@:Unexpected: if block followed by #{following_node_type}"
            return
          end
          if_part = roots[last_root_posn]
          else_part = following_node
        else
          raise if last_root_type != :else
          if last_root_posn == 0
            raise Exception.new "@@@:Unexpected 'else' at start of list"
            return
          end
          prev_root_type = root_types[last_root_posn - 1]
          if prev_root_type == :elsif
            raise Exception.new "@@@:In an else block preceded by an elsif, so abort"
            return
          elsif prev_root_type != :if
            raise Exception.new "@@@:Unexpected: else block preceded by #{prev_root_type}, so abort"
            return
          end
          if_part = roots[last_root_posn - 1]
          else_part = roots[last_root_posn]
        end
        
        # Look for an if node that starts before the last_node
        # Then find the first coordinate node after the matching else,
        # find the last node, and find the point where the :else node lives
        ####if_start = find_first_coordinate(if_part[1])
        #if_token_coordinate = if_part[0][0]
        if_block_cond_end = find_last_coordinate(if_part[1])
        if_block_body_end = find_last_coordinate(if_part[2])
        final_else_coordinate = else_part[0][1]
        final_else_coordinate << else_part[0][1][1] + 4
        final_else_token = final_else_coordinate
        ####else_start = find_first_coordinate(else_part[1])
        else_block_end = find_last_coordinate(else_part[1])
        # Add one to the srcLines because all coordinates are 1-based
        srcLines = [""] + src.split(/\r?\n/)
        
        # Remember, lines are 1-based, columns 0-based
        # Specifying actions:
        # Actions should be given last part first, so the editor can be dumb
        # about how it deletes and inserts text, and offsets don't need to be updated.
        # Format of actions:
        #
        # { start: [line(1-based), column(0-based)]
        #    insertText: text
        #    deleteText: text
        #    encoding: encodingOfText
        #    bytes: boolean
        # }
        coordinates = { :if => {}, :else => {}, :ifTest => {}}
        ignorableContinuationSize, nextPartSize = parseRestOfLine(srcLines, if_block_cond_end)
        coordinates[:if][:start] = (nextPartSize > 0 ?
                                    [if_block_cond_end[0],
                                      if_block_cond_end[2] + ignorableContinuationSize] :
                                    [if_block_cond_end[0] + 1, 0])
        ignorableContinuationSize, nextPartSize = parseRestOfLine(srcLines, if_block_body_end)
        coordinates[:if][:end] = [if_block_body_end[0], if_block_body_end[2] + ignorableContinuationSize]
        
        ignorableContinuationSize, nextPartSize = parseRestOfLine(srcLines, final_else_token)
        coordinates[:else][:start] = (nextPartSize > 0 ?
                                      [final_else_token[0],
                                        final_else_token[2] + ignorableContinuationSize] :
                                      [final_else_token[0] + 1, 0])
        ignorableContinuationSize, nextPartSize = parseRestOfLine(srcLines, else_block_end)
        coordinates[:else][:end] = [else_block_end[0], else_block_end[2] + ignorableContinuationSize]
        
        newline = "\n"
        coordinates[:else][:text] = textFromCoordinates(srcLines, coordinates[:if], newline)
        coordinates[:if][:text] = textFromCoordinates(srcLines, coordinates[:else], newline)
        
        negateCondition(coordinates[:ifTest], if_part[0], if_part[1], if_block_cond_end, srcLines)
        actions = [
          { deleteText: { start: coordinates[:else][:start],
                          end: coordinates[:else][:end],
                          textCheck: coordinates[:if][:text],}},
          { insertText: { start: coordinates[:else][:start],
                          text: coordinates[:else][:text] }},
          { deleteText: { start: coordinates[:if][:start],
                          end: coordinates[:if][:end],
                          textCheck: coordinates[:else][:text], }},
          { insertText: { start: coordinates[:if][:start],
                          text: coordinates[:if][:text] }},
          ] + coordinates[:ifTest][:actions]
        return actions
      end
      
      def parseInput(src)
        tree = Ripper.sexp(src)
        inserter = Refactoring::InsertPositions::InsertPositions.new
        all_tokens = Ripper.lex(src).find_all { |tok| tok[1] == :on_kw }
        inserter.setup(src.split(/\r?\n/), all_tokens)
        return inserter.fix(tree)
      end
      
      def main(src, currentLine, currentColumn)
        filteredTree = parseInput(src)
        #ap filteredTree
        fp = Refactoring::PathFinder::PathFinder.new
        paths = fp.find_paths_to_nodes(filteredTree, currentLine, currentColumn)
        actions = reverseConditional(filteredTree, paths[0], paths[1],
                                     src, currentLine, currentColumn)
        return actions
      end
    end
  end
end

# Command-line driver of this module at
# .../refactoring\ruby\bin\reverseConditionalLauncher.rb
