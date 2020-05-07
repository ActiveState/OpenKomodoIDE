module Debugger

  # Implements debugger "break" command.
  class AddBreakpoint < Command
    self.allow_in_control = true

    def regexp
      / ^\s*
        b(?:reak)?
        (?: \s+ #{Position_regexp})? \s*
        (?: \s+ (.*))? \s*
        $
      /x
    end

    def pr(path, *args)
      super("breakpoints.#{path}", *args)
    end

    def execute
      if @match[1]
        line, _, _, expr = @match.captures
      else
        _, file, line, expr = @match.captures
      end
      if expr
        if expr !~ /^\s*if\s+(.+)/
          if file or line
            errmsg pr("errors.if", expr: expr)
          else
            errmsg pr("errors.location", expr: expr)
          end
          return
        else
          expr = $1
        end
      end

      brkpt_filename = nil
      if file.nil?
        unless @state.context
          errmsg pr("errors.state_add")
          return
        end
        brkpt_filename = @state.file
        file = File.basename(@state.file)
        if line.nil?
          # Set breakpoint at current line
          line = @state.line.to_s
        end
      elsif line !~ /^\d+$/
        # See if "line" is a method/function name
        klass = debug_silent_eval(file)
        if klass && klass.kind_of?(Module)
          class_name = klass.name if klass
        else
          errmsg pr("errors.class", file: file)
          throw :debug_error
        end
      else
        # FIXME: This should be done in LineCache.
        file = File.expand_path(file) if file.index(File::SEPARATOR) || \
        File::ALT_SEPARATOR && file.index(File::ALT_SEPARATOR)
        brkpt_filename = file
      end

      if line =~ /^\d+$/
        line = line.to_i
        if LineCache.cache(brkpt_filename, Command.settings[:reload_source_on_change])
          last_line = LineCache.size(brkpt_filename)
          if line > last_line
            errmsg pr("errors.far_line", lines: last_line, file: file)
            return
          end
        else
          errmsg pr("errors.source", file: file)
          return unless confirm(pr("confirmations.set_breakpoint"))
        end

        if file.nil? && !@state.context
          errmsg pr("errors.state")
          return
        end
        b = Debugger.add_breakpoint brkpt_filename, line, expr
        print pr("set_breakpoint_to_line", id: b.id, file: brkpt_filename, line: line)
        unless syntax_valid?(expr)
          errmsg pr("errors.expression", expr: expr)
          b.enabled = false
        end
      else
        method = line.intern.id2name
        b = Debugger.add_breakpoint class_name, method, expr
        print pr("set_breakpoint_to_method", id: b.id, class: class_name, method: method)
      end
    end

    class << self
      def help_command
        'break'
      end

      def help(cmd)
        %{
          b[reak] file:line [if expr]
          b[reak] class(.|#)method [if expr]
          \tset breakpoint to some position, (optionally) if expr == true
        }
      end
    end
  end

  # Implements debugger "delete" command.
  class DeleteBreakpointCommand < Command
    self.allow_in_control = true

    def regexp
      /^\s *del(?:ete)? (?:\s+(.*))?$/ix
    end

    def execute
      brkpts = @match[1]
      unless brkpts
        if confirm(pr("breakpoints.confirmations.delete_all"))
          Debugger.breakpoints.clear
        end
      else
        brkpts.split(/[ \t]+/).each do |pos|
          pos = get_int(pos, "Delete", 1)
          return unless pos
          if Debugger.remove_breakpoint(pos)
            print pr("breakpoints.delete", id: pos)
          else
            errmsg pr("breakpoints.errors.no_breakpoint", id: pos)
          end
        end
      end
    end

    class << self
      def help_command
        'delete'
      end

      def help(cmd)
        %{
          del[ete][ nnn...]\tdelete some or all breakpoints
        }
      end
    end
  end
end
