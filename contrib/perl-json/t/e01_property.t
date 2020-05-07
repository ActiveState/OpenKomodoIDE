
use Test::More;
use strict;

BEGIN { plan tests => 90 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 0; }

BEGIN {
    use lib qw(t);
    use _unicode_handling;
}

use JSON;

my @simples = 
    qw/utf8 indent canonical space_before space_after allow_nonref shrink allow_blessed
        convert_blessed relaxed
     /;

if ($JSON::can_handle_UTF16_and_utf8) {
    unshift @simples, 'ascii';
    unshift @simples, 'latin1';
}

SKIP: {
    skip "UNICODE handling is disabale.", 14 unless $JSON::can_handle_UTF16_and_utf8;
}

my $json = new JSON;

for my $name (@simples) {
    my $method = 'get_' . $name;
    ok(! $json->$method(), $method . ' default');
    $json->$name();
    ok($json->$method(), $method . ' set true');
    $json->$name(0);
    ok(! $json->$method(), $method . ' set false');
    $json->$name();
    ok($json->$method(), $method . ' set true again');
}


ok($json->get_max_depth == 512, 'get_max_depth default');
$json->max_depth(7);
ok($json->get_max_depth == 7, 'get_max_depth set 7 => 7');
$json->max_depth();
ok($json->get_max_depth != 0, 'get_max_depth no arg');


ok($json->get_max_size == 0, 'get_max_size default');
$json->max_size(7);
ok($json->get_max_size == 7, 'get_max_size set 7 => 7');
$json->max_size();
ok($json->get_max_size == 0, 'get_max_size no arg');


for my $name (@simples) {
    $json->$name();
    ok($json->property($name), $name);
    $json->$name(0);
    ok(! $json->property($name), $name);
    $json->$name();
    ok($json->property($name), $name);
}


