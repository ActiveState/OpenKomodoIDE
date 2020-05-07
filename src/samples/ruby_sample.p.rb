#!/usr/bin/ruby

# Use this sample script to explore some of Komodo's Ruby features.

#---- Incremental search:
#    - Use 'Ctrl'+'I' ('Cmd'+'I' on OS X) to start an incremental search.
#    - Begin typing the characters you want to find. 
#    - As you type, the cursor moves to the first match after the current
#      cursor position. Press 'Esc' to cancel.

#---- Auto-Indent
#     - Note that most Ruby programmers, and programs, use 2-space
#       indentation, so you should probably make sure Komodo is set
#       to 2-spaces while writing Ruby code.
#     - Indentation incremented in definitions, control blocks, and
#       do...end and brace blocks.
#     - Dedenters, like 'end' or 'else' are automatically dedented
#       if a character is typed at the end of that line.

#---- Code Folding:
#    - Click the "+" and "-" symbols in the left margin.
#    - Use View|Fold to collapse or expand all blocks.

#---- Syntax Coloring:
#    - Language elements are colored according to the Fonts and Colors
#      preference.

#---- Abbreviations:
#     - Snippets from the Abbreviations folder in projects and toolboxes
#       can be inserted by typing the snippet name followed by
#       'Ctrl'+'T' ('Cmd'+'T' on OS X). The Samples folder in the
#       Toolbox contains some default abbreviation snippets to get you
#       started.
#    
#     Try this below with the 'class' Ruby snippet. An empty function
#     block is created with "Tabstop" placeholders for the class and
#     function names.

# #if WITH_DEBUGGING
#---- Debugging:
#    - The Ruby debugger partitions variables into different categories,
#      based on whether it's global, local, an instance var, or pre-defined.
# #endif

$global_1 = 12

class FruitSalad
  @@times_called = 0
  def initialize(fruits)
    @@times_called += 1
    @ingredients = {}
    @num_served = 0
    add(fruits)
  end

  def add(fruits)
    fruits.each do | name, count |
      @ingredients[name] = 0 unless @ingredients.has_key?(name)
      @ingredients[name] += count
    end
  end
  
  def accumulate(sum, item)
    sum + item[1]
  end

  def servings()
    # Step into a block
    total_fruits = @ingredients.inject(0) {|sum, item| accumulate(sum, item)}
    total_fruits - @num_served
  end

  def serve(n=1)
    s = servings
    raise "Not enough fruit -- requested #{n}, have #{s}" if n > s
    @num_served += n
  end
end # end class

fs = FruitSalad.new({'apples' => 4, 'bananas' => 3, 'grapes' => 2})
puts "We have #{fs.servings} servings"
fs.serve(4)
puts "We now have #{fs.servings} servings"
fs.serve(fs.servings)
begin
  fs.serve(4)
rescue => msg
  puts "Caught exception: #{msg}"
  fs.add({'cherries' => 5, 'apples' => 2})
  fs.serve(4)
end
puts "Finish with #{fs.servings} servings for leftovers"

# #if WITH_DEBUGGING
#---- Debugging:
#     1. Set a breakpoint by clicking the left margin on line 64
#        ("fs.serve(4)")
#     2. Press 'F5' to invoke the debugger; click "OK" to accept the default.
#     3. Press 'F11' to step into "FruitSalad#serve".
#     4. View variables and output on the Debug tab.
#     5. See the "Debug" menu for additional debug commands.
#     6. Press 'Shift'+'F11' to return from the function
#     7. Notice how you can view the members of "fs"
# #endif

#---- Background Syntax Checking:
#     - Syntax errors are underlined in red.
#     - Syntax warnings are underlined in green.
#     - Configure Ruby preferences to customize errors and warnings.
#     - Position the cursor over the underline to view the error
#       or warning message.

"hello there";


