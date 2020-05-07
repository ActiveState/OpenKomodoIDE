# Copyright (c) 2000-2013 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# Helpers for working with Ripper parse trees

module Refactoring
  module Tree
    def parseRestOfLine(srcLines, block_end_coordinate)
      target_line = srcLines[block_end_coordinate[0]]
      remaining_target_line = target_line[block_end_coordinate[2] .. -1]
      return /\A(\s*(?:\#.*)?)(.*)\z/.match(remaining_target_line).captures.map(&:size)
    end
    
    def textFromCoordinates(srcLines, coordinates, newline)
      line_start_no = coordinates[:start][0]
      line_end_no = coordinates[:end][0]
      if line_start_no == line_end_no
        return srcLines[line_start_no][coordinates[:start][1] .. coordinates[:end][1]]
      end
      line_start = srcLines[line_start_no][coordinates[:start][1] .. -1]
      line_end = srcLines[line_end_no][0 .. coordinates[:end][1]]
      lines = [line_start] + srcLines[line_start_no + 1 ... line_end_no] + [line_end]
      return lines.join(newline)
    end
  end
end