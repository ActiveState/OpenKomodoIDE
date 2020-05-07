
use strict;
use Test::More;

BEGIN { plan tests => 4 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON -support_by_pp;

BEGIN {
    use lib qw(t);
    use _unicode_handling;
}


SKIP: {
    skip "can't use JSON::XS.", 4, unless( JSON->backend->is_xs );

my $json = new JSON;
my $bool = $json->allow_nonref->decode('true');

# it's normal
isa_ok( $bool, 'JSON::Boolean' );
is( $json->encode([ JSON::true ]), '[true]' );

# make XS non support flag enable!
$bool = $json->allow_singlequote->decode('true');

isa_ok( $bool, 'JSON::Boolean' );
is( $json->encode([ JSON::true ]), '[true]' );

}

__END__
