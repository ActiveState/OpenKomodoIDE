
use Test::More;
use strict;
BEGIN { plan tests => 2 };
BEGIN { $ENV{PERL_JSON_BACKEND} = 0; }
use JSON;
#########################

my $json = JSON->new;

my $js = 'abc';


is(to_json($js, {allow_nonref => 1}), '"abc"');

is(from_json('"abc"', {allow_nonref => 1}), 'abc');

