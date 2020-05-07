#!/usr/bin/perl -w

use strict;

use Test::More;
use strict;

BEGIN { plan tests => 11 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 0; }

use JSON;

my $json = new JSON;


is($json->encode([!1]),   '[""]');
is($json->encode([!!2]), '["1"]');

is($json->encode([ 'a' eq 'b'  ]), '[""]');
is($json->encode([ 'a' eq 'a'  ]), '["1"]');

is($json->encode([ ('a' eq 'b') + 1  ]), '[1]');
is($json->encode([ ('a' eq 'a') + 1  ]), '[2]');

ok(JSON::true eq 'true');
ok(JSON::true eq  '1');
ok(JSON::true == 1);
isa_ok(JSON::true, JSON->backend . '::Boolean');
isa_ok(JSON::true, 'JSON::Boolean');



