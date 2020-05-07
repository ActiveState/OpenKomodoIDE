use Test::More;

BEGIN { plan tests => 26 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }
use JSON;

SKIP: {
    skip "can't use JSON::XS.", 26, unless( JSON->backend->is_xs );

is(to_json([JSON::true]),  q|[true]|);
is(to_json([JSON::false]), q|[false]|);
is(to_json([JSON::null]),  q|[null]|);

my $jsontext = q|[true,false,null]|;
my $obj      = from_json($jsontext);

isa_ok($obj->[0], 'JSON::Boolean');
isa_ok($obj->[1], 'JSON::Boolean');
ok(!defined $obj->[2], 'null is undef');

ok($obj->[0] == 1);
ok($obj->[0] != 0);
ok($obj->[1] == 0);
ok($obj->[1] != 1);

ok($obj->[0] eq 'true', 'eq true');
ok($obj->[0] ne 'false', 'ne false');
ok($obj->[1] eq 'false', 'eq false');
ok($obj->[1] ne 'true', 'ne true');

ok($obj->[0] eq $obj->[0]);
ok($obj->[0] ne $obj->[1]);

ok(JSON::true  eq 'true');
ok(JSON::true  ne 'false');
ok(JSON::true  ne 'null');
ok(JSON::false eq 'false');
ok(JSON::false ne 'true');
ok(JSON::false ne 'null');
ok(!defined JSON::null);

is(from_json('[true]' )->[0], JSON::true);
is(from_json('[false]')->[0], JSON::false);
is(from_json('[null]' )->[0],  JSON::null);

}
