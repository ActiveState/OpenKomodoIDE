
use strict;
use Test::More;
BEGIN { plan tests => 6 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON -support_by_pp;

eval q| require Math::BigInt |;


SKIP: {
    skip "can't use JSON::XS.", 6, unless( JSON->backend->is_xs );
    skip "Can't load Math::BigInt.", 6 if ($@);

my $json = new JSON;
print $json->backend, "\n";

$json->allow_nonref->allow_bignum(1);
$json->convert_blessed->allow_blessed;

my $num  = $json->decode(q|100000000000000000000000000000000000000|);

isa_ok($num, 'Math::BigInt');
is($num, '100000000000000000000000000000000000000');
is($json->encode($num), '100000000000000000000000000000000000000');

$num  = $json->decode(q|2.0000000000000000001|);

isa_ok($num, 'Math::BigFloat');
is($num, '2.0000000000000000001');
is($json->encode($num), '2.0000000000000000001');


}
