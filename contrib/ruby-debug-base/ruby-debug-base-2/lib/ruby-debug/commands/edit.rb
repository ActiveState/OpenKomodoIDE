module Debugger
  class Edit < Command # :nodoc:
    self.allow_in_control = true
    def regexp
      /^\s* ed(?:it)? (?:\s+(.*))?$/ix
    end

    def execute
      if not @match[1] or @match[1].strip.empty?
        unless @state.context
          errmsg pr("edit.errors.state")
          return
        end
        file = @state.file
        line_number = @state.line
      elsif @pos_match = /([^:]+)[:]([0-9]+)/.match(@match[1])
        file, line_number = @pos_match.captures
      else
        errmsg pr("edit.errors.file_line", file_line: @match[1])
        return
      end
      editor = ENV['EDITOR'] || 'ex'
      if File.readable?(file)
        system("#{editor} +#{line_number} #{file}")
      else
        errmsg pr("edit.errors.not_readable", file: file)
      end
    end

    class << self
      def help_command
        'edit'
      end

      def help(cmd)
        %{
          Edit specified file.

With no argument, edits file containing most recent line listed.
Editing targets can also be specified in this:
  FILE:LINENUM, to edit at that line in that file,
        }
      end
    end
  end


end # module Debugger
