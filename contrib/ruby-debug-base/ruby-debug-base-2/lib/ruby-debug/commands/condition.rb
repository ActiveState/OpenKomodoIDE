module Debugger

  class ConditionCommand < Command # :nodoc:

    def regexp
      /^\s* cond(?:ition)? (?:\s+(\d+)\s*(.*))?$/ix
    end
    
    def execute
      if not @match[1]
        errmsg pr("condition.errors.syntax")
      else
        breakpoints = Debugger.breakpoints.sort_by{|b| b.id }
        largest = breakpoints.inject(0) do |tally, b|
          tally = b.id if b.id > tally
        end
        if 0 == largest
          print pr("condition.errors.no_breakpoints")
          return
        end
        pos = get_int(@match[1], "Condition", 1, largest)
        return unless pos
        breakpoints.each do |b|
          if b.id == pos 
            b.expr = @match[2].empty? ? nil : @match[2]
            if b.expr
              print pr("conditions.set_condition", id: b.id, expr: b.expr)
            else
              print pr("conditions.unset_condition", id: b.id)
            end
            break
          end
        end

      end
    end
    
    class << self
      def help_command
        'condition'
      end

      def help(cmd)
        %{
          Condition breakpoint-number expression
Specify breakpoint number N to break only if COND is true.
N is an integer and COND is an expression to be evaluated whenever 
breakpoint N is reached. If the empty string is used, the condition is removed.
        }
      end
    end
  end

end # module Debugger
