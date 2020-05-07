#! perl

# https://rt.cpan.org/Public/Bug/Display.html?id=52847

use strict;
use Test::More;

BEGIN { plan tests => 2 };
BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON -support_by_pp;

SKIP: {
    skip "can't use JSON::XS.", 2, unless( JSON->backend->is_xs );

    my $json = JSON->new->allow_barekey;

    for (1..2) {
        is_deeply( test($json, q!{foo:"foo"}!   ), {foo=>'foo'} );
        JSON->new->allow_singlequote(0);
    }
}


sub test {
    my ($coder, $str) = @_;
    my $rv;
    return $rv if eval { $rv = $coder->decode($str); 1 };
    chomp( my $e = $@ );
    return "died with \"$e\"";
};



