use strict;
use Test::More;
BEGIN { plan tests => 2 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON;
use Tie::Hash;
use Tie::Array;

SKIP: {
    skip "can't use JSON::XS.", 2, unless( JSON->backend->is_xs );

my $js = JSON->new;

tie my %h, 'Tie::StdHash';
%h = (a => 1);

ok ($js->encode (\%h) eq '{"a":1}');

tie my @a, 'Tie::StdArray';
@a = (1, 2);

ok ($js->encode (\@a) eq '[1,2]');

}
