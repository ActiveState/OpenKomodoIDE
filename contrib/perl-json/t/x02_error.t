use strict;
use Test::More;
BEGIN { plan tests => 31 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

local $^W;

BEGIN {
    use lib qw(t);
    use _unicode_handling;
}

use utf8;
use JSON;

SKIP: {
    skip "can't use JSON::XS.", 31, unless( JSON->backend->is_xs );

eval { JSON->new->encode ([\-1]) }; ok $@ =~ /cannot encode reference/;
eval { JSON->new->encode ([\undef]) }; ok $@ =~ /cannot encode reference/;
eval { JSON->new->encode ([\2]) }; ok $@ =~ /cannot encode reference/;
eval { JSON->new->encode ([\{}]) }; ok $@ =~ /cannot encode reference/;
eval { JSON->new->encode ([\[]]) }; ok $@ =~ /cannot encode reference/;
eval { JSON->new->encode ([\\1]) }; ok $@ =~ /cannot encode reference/;

eval { JSON->new->allow_nonref (1)->decode ('"\u1234\udc00"') }; ok $@ =~ /missing high /;
eval { JSON->new->allow_nonref->decode ('"\ud800"') }; ok $@ =~ /missing low /;
eval { JSON->new->allow_nonref (1)->decode ('"\ud800\u1234"') }; ok $@ =~ /surrogate pair /;

eval { JSON->new->decode ('null') }; ok $@ =~ /allow_nonref/;
eval { JSON->new->allow_nonref (1)->decode ('+0') }; ok $@ =~ /malformed/;
eval { JSON->new->allow_nonref->decode ('.2') }; ok $@ =~ /malformed/;
eval { JSON->new->allow_nonref (1)->decode ('bare') }; ok $@ =~ /malformed/;
eval { JSON->new->allow_nonref->decode ('naughty') }; ok $@ =~ /null/;
eval { JSON->new->allow_nonref (1)->decode ('01') }; ok $@ =~ /leading zero/;
eval { JSON->new->allow_nonref->decode ('00') }; ok $@ =~ /leading zero/;
eval { JSON->new->allow_nonref (1)->decode ('-0.') }; ok $@ =~ /decimal point/;
eval { JSON->new->allow_nonref->decode ('-0e') }; ok $@ =~ /exp sign/;
eval { JSON->new->allow_nonref (1)->decode ('-e+1') }; ok $@ =~ /initial minus/;
eval { JSON->new->allow_nonref->decode ("\"\n\"") }; ok $@ =~ /invalid character/;
eval { JSON->new->allow_nonref (1)->decode ("\"\x01\"") }; ok $@ =~ /invalid character/;
eval { JSON->new->decode ('[5') }; ok $@ =~ /parsing array/;
eval { JSON->new->decode ('{"5"') }; ok $@ =~ /':' expected/;
eval { JSON->new->decode ('{"5":null') }; ok $@ =~ /parsing object/;

eval { JSON->new->decode (undef) }; ok $@ =~ /malformed/;
eval { JSON->new->decode (\5) }; ok !!$@; # Can't coerce readonly
eval { JSON->new->decode ([]) }; ok $@ =~ /malformed/;
eval { JSON->new->decode (\*STDERR) }; ok $@ =~ /malformed/;
eval { JSON->new->decode (*STDERR) }; ok !!$@; # cannot coerce GLOB

# differences between JSON::XS and JSON::PP

eval { decode_json ("\"\xa0") }; ok $@ =~ /malformed.*character/;
eval { decode_json ("\"\xa0\"") }; ok $@ =~ /malformed.*character/;

#eval { decode_json ("\"\xa0") }; ok $@ =~ /JSON text must be an object or array/;
#eval { decode_json ("\"\xa0\"") }; ok $@ =~ /JSON text must be an object or array/;

}
