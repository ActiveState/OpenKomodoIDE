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
print "->decode()\n";
print "-----------------------------------\n";

$result = timethese( -$wanttime,
    {
        'JSON::PP' => sub { $pp->decode( $json ) },
        'JSON::XS' => sub { $xs->decode( $json ) },
    },
    'none'
);
cmpthese( $result );

print "-----------------------------------\n";


__END__

=pod

=head1 SYNOPSYS

  bench_decode.pl json-file
  # or
  bench_decode.pl json-file minimum-time

=head1 DESCRIPTION

L<JSON::PP> and L<JSON::XS> decoding benchmark.

=head1 AUTHOR

makamaka

=head1 LISENCE

This library is free software; you can redistribute it and/or modify it
under the same terms as Perl itself.

=cut

