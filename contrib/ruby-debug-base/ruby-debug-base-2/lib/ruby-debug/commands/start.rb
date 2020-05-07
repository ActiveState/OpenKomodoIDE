module Debugger
  class StartCommand < Command # :nodoc:
    self.allow_in_control = true

    def regexp
      /^\s*(start)\s*$/ix
    end

    def execute
      #print_debug "Starting: running program script"
      Debugger.proceed
    end

    class << self
      def help_command
        'start'
      end

      def help(cmd)
        %{
          run prog script
        }
      end
    end
  end
end
