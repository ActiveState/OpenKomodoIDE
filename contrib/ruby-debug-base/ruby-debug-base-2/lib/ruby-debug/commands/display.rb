module Debugger
  module DisplayFunctions # :nodoc:
    def display_expression(exp)
      print pr("display.result", n: @state.display.size, exp: exp, result: debug_silent_eval(exp))
    end
    
    def print_display_expressions
      result = prc("display.result", @state.display) do |item, index|
        is_active, expression = item
        {n: index + 1, exp: expression, result: debug_silent_eval(expression)} if is_active
      end
      print result
    end
  end

  class AddDisplayCommand < Command # :nodoc:
    def regexp
      /^\s*disp(?:lay)?\s+(.+)$/
    end

    def execute
      exp = @match[1]
      @state.display.push [true, exp]
      display_expression(exp)
    end

    class << self
      def help_command
        'display'
      end

      def help(cmd)
        %{
          disp[lay] <expression>\tadd expression into display expression list
        }
      end
    end
  end

  class DisplayCommand < Command # :nodoc:
    def self.always_run 
      Debugger.annotate = 0 unless Debugger.annotate
      if Debugger.annotate > 1 
        0
      else
        2
      end
    end
    
    def regexp
      /^\s*disp(?:lay)?$/
    end

    def execute
      print_display_expressions
    end

    class << self
      def help_command
        'display'
      end

      def help(cmd)
        %{
          disp[lay]\t\tdisplay expression list
        }
      end
    end
  end

  class DeleteDisplayCommand < Command # :nodoc:

    def regexp
      /^\s* undisp(?:lay)? \s* (?:(\S+))?$/x
    end

    def execute
      unless pos = @match[1]
        if confirm(pr("display.confirmations.clear_all"))
          for d in @state.display
            d[0] = false
          end
        end
      else
        pos = get_int(pos, "Undisplay")
        return unless pos
        if @state.display[pos-1]
          @state.display[pos-1][0] = nil
        else
          errmsg pr("display.errors.undefined", expr: pos)
        end
      end
    end

    class << self
      def help_command
        'undisplay'
      end

      def help(cmd)
        %{
          undisp[lay][ nnn]
          Cancel some expressions to be displayed when program stops.
          Arguments are the code numbers of the expressions to stop displaying.
          No argument means cancel all automatic-display expressions.
          "delete display" has the same effect as this command.
          Do "info display" to see current list of code numbers.
        }
      end
    end
  end
end
