module Debugger
  class Breakpoint

    def inspect
      values = %w{id pos source expr hit_condition hit_count hit_value enabled?}.map do |field|
        "#{field}: #{send(field)}"
      end.join(", ")
      "#<Debugger::Breakpoint #{values}>"
    end

  end
end
