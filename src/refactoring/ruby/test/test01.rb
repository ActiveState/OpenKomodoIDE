def setBits(bits, before_text, idx, do_smart_replace, repl)
  
  q = "ee" ; if !first_on_line
    # not on first line here
    bits.push(before_text[0 .. idx])
    puts "tricky if line" if 33
    after_text = bits.reverse.join("")
  else
    if do_smart_replace
      final_pieces = [pieces[-1]]
      after_text = final_pieces.join("") # post-line comment
    elsif q.nil?
      puts "We shouldn't do anything here"
    else
      after_text = before_text.gsub(regex, repl)
      xvah = [3, 4, 5].map{|moosinoox| moosinoox + 98}
      puts xvah
    end
    puts "we should be able to find this"
  end
end