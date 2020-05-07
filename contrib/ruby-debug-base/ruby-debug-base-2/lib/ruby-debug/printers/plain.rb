require_relative 'base'
module Printers
  class Plain < Base
    include Columnize

    def print(path, args = {})
      message = translate(locate(path), args)
      message << " (y/n) " if parts(path).include?("confirmations")
      message << "\n"
    end

    def print_collection(path, collection, &block)
      modifier = get_modifier(path)
      lines = array_of_args(collection, &block).map { |args| print(path, args) }
      if modifier == 'c'
        columnize(lines.map { |l| l.gsub(/\n$/, '') }, Debugger.settings[:width])
      else
        lines.join("")
      end
    end

    def print_variables(variables, _kind)
      print_collection("variable.variable", variables) do |(key, value), _|
        {key: key, value: value.nil? ? "nil" : value.to_s}
      end
    end

    private

      def get_modifier(path)
        modifier_regexp = /\|(\w+)$/
        modifier_match = locate(path).match(modifier_regexp)
        modifier_match && modifier_match[1]
      end

      def contents_files
        [File.expand_path(File.join("..", "texts", "plain.yml"), __FILE__)] + super
      end

  end
end
