module Debugger

  begin
    require 'methodsig'
    have_methodsig = true
  rescue LoadError
    have_methodsig = false
  end

  # Implements the debugger 'method sig' command.
  class MethodSigCommand < Command
    def regexp
      /^\s*m(?:ethod)?\s+sig(?:nature)?\s+(\S+)\s*$/
    end

    def execute
      obj = debug_eval('method(:%s)' % @match[1])
      if obj.is_a?(Method)
        begin
          print "%s\n", obj.signature.to_s
        rescue
          errmsg("Can't get signature for '#{@match[1]}'\n")
        end
      else
        errmsg("Can't make method out of '#{@match[1]}'\n")
      end
    end

    class << self
      def help_command
        'method'
      end

      def help(cmd)
        %{
          m[ethod] sig[nature] <obj>\tshow the signature of a method
        }
      end
    end
  end if have_methodsig

  # Implements the debugger 'method' command.
  class MethodCommand < Command
    def regexp
      /^\s*m(?:ethod)?\s+((iv)|(i(:?nstance)?)\s+)?/
    end

    def execute
      result = if @match[1] == "iv"
        obj = debug_eval(@match.post_match)
        variables = obj.instance_variables.sort.map { |var_name| [var_name, obj.instance_variable_get(var_name)] }
        prv(variables, 'instance')
      elsif @match[1]
        prc("method.methods", debug_eval(@match.post_match).methods.sort) { |item, _| {name: item} }
      else
        obj = debug_eval(@match.post_match)
        if obj.kind_of?(Module)
          prc("method.methods", obj.instance_methods(false).sort) { |item, _| {name: item} }
        else
          errmsg(pr("variable.errors.not_class_module", object: @match.post_match)) && return
        end
      end
      print result
    end

    class << self
      def help_command
        'method'
      end

      def help(cmd)
        %{
          m[ethod] i[nstance] <obj>\tshow methods of object
          m[ethod] iv <obj>\t\tshow instance variables of object
          m[ethod] <class|module>\t\tshow instance methods of class or module
        }
      end
    end
  end

end
