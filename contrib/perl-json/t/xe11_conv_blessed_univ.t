
use strict;
use Test::More;
BEGIN { plan tests => 3 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON -convert_blessed_universally;

SKIP: {
    skip "can't use JSON::XS.", 3, unless( JSON->backend->is_xs );

my $obj  = Test->new( [ 1, 2, {foo => 'bar'} ] );

$obj->[3] = Test2->new( { a => 'b' } );

my $json = JSON->new->allow_blessed->convert_blessed;

is( $json->encode( $obj ), '[1,2,{"foo":"bar"},"hoge"]'  );

$json->convert_blessed(0);

is( $json->encode( $obj ), 'null' );

$json->allow_blessed(0)->convert_blessed(1);

is( $json->encode( $obj ), '[1,2,{"foo":"bar"},"hoge"]'  );

}

package Test;

sub new {
    bless $_[1], $_[0];
}



package Test2;

sub new {
    bless $_[1], $_[0];
}

sub TO_JSON {
    "hoge";
}

