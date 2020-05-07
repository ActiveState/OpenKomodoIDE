module Debugger
  class RestartCommand < Command # :nodoc:
    self.allow_in_control = true

    def regexp
      / ^\s*
      (?:restart|R)
      (?:\s+ (\S?.*\S))? \s*
      $
      /ix
    end
    
    def execute
      if not defined? Debugger::PROG_SCRIPT
        errmsg pr("restart.errors.undefined")
        return
      end
      prog_script = Debugger::PROG_SCRIPT
      if not defined? Debugger::RDEBUG_SCRIPT
        # FIXME? Should ask for confirmation? 
        print_debug pr("restart.debug.outset")
        rdebug_script = prog_script
      else 
        rdebug_script = Debugger::RDEBUG_SCRIPT
      end
      begin
        Dir.chdir(Debugger::INITIAL_DIR)
      rescue
        print_debug pr("restart.debug.change_initial_dir", dir: Debugger::INITIAL_DIR)
      end
      if not File.exist?(File.expand_path(prog_script))
        errmsg pr("restart.errors.not_exist", prog: prog_script)
        return
      end
      if not File.executable?(prog_script) and rdebug_script == prog_script
        print_debug pr("restart.debug.not_executable", prog: prog_script)
        ruby = begin defined?(Gem) ? Gem.ruby : "ruby" rescue "ruby" end
        rdebug_script = "#{ruby} -I#{$:.join(' -I')} #{prog_script}"
      else
        rdebug_script += ' '
      end
      if @match[1]
        argv = [prog_script] + @match[1].split(/[ \t]+/)
      else
        if not defined? Command.settings[:argv]
          errmsg pr("restart.errors.no_args")
          return
        else
          argv = Command.settings[:argv]
        end
      end
      args = argv.join(' ')

      # An execv would be preferable to the "exec" below.
      cmd = rdebug_script + args
      print pr("restart.success", cmd: cmd)
      exec cmd
    rescue Errno::EOPNOTSUPP
      print pr("restart.errors.not_available")
    end

    class << self
      def help_command
        'restart'
      end

      def help(cmd)
        %{
          restart|R [args] 
          Restart the program. This is a re-exec - all debugger state
          is lost. If command arguments are passed those are used.
        }
      end
    end
  end

  class InterruptCommand < Command # :nodoc:
    self.allow_in_control     = true
    self.allow_in_post_mortem = false
    self.event                = false
    self.need_context         = true
    
    def regexp
      /^\s*i(?:nterrupt)?\s*$/
    end
    
    def execute
      unless Debugger.interrupt_last
        context = Debugger.thread_context(Thread.main)
        context.interrupt
      end
    end
    
    class << self
      def help_command
        'interrupt'
      end
      
      def help(cmd)
        %{
          i[nterrupt]\tinterrupt the program
        }
      end
    end
  end
end
