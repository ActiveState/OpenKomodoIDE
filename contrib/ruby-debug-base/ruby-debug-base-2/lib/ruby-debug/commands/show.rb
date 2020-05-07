module Debugger
  # Mix-in module to showing settings
  module ShowFunctions # :nodoc:
    def show_setting(setting_name)
      case setting_name
      when /^annotate$/
        Debugger.annotate ||= 0
        return pr("show.messages.annotation", level: Debugger.annotate)
      when /^args$/
        if Command.settings[:argv] and Command.settings[:argv].size > 0
          if defined?(Debugger::RDEBUG_SCRIPT)
            # rdebug was called initially. 1st arg is script name.
            args = Command.settings[:argv][1..-1].join(' ')
          else
            # rdebug wasn't called initially. 1st arg is not script name.
            args = Command.settings[:argv].join(' ')
          end
        else
          args = ''
        end
        return pr("show.messages.args", args: args)
      when /^autolist$/
        on_off = Command.settings[:autolist] > 0
        return pr("show.messages.general", setting: "autolist", status: show_onoff(on_off))
      when /^autoeval$/
        on_off = Command.settings[:autoeval]
        return pr("show.messages.general", setting: "autoeval", status: show_onoff(on_off))
      when /^autoreload$/
        on_off = Command.settings[:reload_source_on_change]
        return pr("show.messages.general", setting: "autoreload", status: show_onoff(on_off))
      when /^autoirb$/
        on_off = Command.settings[:autoirb] > 0
        return pr("show.messages.general", setting: "autoirb", status: show_onoff(on_off))
      when /^basename$/
        on_off = Command.settings[:basename]
        return pr("show.messages.general", setting: "basename", status: show_onoff(on_off))
      when /^callstyle$/
        style = Command.settings[:callstyle]
        return pr("show.messages.call_style", style: style)
      when /^commands(:?\s+(\d+))?$/
        if @state.interface.readline_support?
          s = '';
          args = @match[1].split
          if args[1]
            first_line = args[1].to_i - 4
            last_line  = first_line + 10 - 1
            if first_line > Readline::HISTORY.length
              first_line = last_line = Readline::HISTORY.length
            elsif first_line <= 0
              first_line = 1
            end
            if last_line > Readline::HISTORY.length
              last_line = Readline::HISTORY.length
            end
            i = first_line
            commands = Readline::HISTORY.to_a[first_line..last_line]
          else
            if Readline::HISTORY.length > 10
              commands = Readline::HISTORY.to_a[-10..-1]
              i = Readline::HISTORY.length - 10
            else
              commands = Readline::HISTORY.to_a
              i = 1
            end
          end
          commands.each do |cmd|
            s += ("%5d  %s\n" % [i, cmd])
            i += 1
          end
        else
          s = pr("show.errors.no_readline")
        end
        return s
      when /^debuggertesting$/
        on_off = Command.settings[:debuggertesting]
        return pr("show.messages.debuggertesting", status: show_onoff(on_off))
      when /^forcestep$/
        on_off = self.class.settings[:force_stepping]
        return pr("show.messages.general", setting: "force-stepping", status: show_onoff(on_off))
      when /^fullpath$/
        on_off = Command.settings[:full_path]
        return pr("show.messages.fullpath", status: show_onoff(on_off))
      when /^history(:?\s+(filename|save|size))?$/
        args = @match[1].split
        interface = @state.interface
        if args[1] 
          show_save = show_size = show_filename = false
          prefix = false
          if args[1] == "save"
            show_save = true
          elsif args[1] == "size"
            show_size = true
          elsif args[1] == "filename"
            show_filename = true
          end
        else
          show_save = show_size = show_filename = true
          prefix = true
        end
        s = []
        if show_filename
          s << pr("show.messages.history.filename", prefix: ("filename: " if prefix), filename: interface.histfile)
        end
        if show_save
          s << pr("show.messages.history.save", prefix: ("save: " if prefix), status: show_onoff(interface.history_save))
        end
        if show_size
          s << pr("show.messages.history.size", prefix: ("size: " if prefix), size: interface.history_length)
        end
        return s.join("")
      when /^linetrace$/
        on_off = Debugger.tracing
        return pr("show.messages.general", setting: "line tracing", status: show_onoff(on_off))
      when /^linetrace\+$/
        on_off = Command.settings[:tracing_plus]
        return pr("show.messages.tracing_plus.#{on_off ? "on" : "off"}")
      when /^listsize$/
        listlines = Command.settings[:listsize]
        return pr("show.messages.listsize", size: listlines)
      when /^port$/
        return pr("show.messages.port", port: Debugger::PORT)
      when /^trace$/
        on_off = Command.settings[:stack_trace_on_error]
        return pr("show.messages.general", setting: "Displaying stack trace", status: show_onoff(on_off))
      when /^version$/
        return pr("show.messages.version", version: Debugger::VERSION)
      when /^width$/
        return pr("show.messages.general", setting: "width", status: self.class.settings[:width])
      else
        return pr("show.errors.unknown_subcommand", name: setting_name)
      end
    end
  end

  # Implements debugger "show" command.
  class ShowCommand < Command
    
    Subcommands = 
      [
       ['annotate', 2, "Show annotation level",
"0 == normal; 2 == output annotated suitably for use by programs that control 
ruby-debug."],
       ['args', 2, 
        "Show argument list to give program being debugged when it is started",
"Follow this command with any number of args, to be passed to the program."],
       ['autoeval',  4, "Show if unrecognized command are evaluated"],
       ['autolist',  4, "Show if 'list' commands is run on breakpoints"],
       ['autoirb',   4, "Show if IRB is invoked on debugger stops"],
       ['autoreload', 4, "Show if source code is reloaded when changed"],
       ['basename',  1, "Show if basename used in reporting files"],
       ['callstyle', 2, "Show paramater style used showing call frames"],
       ['commands',  2, "Show the history of commands you typed",
"You can supply a command number to start with."],
       ['forcestep', 1, "Show if sure 'next/step' forces move to a new line"],
       ['fullpath',  2, "Show if full file names are displayed in frames"],
       ['history', 2, "Generic command for showing command history parameters",
"show history filename -- Show the filename in which to record the command history
show history save -- Show saving of the history record on exit
show history size -- Show the size of the command history"],
       ['keep-frame-bindings', 1, "Save frame binding on each call"],
       ['linetrace', 3, "Show line execution tracing"],
       ['linetrace+', 10, 
        "Show if consecutive lines should be different are shown in tracing"],
       ['listsize', 3, "Show number of source lines to list by default"],
       ['port', 3, "Show server port"],
       ['post-mortem', 3, "Show whether we go into post-mortem debugging on an uncaught exception"],
       ['trace', 1, 
        "Show if a stack trace is displayed when 'eval' raises exception"],
       ['version', 1, 
        "Show what version of the debugger this is"],
       ['width', 1, 
        "Show the number of characters the debugger thinks are in a line"],
      ].map do |name, min, short_help, long_help| 
      SubcmdStruct.new(name, min, short_help, long_help)
    end unless defined?(Subcommands)
    
    self.allow_in_control = true

    def regexp
      /^show (?: \s+ (.+) )?$/xi
    end

    def execute
      if not @match[1]
        subcommands = subcmd.map { |s| "show #{s.name} -- #{s.short_help}" }.join("\n")
        print pr("show.errors.no_subcommand", subcommands: subcommands)
      else
        args = @match[1].split(/[ \t]+/)
        param = args.shift
        subcmd = find(Subcommands, param)
        if subcmd
          print show_setting(subcmd.name)
        else
          print pr("show.errors.unknown", name: param)
        end
      end
    end

    class << self
      def help_command
        "show"
      end

      def help(args)
        if args[1] 
          s = args[1]
          subcmd = Subcommands.find do |try_subcmd| 
            (s.size >= try_subcmd.min) and
              (try_subcmd.name[0..s.size-1] == s)
          end
          if subcmd
            str = subcmd.short_help + '.'
            str += "\n" + subcmd.long_help if subcmd.long_help
            return str
          else
            return "Invalid 'show' subcommand '#{args[1]}'."
          end
        end
        s = "
          Generic command for showing things about the debugger.

          -- 
          List of show subcommands:
          --  
        "
        for subcmd in Subcommands do
          s += "show #{subcmd.name} -- #{subcmd.short_help}\n"
        end
        return s
      end
    end
  end
end
