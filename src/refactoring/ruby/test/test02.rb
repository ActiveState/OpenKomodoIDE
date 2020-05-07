class Monkey
  def tilt
    puts "Yaps!"
  end
  def increment
    @tiltLevel += 1
  end
end

m =  Monkey.new
puts m.tiltLevel
