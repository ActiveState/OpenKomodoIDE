# menagerie.rb
# A Ruby tutorial for demonstrating the Komodo debugger, etc.
# This script manages a virtual menagerie of animals. Animal names and
# descriptions can be added, removed and saved in a .yaml file.

require "yaml"

class Entry
  def initialize(sci_name, descr)
    @sci_name = sci_name
    @descr = descr
    @time_mod = Time.now
  end

  attr_reader :sci_name, :descr, :time_mod

  # Update the time when one of these fields changes
  def sci_name=(sci_name)
    @sci_name = sci_name
    @time_mod = Time.now
  end

  def descr=(descr)
    @descr = descr
    @time_mod = Time.now
  end
  
  def contains?(name)
    name = name.downcase
    return @sci_name.downcase.index(name) || @descr.downcase.index(name)
  end

  def to_sci
    return "scientific name: #{@sci_name}\ndescription: #{@descr}\n"
  end

end

$help =  "Commands are:
  add name::scientific_name::description
  search name
  list
  delete name
  load filename
  save [!][filename] - \"!\" means overwrite existing file
  quit - quit\n"

class Menagerie

  def initialize
    @menagerie = {}
    # Map animal_name =>
    # [scientific_name, description, time_added]  (Entries)
    @fname = nil
  end

  def cmd_add(args)
    name, sci_name, descr = args.split("::")
    return "No name given" unless name
    if !@menagerie.has_key?(name)
      @menagerie[name] = Entry.new(sci_name, descr)
    else
      # Update existing values only if one or both have changed
      e = @menagerie[name]
      e.sci_name = sci_name unless !sci_name || e.sci_name == sci_name
      e.descr = descr       unless !descr || e.descr == descr
    end
    return "Added"
  end

  # Search returns a record. First try it as a hash key, then look if
  # it's in the name, then in one of the fields
  
  def cmd_search(name)
    return "No name given" unless name && name.length > 0 
    if @menagerie.has_key?(name)
      return @menagerie[name].to_sci
    else
      results = []   
      name2 = name.downcase
      @menagerie.each { |key, entry|
        if key.downcase.index(name2) or entry.contains?(name2)
          results << key + ":\n" + @menagerie[key].to_sci
        end
      }
      return results.size > 0 ? results.join("\n") : "#{name}: *not found*\n"
    end
  end

  def cmd_delete(name)
    return "No name given" unless name && name.length > 0
    if @menagerie.has_key?(name)
      @menagerie.delete(name)
    #  return "Deleted"
    else
      return "#{name}: *not found*\n"
    end
  end

  def cmd_list(not_used)
    return YAML::dump(self)
  end

  def cmd_save(fname)
    if fname && fname.strip.length > 0
      if fname[0 .. 0] == "!"   # fname[0] gives ?! = ascii("!") = 33
        fname = fname[1 .. -1]
        overwrite = true
      else
        overwrite = false
      end
    else
      fname = nil
    end
    if fname && !overwrite && FileTest::exists?(fname)
      return "Error: file #{fname} exists.  Use <<save !#{fname}>>"
    end
    if fname
      @fname = fname
  else @fname.nil?
      return "Error: no filename given yet\n"
    end
    begin
      File.open(@fname, "w") {|fd|
        fd.write(YAML::dump(@menagerie))
      }
    rescue => msg
      msg2 = "Error trying to save file #{@fname}: #{msg}\n"
      @fname = nil
      return msg2
    end
    return "Saved in file #{@fname}\n"
  end

  def cmd_load(fname)
    @fname = fname
    begin
      @menagerie = YAML::load(File.open(@fname))
    rescue => msg
      return "Error trying to load file #{@fname}: #{msg}\n"
    end
    return "Read file #{@fname}\n"
  end

  def cmd_help(arg)
    print $help
    return ""
  end
end

obj = Menagerie.new

cmd_re = /^\s*(\w+)\s*(.*)$/
print $help
while true
  print "Enter a command: "
  $stdout.flush

  cmdline = gets().chomp
  if cmd_re.match(cmdline)
    cmd = "cmd_" + $1
    args = $2
    if obj.respond_to?(cmd)
      begin
        status_message = obj.send(cmd, args)
        print status_message
        print "\n" unless [10,13].index(status_message[-1])
      rescue => msg
        print "Error: #{msg}\n"
      end
    elsif cmd == 'cmd_quit'
      break
    else
      print "Error: #{cmd} not a recognized command\n"
    end
  else
    print "Can't deal with input [#{cmdline}] (type 'help' for help)\n"
  end
end
