module Debugger
  class Context

    def inspect
      values = %w{
        thread thnum stop_reason suspended? tracing ignored? stack_size dead? frame_line frame_file frame_self
      }.map do |field|
        "#{field}: #{send(field)}"
      end.join(", ")
      "#<Debugger::Context #{values}>"
    end

  end
end
