module Refactoring
  module PathFinder
    
    class PathFinderDone < Exception
    end
    
    class PathFinder
      def find_paths_to_nodes(root, lineNo, colNo)
        @lineNo = lineNo
        @colNo = colNo
        @cStart = nil
        @cEnd = nil
        @cStartLastNode = @cEndLastNode = "didn't work"
        begin
          last_node, path = find_paths_to_nodes_aux(root, [])
          # If we return here then we have either the first node
          # that comes after our target,
          # or the last one that comes before it.
          return [path, path, last_node, last_node]
        rescue PathFinderDone
          # Talk about what we've got
          return [@cStart, @cEnd, @cStartLastNode, @cEndLastNode]
        end
      end
      
      def find_paths_to_nodes_aux(root, indexNodes)
        if root.class != Array
          return nil, nil
        end
        rootSize = root.size
        if rootSize == 1
          return find_paths_to_nodes_aux(root[0], indexNodes + [0])
        end
        lastNode = root[-1]
        if isCoordinateNode(lastNode)
          return [lastNode, indexNodes]
        end
        
        # Linear search first, then look into optimizing
        cStartPath = cStartIndex = cStartLastNode = nil
        root.each_with_index do |child, index|
          lastNode, newNodePath = find_paths_to_nodes_aux(child, indexNodes + [index])
          if lastNode
            if lastNode[0] == 11 && lastNode[1] == 6
              puts "stop here"
            end   
            
            if lastNode[0] > @lineNo || lastNode[0] == @lineNo && lastNode[1] > @colNo
              # So we've moved past the point we're interested in.
              if !cStartPath.nil?
                @cStart = cStartPath
                @cStartLastNode = cStartLastNode
                @cEnd = newNodePath
                #@cEnd = newNodePath + [index]
                #if isCoordinateNodeParent(child)
                #  @cEnd << index
                #end
                if child[0] != :end
                  @cEnd.pop
                end
                @cEndLastNode = lastNode
                raise PathFinderDone.new
              else
                return lastNode, newNodePath
                #return lastNode, isCoordinateNodeParent(child) ? newNodePath + [index] : newNodePath
              end
            end
            # If we matched a coordinate on the keyword, don't bother
            # looking at it anymore.  The spot we want is either further down
            # this tree, or on another branch.
            cStartPath = newNodePath
            cStartIndex = index
            cStartLastNode = lastNode
          end
        end
        if cStartPath.nil?
          return nil, nil
        else
          return cStartLastNode, cStartPath# + [cStartIndex]
        end
      end
      
      def walkTree(tree, path)
        path.each do |node|
          if tree.class != Array
            puts tree.to_s
          elsif tree[0].class != Array
            puts tree[0].to_s
          end
          tree = tree[node]
        end
        return tree
      end
    end
  end
end