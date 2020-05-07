module Debugger
  module VarFunctions # :nodoc:
    def var_list(ary, b = get_binding)
      vars = ary.sort.map do |v|
        begin
          s = debug_eval(v.to_s, b).inspect
        rescue
          begin
            s = debug_eval(v.to_s, b).to_s
          rescue
            s = "*Error in evaluation*"
          end
        end
        if s.size > self.class.settings[:width]
          s[self.class.settings[:width]-3 .. -1] = "..."
        end
        [v, s]
      end
      print prv(vars, 'instance')
    end
    def var_class_self
      obj = debug_eval('self')
      var_list(obj.class.class_variables, get_binding)
    end
    def var_global
      var_list(global_variables.reject { |v| [:$=, :$KCODE, :$-K].include?(v) })
    end
  end

  # Implements the debugger 'var class' command.
  class VarClassVarCommand < Command
    def regexp
      /^\s*v(?:ar)?\s+cl(?:ass)?/
    end

    def execute
      unless @state.context
        errmsg "can't get class variables here.\n"
        return 
      end
      var_class_self
    end

    class << self
      def help_command
        'var'
      end

      def help(cmd)
        %{
          v[ar] cl[ass] \t\t\tshow class variables of self
        }
      end
    end
  end

  class VarConstantCommand < Command # :nodoc:
    def regexp
      /^\s*v(?:ar)?\s+co(?:nst(?:ant)?)?\s+/
    end

    def execute
      obj = debug_eval(@match.post_match)
      if obj.kind_of? Module
        constants = debug_eval("#{@match.post_match}.constants").sort.reject { |c| c =~ /SCRIPT/ }.map do |constant|
          value = obj.const_get(constant) rescue "ERROR: #{$!}"
          [constant, value]
        end
        print prv(constants, "constant")
      else
        errmsg pr("variable.errors.not_class_module", object: @match.post_match)
      end
    end

    class << self
      def help_command
        'var'
      end

      def help(cmd)
        %{
          v[ar] co[nst] <object>\t\tshow constants of object
        }
      end
    end
  end

  class VarGlobalCommand < Command # :nodoc:
    def regexp
      /^\s*v(?:ar)?\s+g(?:lobal)?\s*$/
    end

    def execute
      var_global
    end

    class << self
      def help_command
        'var'
      end

      def help(cmd)
        %{
          v[ar] g[lobal]\t\t\tshow global variables
        }
      end
    end
  end

  class VarInstanceCommand < Command # :nodoc:
    def regexp
      # id will be read as first match, name as post match
      /^\s*v(?:ar)?\s+ins(?:tance)?\s*((?:[\\+-]0x)[\dabcdef]+)?/
    end

    def execute
      obj = get_obj(@match)
      var_list(obj.instance_variables, obj.instance_eval{binding()})
    end

    class << self
      def help_command
        'var'
      end

      def help(cmd)
        %{
          v[ar] i[nstance] <object>\tshow instance variables of object. You may pass object id's hex as well.
        }
      end
    end

    private

      def get_obj(match)
        obj = if match[1]
          begin
            ObjectSpace._id2ref(match[1].hex)
          rescue RangeError
            errmsg "Unknown object id : %s" % match[1]
            nil
          end
        else
          debug_eval(match.post_match.empty? ? 'self' : match.post_match)
        end
      end
  end

  # Implements the debugger 'var local' command.
  class VarLocalCommand < Command
    def regexp
      /^\s*v(?:ar)?\s+l(?:ocal)?\s*$/
    end

    def execute
      locals = []
      _self = @state.context.frame_self(@state.frame_pos)
      locals << ['self', _self] unless _self.to_s == "main"
      locals += @state.context.frame_locals(@state.frame_pos).sort.map { |key, value| [key, value] }
      print prv(locals, 'instance')
    end

    class << self
      def help_command
        'var'
      end

      def help(cmd)
        %{
          v[ar] l[ocal]\t\t\tshow local variables
        }
      end
    end
  end
  
    # Implements the debugger 'var inherit' command.
  begin
    require 'classtree'
    have_classtree = true
  rescue LoadError
    have_classtree = false
  end

  class VarInheritCommand < Command
    def regexp
      /^\s*v(?:ar)?\s+ct\s*/
    end

    def execute
      unless @state.context
        errmsg "can't get object inheritance.\n"
        return 
      end
      puts @match.post_match
      obj = debug_eval("#{@match.post_match}.classtree")
      if obj
        print obj
      else
        errmsg "Trouble getting object #{@match.post_match}\n"
      end
    end

    class << self
      def help_command
        'var'
      end

      def help(cmd)
        %{
          v[ar] ct\t\t\tshow class heirarchy of object
        }
      end
    end
  end if have_classtree

end
