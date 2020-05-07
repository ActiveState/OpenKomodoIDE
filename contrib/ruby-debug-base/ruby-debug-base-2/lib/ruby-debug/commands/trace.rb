module Debugger
  class TraceCommand < Command # :nodoc:
    def regexp
      /^\s* tr(?:ace)? (?: \s+ (\S+))         # on |off | var(iable)
                       (?: \s+ (\S+))?        # (all | variable-name)?
                       (?: \s+ (\S+))? \s*    # (stop | nostop)? 
       $/ix
    end

    def execute
      if @match[1] =~ /on|off/
        onoff = 'on' == @match[1] 
        if @match[2]
          Debugger.tracing = onoff
          print pr("trace.messages.all_threads", status: onoff ? 'on' : 'off')
        else
          Debugger.current_context.tracing = onoff
          print pr("trace.messages.current_thread", status: onoff ? 'on' : 'off')
        end
      elsif @match[1] =~ /var(?:iable)?/
        varname=@match[2]
        if debug_eval("defined?(#{varname})")
          if @match[3] && @match[3] !~ /(:?no)?stop/
            errmsg pr("trace.errors.wrong_var_subcommand", subcmd: @match[3])
          else
            dbg_cmd = if @match[3] && (@match[3] !~ /nostop/) 
                        'debugger' else '' end
          end
          eval("
           trace_var(:#{varname}) do |val|
              print pr('trace.trace', name: '#{varname}', value: val)
              #{dbg_cmd}
           end")
        else
          errmsg pr("trace.errors.var_is_not_global", name: varname)
        end
      else 
        errmsg pr("trace.errors.wrong_subcommand", subcmd: @match[1])
      end
    end

    class << self
      def help_command
        'trace'
      end

      def help(cmd)
        %{
          tr[ace] (on|off)\tset trace mode of current thread
          tr[ace] (on|off) all\tset trace mode of all threads
          tr[ace] var(iable) VARNAME [stop|nostop]\tset trace variable on VARNAME
        }
      end
    end
  end
end
