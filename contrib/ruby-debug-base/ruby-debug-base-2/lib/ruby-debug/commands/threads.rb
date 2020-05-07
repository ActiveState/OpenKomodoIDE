module Debugger
  module ThreadFunctions # :nodoc:
    def display_context(context, should_show_top_frame = true)
      print pr("thread.context", thread_arguments(context, should_show_top_frame))
    end

    def thread_arguments(context, should_show_top_frame = true)
      is_current = context.thread == Thread.current
      status_flag = if context.suspended?
        "$"
      else
        is_current ? '+' : ' '
      end
      debug_flag = context.ignored? ? '!' : ' '
      file_line = if context.stack_size > 0 && should_show_top_frame
        "#{context.frame_file(0)}:#{context.frame_line(0)}"
      end
      {
        status_flag: status_flag,
        debug_flag: debug_flag,
        id: context.thnum,
        thread: context.thread.inspect,
        file_line: file_line,
        status: context.thread.status,
        current: is_current ? "yes" : "no"
      }
    end
    
    def parse_thread_num(subcmd, arg)
      if '' == arg
        errmsg pr("thread.errors.no_number", subcmd: subcmd)
        nil
      else
        thread_num = get_int(arg, "thread #{subcmd}", 1)
        return nil unless thread_num
        get_context(thread_num)
      end
    end

    def parse_thread_num_for_cmd(subcmd, arg)
      c = parse_thread_num(subcmd, arg)
      return nil unless c
      case 
      when nil == c
        errmsg pr("thread.errors.no_thread")
      when @state.context == c
        errmsg pr("thread.errors.current_thread")
      when c.ignored?
        errmsg pr("thread.errors.wrong_action", subcmd: subcmd, arg: arg)
      else # Everything is okay
        return c
      end
      return nil
    end
  end

  class ThreadListCommand < Command # :nodoc:
    self.allow_in_control = true

    def regexp
      /^\s*th(?:read)?\s+l(?:ist)?\s*$/
    end

    def execute
      print prc("thread.context", Debugger.contexts.sort_by(&:thnum)) { |context, _| thread_arguments(context) }
    end

    class << self
      def help_command
        'thread'
      end

      def help(cmd)
        %{
          th[read] l[ist]\t\t\tlist all threads
        }
      end
    end
  end

  class ThreadStopCommand < Command # :nodoc:
    self.allow_in_control     = true
    self.allow_in_post_mortem = false
    self.need_context         = true
    
    def regexp
      /^\s*th(?:read)?\s+stop\s*(\S*)\s*$/
    end

    def execute
      c = parse_thread_num_for_cmd("thread stop", @match[1])
      return unless c 
      c.suspend
      display_context(c)
    end

    class << self
      def help_command
        'thread'
      end

      def help(cmd)
        %{
          th[read] stop <nnn>\t\tstop thread nnn
        }
      end
    end
  end

  class ThreadResumeCommand < Command # :nodoc:
    self.allow_in_post_mortem = false
    self.allow_in_control = true
    self.need_context = true
    
    def regexp
      /^\s*th(?:read)?\s+resume\s*(\S*)\s*$/
    end

    def execute
      c = parse_thread_num_for_cmd("thread resume", @match[1])
      return unless c 
      if !c.thread.stop?
        errmsg pr("thread.errors.already_running")
        return
      end
      c.resume
      display_context(c)
    end

    class << self
      def help_command
        'thread'
      end

      def help(cmd)
        %{
          th[read] resume <nnn>\t\tresume thread nnn
        }
      end
    end
  end

  # Thread switch Must come after "Thread resume" because "switch" is
  # optional

  class ThreadSwitchCommand < Command # :nodoc:
    self.allow_in_control     = true
    self.allow_in_post_mortem = false
    self.need_context         = true
    
    def regexp
      /^\s*th(?:read)?\s*(?:sw(?:itch)?)?\s+(\S+)\s*$/
    end

    def execute
      c = parse_thread_num_for_cmd("thread switch", @match[1])
      return unless c 
      display_context(c)
      c.stop_next = 1
      c.thread.run
      @state.proceed
    end

    class << self
      def help_command
        'thread'
      end

      def help(cmd)
        %{
          th[read] [sw[itch]] <nnn>\tswitch thread context to nnn
        }
      end
    end
  end

  class ThreadCurrentCommand < Command # :nodoc:
    self.need_context = true
    
    def regexp
      /^\s*th(?:read)?\s*(?:cur(?:rent)?)?\s*$/
    end

    def execute
      display_context(@state.context)
    end

    class << self
      def help_command
        'thread'
      end

      def help(cmd)
        %{
          th[read] [cur[rent]]\t\tshow current thread
        }
      end
    end
  end
end
