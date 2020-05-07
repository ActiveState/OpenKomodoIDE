from math import sin, cos, pi
from komodo import window
radius = 10
for x in range(1, 90):
    radius += 1
    window.moveTo(200+radius*sin(pi*x/8),
                  200+radius*cos(pi*x/8))
