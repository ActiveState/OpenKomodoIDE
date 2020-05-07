use strict;
use Test::More;
BEGIN { plan tests => 3 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON -support_by_pp;

SKIP: {
    skip "can't use JSON::XS.", 3, unless( JSON->backend->is_xs );

my $json = new JSON;


is($json->escape_slash(0)->allow_nonref->encode("/"), '"/"');
is($json->escape_slash(1)->allow_nonref->encode("/"), '"\/"');
is($json->escape_slash(0)->allow_nonref->encode("/"), '"/"');


}
__END__

