require "mkmf"

if RUBY_VERSION >= "1.8"
  if RUBY_RELEASE_DATE < "2005-03-22"
    STDERR.print("Ruby version is too old\n")
    exit(1)
  end
else
  STDERR.print("Ruby version is too old\n")
  exit(1)
end

dir_config("ruby")
if have_header("node.h") and have_header("version.h") and 
  have_macro("RUBY_VERSION", "version.h") then
#  have_macro("RUBY_VERSION_MAJOR", "version.h") then

  create_makefile("trace_nums")
else

  STDERR.print("Makefile creation failed\n")
  STDERR.print("try using option --with-ruby-include=<dir with node.h>\n")
  exit(1)
end
