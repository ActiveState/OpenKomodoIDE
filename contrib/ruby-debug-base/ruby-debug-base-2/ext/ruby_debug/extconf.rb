# autodetect ruby headers
unless ARGV.any? {|arg| arg.include?('--with-ruby-include') }
  require 'rbconfig'
  bindir = RbConfig::CONFIG['bindir']
  if bindir =~ %r{(^.*/\.rbenv/versions)/([^/]+)/bin$}
    ruby_include = "#{$1}/#{$2}/include/ruby-#{RUBY_VERSION.start_with?("1.9") ? "1.9.1" : RUBY_VERSION}/ruby-#{$2}"
    ARGV << "--with-ruby-include=#{ruby_include}"
  elsif bindir =~ %r{(^.*/\.rvm/rubies)/([^/]+)/bin$}
    ruby_include = "#{$1}/#{$2}/include/ruby-#{RUBY_VERSION.start_with?("1.9") ? "1.9.1" : RUBY_VERSION}/#{$2}"
    ruby_include = "#{ENV['rvm_path']}/src/#{$2}" unless File.exist?(ruby_include)
    ARGV << "--with-ruby-include=#{ruby_include}"
  end
end

require "mkmf"
require "debugger/ruby_core_source"
require 'fileutils'

if RUBY_VERSION < "1.9"
  STDERR.print("Ruby version is too old\n")
  exit(1)
end

hdrs = if RUBY_VERSION == '1.9.2'
  lambda {
    have_struct_member("rb_method_entry_t", "body", "method.h")
    have_header("vm_core.h") and have_header("iseq.h") and have_header("insns.inc") and
    have_header("insns_info.inc") and have_header("eval_intern.h")
  }
elsif RUBY_VERSION == '1.9.3'
  lambda {
    iseqs = %w[vm_core.h iseq.h]
    begin
      have_struct_member("rb_method_entry_t", "called_id", "method.h") or
      have_struct_member("rb_control_frame_t", "method_id", "method.h")
    end and
    have_header("vm_core.h") and have_header("iseq.h") and have_header("insns.inc") and
    have_header("insns_info.inc") and have_header("eval_intern.h") or return(false)
    have_type("struct iseq_line_info_entry", iseqs) or
    have_type("struct iseq_insn_info_entry", iseqs) or
    return(false)
    if checking_for(checking_message("if rb_iseq_compile_with_option was added an argument filepath")) do
        try_compile(<<SRC)
#include <ruby.h>
#include "vm_core.h"
extern VALUE rb_iseq_new_main(NODE *node, VALUE filename, VALUE filepath);
SRC
      end
      $defs << '-DRB_ISEQ_COMPILE_5ARGS'
    end
  }
elsif RUBY_VERSION == '2.0.0'
  lambda {
    iseqs = %w[vm_core.h iseq.h]
    begin
      have_struct_member("rb_method_entry_t", "called_id", "method.h") or
          have_struct_member("rb_control_frame_t", "method_id", "method.h")
    end and
        have_header("vm_core.h") and have_header("iseq.h") and have_header("insns.inc") and
        have_header("insns_info.inc") and have_header("eval_intern.h") or return(false)
    have_type("struct iseq_line_info_entry", iseqs) or
        have_type("struct iseq_insn_info_entry", iseqs) or
        return(false)
    if checking_for(checking_message("if rb_iseq_compile_with_option was added an argument filepath")) do
      try_compile(<<SRC)
#include <ruby.h>
#include "vm_core.h"
extern VALUE rb_iseq_new_main(NODE *node, VALUE filename, VALUE filepath);
SRC
    end
      $defs << "-DHAVE_RB_ISEQ_COMPILE_ON_BASE  -DVM_DEBUG_BP_CHECK -DHAVE_RB_CONTROL_FRAME_T_EP -DHAVE_RB_ISEQ_T_LOCATION -DHAVE_RB_ISEQ_T_LINE_INFO_SIZE "
    end
  }
else
  STDERR.puts "Ruby version #{RUBY_VERSION} is not supported."
  exit(1)
end


header_dir = RUBY_VERSION.gsub('.', '')
current_dir = File.dirname(__FILE__)
%w{ruby_debug.h ruby_debug.c breakpoint.c}.each do |file|
  FileUtils.cp("#{current_dir}/#{header_dir}/#{file}", current_dir)
end

dir_config("ruby")
if !Debugger::RubyCoreSource.create_makefile_with_core(hdrs, "ruby_debug")
  STDERR.print("Makefile creation failed\n")
  STDERR.print("*************************************************************\n\n")
  STDERR.print("  NOTE: If your headers were not found, try passing\n")
  STDERR.print("        --with-ruby-include=PATH_TO_HEADERS      \n\n")
  STDERR.print("*************************************************************\n\n")
  exit(1)
end
