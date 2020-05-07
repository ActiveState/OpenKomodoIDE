require 'ruby_debug.so'

SCRIPT_LINES__ = {} unless defined? SCRIPT_LINES__
SCRIPT_TIMESTAMPS__ = {} unless defined? SCRIPT_TIMESTAMPS__

module Debugger
  class Context
    def interrupt
      self.stop_next = 1
    end
    
    alias __c_frame_binding frame_binding
    def frame_binding(frame)
      __c_frame_binding(frame) || hbinding(frame)
    end

    private

    def hbinding(frame)
      hash = frame_locals(frame)
      code = hash.keys.map{|k| "#{k} = hash['#{k}']"}.join(';') + ';binding'
      if obj = frame_self(frame)
        obj.instance_eval code
      else
        eval code
      end
    end

    def handler
      Debugger.handler or raise 'No interface loaded'
    end

    def at_breakpoint(breakpoint)
      handler.at_breakpoint(self, breakpoint)
    end

    def at_catchpoint(excpt)
      handler.at_catchpoint(self, excpt)
    end

    def at_tracing(file, line)
      handler.at_tracing(self, file, line)
    end

    def at_line(file, line)
      handler.at_line(self, file, line)
    end
  end
  
  @reload_source_on_change = false
  
  class << self
    # interface modules provide +handler+ object
    attr_accessor :handler
    
    # if <tt>true</tt>, checks the modification time of source files and reloads if it was modified
    attr_accessor :reload_source_on_change
    
    #
    # Interrupts the current thread
    #
    def interrupt
      current_context.interrupt
    end
    
    #
    # Interrupts the last debugged thread
    #
    def interrupt_last
      if context = last_context
        return nil unless context.thread.alive?
        context.interrupt
      end
      context
    end
    
    def source_for(file) # :nodoc:
      finder = lambda do
        if File.exists?(file)
          if SCRIPT_LINES__[file].nil? || SCRIPT_LINES__[file] == true
            SCRIPT_LINES__[file] = File.readlines(file)
          end

          change_time = test(?M, file)
          SCRIPT_TIMESTAMPS__[file] ||= change_time
          if @reload_source_on_change && SCRIPT_TIMESTAMPS__[file] < change_time
            SCRIPT_LINES__[file] = File.readlines(file)
          end

          SCRIPT_LINES__[file]
        end
      end
      
      Dir.chdir(File.dirname($0)){finder.call} || finder.call ||
        (SCRIPT_LINES__[file] == true ? nil : SCRIPT_LINES__[file])
    end
    
    def source_reload
      SCRIPT_LINES__.keys.each do |file|
        next unless File.exists?(file)
        SCRIPT_LINES__[file] = nil
      end
    end
    
    def line_at(file, line) # :nodoc:
      lines = source_for(file)
      if lines
        line = lines[line-1]
        return "\n" unless line
        return "#{line.gsub(/^\s+/, '').chomp}\n"
      end
      return "\n"
    end

    #
    # Activates the post-mortem mode. There are two ways of using it:
    # 
    # == Global post-mortem mode
    # By calling Debugger.post_mortem method without a block, you install
    # at_exit hook that intercepts any unhandled by your script exceptions
    # and enables post-mortem mode.
    #
    # == Local post-mortem mode
    #
    # If you know that a particular block of code raises an exception you can
    # enable post-mortem mode by wrapping this block with Debugger.post_mortem, e.g.
    #
    #   def offender
    #      raise 'error'
    #   end
    #   Debugger.post_mortem do
    #      ...
    #      offender
    #      ...
    #   end
    def post_mortem
      raise "Post-mortem is already activated" if self.post_mortem?
      self.post_mortem = true
      if block_given?
        begin
          yield
        rescue Exception => exp
          handle_post_mortem(exp)
          raise
        ensure
          self.post_mortem = false
        end
      else
        debug_at_exit do
          handle_post_mortem($!) if $! && post_mortem?
        end
      end
    end
    
    def handle_post_mortem(exp)
      return if exp.__debug_context.stack_size == 0
      Debugger.suspend
      orig_tracing = Debugger.tracing, Debugger.current_context.tracing
      Debugger.tracing = Debugger.current_context.tracing = false
      handler.at_line(exp.__debug_context, exp.__debug_file, exp.__debug_line)
    ensure
      Debugger.tracing, Debugger.current_context.tracing = orig_tracing
      Debugger.resume
    end
    private :handle_post_mortem
  end
  
  class DebugThread # :nodoc:
  end
  
  class ThreadsTable # :nodoc:
  end
end

class Exception # :nodoc:
  attr_reader :__debug_file, :__debug_line, :__debug_binding, :__debug_context
end

module Kernel
  #
  # Stops the current thread after a number of _steps_ made.
  #
  def debugger(steps = 1)
    Debugger.start unless Debugger.started?
    Debugger.current_context.stop_next = steps
  end
  
  #
  # Returns a binding of n-th call frame
  #
  def binding_n(n = 0)
    Debugger.current_context.frame_binding[n+1]
  end
end

class Module
  #
  # Wraps the +meth+ method with Debugger.start {...} block.
  #
  def debug_method(meth)
    old_meth = "__debugee_#{meth}"
    old_meth = "#{$1}_set" if old_meth =~ /^(.+)=$/
    alias_method old_meth.to_sym, meth
    class_eval <<-EOD
    def #{meth}(*args, &block)
      Debugger.start do
        debugger 2
        #{old_meth}(*args, &block)
      end
    end
    EOD
  end
  
  #
  # Wraps the +meth+ method with Debugger.post_mortem {...} block.
  #
  def post_mortem_method(meth)
    old_meth = "__postmortem_#{meth}"
    old_meth = "#{$1}_set" if old_meth =~ /^(.+)=$/
    alias_method old_meth.to_sym, meth
    class_eval <<-EOD
    def #{meth}(*args, &block)
      Debugger.start do |dbg|
        dbg.post_mortem do
          #{old_meth}(*args, &block)
        end
      end
    end
    EOD
  end
end
