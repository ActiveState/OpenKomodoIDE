module PrinterHelpers
  def yaml_file_path(filename)
    File.expand_path(
      File.join($debugger_test_dir, "..", "lib", "ruby-debug", "printers", "texts", "#{filename}.yml"),
      __FILE__
    )
  end
end
