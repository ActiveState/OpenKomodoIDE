#!/usr/bin/perl

use strict;
use warnings;
use Benchmark qw( cmpthese timethese );

our $VERSION = '1.00';

my $wanttime = $ARGV[1] || 5;

use JSON qw( -support_by_pp -no_export ); # for JSON::PP::Boolean inheritance
use JSON::PP ();
use JSON::XS ();
use utf8;

my $pp   = JSON::PP->new->utf8;
my $xs   = JSON::XS->new->utf8;

local $/;

my $json = <>;
my $perl = JSON::XS::decode_json $json;
my $result;


printf( "JSON::PP %s\n", JSON::PP->VERSION );
printf( "JSON::XS %s\n", JSON::XS->VERSION );


print "-----------------------------------\n";
print "->encode()\n";
print "-----------------------------------\n";

$result = timethese( -$wanttime,
    {
        'JSON::PP' => sub { $pp->encode( $perl ) },
        'JSON::XS' => sub { $xs->encode( $perl ) },
    },
    'none'
);
cmpthese( $result );

print "-----------------------------------\n";
print "->pretty->canonical->encode()\n";
print "-----------------------------------\n";

$pp->pretty->canonical;
$xs->pretty->canonical;

$result = timethese( -$wanttime,
    {
        'JSON::PP' => sub { $pp->encode( $perl ) },
        'JSON::XS' => sub { $xs->encode( $perl ) },
    },
    'none'
);
cmpthese( $result );

print "-----------------------------------\n";


__END__

=pod

=head1 SYNOPSYS

  bench_encode.pl json-file
  # or
  bench_encode.pl json-file minimum-time

=head1 DESCRIPTION

L<JSON::PP> and L<JSON::XS> encoding benchmark.

=head1 AUTHOR

makamaka

=head1 LISENCE

This library is free software; you can redistribute it and/or modify it
under the same terms as Perl itself.

=cut

