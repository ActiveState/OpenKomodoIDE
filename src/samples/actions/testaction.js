var radius = 10;
for (var x = 1; x < 90; x++) {
    radius +=1;
    komodo.window.moveTo(100+radius*Math.sin(3.14159*x/8),
                  100+radius*Math.cos(3.14159*x/8));
}