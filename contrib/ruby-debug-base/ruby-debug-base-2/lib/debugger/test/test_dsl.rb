module TestDsl
  module Shared
    def fullpath(filename)
      File.join($debugger_test_dir, "examples", "#{filename}.rb")
    end
  end
  include Shared

  def self.included(base)
    base.class_eval do
      extend ClassMethods
      before do
        Debugger.interface = TestInterface.new
        Debugger.handler.display.clear
      end
      after do
        Debugger.handler.display.clear
      end
    end
  end

  # Adds commands to the input queue, so they will be retrieved by Processor later.
  # I.e. it emulates user's input.
  #
  # If a command is a Proc object, it will be executed before retrieving by Processor.
  # May be handy when you need build a command depending on the current context/state.
  #
  # Usage:
  #
  #   enter 'b 12'
  #   enter 'b 12', 'cont'
  #   enter ['b 12', 'cont']
  #   enter 'b 12', ->{"disable #{breakpoint.id}"}, 'cont'
  #
  def enter(*messages)
    messages = messages.first.is_a?(Array) ? messages.first : messages
    interface.input_queue.concat(messages)
  end

  # Runs a debugger with the provided basename for a file. The file should be placed
  # to the test/new/examples dir.
  #
  # You also can specify block, which will be executed when Processor extracts all the
  # commands from the input queue. You can use it e.g. for making asserts for the current
  # test. If you specified the block, and it never was executed, the test will fail.
  #
  # Usage:
  #
  #   debug "ex1" # ex1 should be placed in test/new/examples/ex1.rb
  #
  #   enter 'b 4', 'cont'
  #   debug("ex1") { state.line.must_equal 4 } # It will be executed after running 'cont' and stopping at the breakpoint
  #
  def debug_file(filename, &block)
    is_test_block_called = false
    debug_completed = false
    exception = nil
    Debugger.stubs(:run_init_script)
    if block
      interface.test_block = lambda do
        is_test_block_called = true
        # We need to store exception and reraise it after completing debugging, because
        # Debugger will swallow any exceptions, so e.g. our failed assertions will be ignored
        begin
          block.call
        rescue Exception => e
          exception = e
          raise e
        end
      end
    end
    Debugger.start do
      Debugger.debug_load(fullpath(filename))
      debug_completed = true
    end
    flunk "Debug block was not completed" unless debug_completed
    flunk "test block is provided, but not called" if block && !is_test_block_called
    raise exception if exception
  end

  # Checks the output of the debugger. By default it checks output queue of the current interface,
  # but you can check again any queue by providing it as a second argument.
  #
  # Usage:
  #
  #   enter 'break 4', 'cont'
  #   debug("ex1")
  #   check_output "Breakpoint 1 at #{fullpath('ex1')}:4"
  #
  def check_output(check_method, *args)
    queue = args.last.is_a?(String) || args.last.is_a?(Regexp) ? interface.output_queue : args.pop
    queue_messages = queue.map(&:strip)
    messages = Array(args).map { |msg| msg.is_a?(String) ? msg.strip : msg }
    queue_messages.send(check_method, messages)
  end

  def check_output_includes(*args)
    check_output :must_include_in_order, *args
  end

  def check_output_doesnt_include(*args)
    check_output :wont_include_in_order, *args
  end

  def interface
    Debugger.handler.interface
  end

  def state
    $rdebug_state
  end

  def context
    state.context
  end

  def binding
    context.frame_binding(state.frame_pos)
  end

  def breakpoint
    Debugger.breakpoints.first
  end

  def force_set_const(klass, const, value)
    klass.send(:remove_const, const) if klass.const_defined?(const)
    klass.const_set(const, value)
  end

  def change_line_in_file(file, line, new_line_content)
    old_content = File.read(file)
    new_content = old_content.split("\n").tap { |c| c[line - 1] = new_line_content }.join("\n")
    File.open(file, 'w') { |f| f.write(new_content) }
  end

  def temporary_change_method_value(item, method, value)
    old = item.send(method)
    item.send("#{method}=", value)
    yield
  ensure
    item.send("#{method}=", old)
  end

  def temporary_change_hash_value(item, key, value)
    old_value = item[key]
    begin
      item[key] = value
      yield
    ensure
      item[key] = old_value
    end
  end

  def temporary_set_const(klass, const, value)
    old_value = klass.const_defined?(const) ? klass.const_get(const) : :__undefined__
    begin
      force_set_const(klass, const, value)
      yield
    ensure
      if old_value == :__undefined__
        klass.send(:remove_const, const)
      else
        force_set_const(klass, const, old_value)
      end
    end
  end

  def pi
    puts
    puts "Output Queue:"
    puts interface.output_queue.join("")
    puts
    puts "Error Queue:"
    puts interface.error_queue.join("")
    puts
    puts "Confirm Queue:"
    puts interface.confirm_queue.join("")
    puts
    puts "Print Queue:"
    puts interface.print_queue.join("")
    puts
  end

  module ClassMethods
    include Shared

    def temporary_change_method_value(item, method, value)
      old_value = nil
      before do
        old_value = item.send(method)
        item.send("#{method}=", value)
      end
      after do
        item.send("#{method}=", old_value)
      end
    end

    def temporary_change_hash_value(item, key, value)
      old_value = nil
      before do
        old_value = item[key]
        item[key] = value
      end
      after do
        item[key] = old_value
      end
    end

    def temporary_set_const(klass, const, value)
      old_value = nil
      before do
        old_value = klass.const_defined?(const) ? klass.const_get(const) : :__undefined__
        force_set_const(klass, const, value)
      end
      after do
        if old_value == :__undefined__
          klass.send(:remove_const, const)
        else
          force_set_const(klass, const, old_value)
        end
      end
    end
  end

end
