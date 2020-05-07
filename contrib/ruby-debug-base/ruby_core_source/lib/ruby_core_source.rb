require 'rbconfig'
require 'tempfile'
require 'tmpdir'
require 'yaml'
require File.join(File.dirname(__FILE__), 'contrib', 'uri_ext')
require 'archive/tar/minitar'
require 'zlib'
require 'fileutils'

module Ruby_core_source

def create_makefile_with_core(hdrs, name)

  #
  # First, see if the gem already has the needed headers
  #
  if hdrs.call
    create_makefile(name)
    return true
  end

  ruby_dir = ""
  if RUBY_PATCHLEVEL < 0
    Tempfile.open("preview-revision") { |temp|
      uri = URI.parse("http://cloud.github.com/downloads/mark-moseley/ruby_core_source/preview_revision.yml")
      uri.download(temp)
      revision_map = YAML::load(File.open(temp.path))
      ruby_dir = revision_map[RUBY_REVISION]
      return false if ruby_dir.nil?
    }
  else
    ruby_dir = "ruby-" + RUBY_VERSION.to_s + "-p" + RUBY_PATCHLEVEL.to_s
  end

  #
  # Check if core headers were already downloaded; if so, use them
  #
  dest_dir = RbConfig::CONFIG["rubyhdrdir"] + "/" + ruby_dir
  with_cppflags("-I" + dest_dir) {
    if hdrs.call
      create_makefile(name)
      return true
    end
  }

  #
  # Figure out if we can actually write to the rubyhdrdir
  # If not, set dest_dir to be local to our extracted source
  #
  begin
    FileUtils.mkdir_p(dest_dir)
  rescue Errno::EACCES
    dest_dir = File.join(Dir.getwd, ruby_dir)
    FileUtils.mkdir_p(dest_dir)
  end

  #
  # Download the headers
  #
  version2 = (ruby_dir.match(/ruby-(\d+\.\d+).\d/) || [nil, "1.9"])[1]
  uri_path = "http://ftp.ruby-lang.org/pub/ruby/#{version2}/" + ruby_dir + ".tar.gz"
  Tempfile.open("ruby-src") { |temp|

    temp.binmode
    uri = URI.parse(uri_path)
    uri.download(temp)

    begin
      tgz = Zlib::GzipReader.new(File.open(temp.path, "rb"))
    rescue
      if $!.to_s["not in gzip format"]
        tgz = temp.path
      else
        # uncomment to debug the zlib reader
        #$stderr.puts "Error reading #{temp.path} with Zlib::GzipReader"
        #$stderr.puts "file #{temp.path}:" + `file #{temp.path}`
        #$stderr.puts "Press return to continue (file will be deleted)"
        #$stdin.readline
        raise
      end
    end

    FileUtils.mkdir_p(dest_dir)
    Dir.mktmpdir { |dir|
      inc_dir = dir + "/" + ruby_dir + "/*.inc"
      hdr_dir = dir + "/" + ruby_dir + "/*.h"
      Archive::Tar::Minitar.unpack(tgz, dir)
      FileUtils.cp(Dir.glob([ inc_dir, hdr_dir ]), dest_dir)
    }
  }

  with_cppflags("-I" + dest_dir) {
    if hdrs.call
      create_makefile(name)
      return true
    end
  }
  return false
end
module_function :create_makefile_with_core

end
