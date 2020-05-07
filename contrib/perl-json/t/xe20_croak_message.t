#! perl

# https://rt.cpan.org/Public/Bug/Display.html?id=61708

use strict;
use Test::More;

BEGIN { plan tests => 1 };
BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON; # currently it can't pass with -support_by_pp;


SKIP: {
    skip "can't use JSON::XS.", 1, unless( JSON->backend->is_xs );

    my $json = JSON->new;

    eval q{ $json->encode( undef ) };
    like( $@, qr/line 1\./ );
}

