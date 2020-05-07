my $pi = 3.14159;
my $radius = 10;
for my $x (1..90) {
    $radius += 1;
    $komodo->window->moveTo(200+$radius*sin($pi*$x/12),
                            200+$radius*cos($pi*$x/12))
}
