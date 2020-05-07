use strict;
use Test::More;
BEGIN { plan tests => 7 };

BEGIN { $ENV{PERL_JSON_BACKEND} = 1; }

use JSON -support_by_pp;

SKIP: {
    skip "can't use JSON::XS.", 7, unless( JSON->backend->is_xs );

my $json = new JSON;


is($json->indent_length(2)->encode([1,{foo => 'bar'}, "1", "/"]), qq|[1,{"foo":"bar"},"1","/"]|);

is($json->indent->encode([1,{foo => 'bar'}, "1", "/"]), qq|[
  1,
  {
    "foo":"bar"
  },
  "1",
  "/"
]
|);


is($json->escape_slash(1)->pretty->indent_length(2)->encode([1,{foo => 'bar'}, "1", "/"]), qq|[
  1,
  {
    "foo" : "bar"
  },
  "1",
  "\\/"
]
|);


is($json->escape_slash(1)->pretty->indent_length(3)->encode([1,{foo => 'bar'}, "1", "/"]), qq|[
   1,
   {
      "foo" : "bar"
   },
   "1",
   "\\/"
]
|);

is($json->escape_slash(1)->pretty->indent_length(15)->encode([1,{foo => 'bar'}, "1", "/"]), qq|[
               1,
               {
                              "foo" : "bar"
               },
               "1",
               "\\/"
]
|);


is($json->indent_length(0)->encode([1,{foo => 'bar'}, "1", "/"]), qq|[
1,
{
"foo" : "bar"
},
"1",
"\\/"
]
|);

is($json->indent(0)->space_before(0)->space_after(0)->escape_slash(0)
        ->encode([1,{foo => 'bar'}, "1", "/"]), qq|[1,{"foo":"bar"},"1","/"]|);


}


