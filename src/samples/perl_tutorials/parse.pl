#!/usr/bin/perl -w
use strict;
use IO::Handle;
use Text::CSV_XS;

open my $in,  "< mailexport.txt" or die "Cannot open mailexport.txt: $!";
open my $out, "> mailexport.xml" or die "Cannot write mailexport.xml: $!";

print $out <<EOT;
<?xml version="1.0"?>
<EMAILCOMMENTS>

EOT

# Process file in binary mode (fields may contain \n characters)
my $csv = Text::CSV_XS->new({binary => 1});

# First record contains list of fieldnames
my $fields = $csv->getline($in);

while (1) {
    my $record = $csv->getline($in);

    # getline() returns a ref to an empty array at the end of file
    last unless $record && @$record;

    # Encode "<" characters as "&lt;" and "&" as "&amp;" in all fields
    foreach (@$record) {
	s/&/&amp;/g;
	s/</&lt;/g;
    }

    # Create hash of fields using hash slice
    my %record;
    @record{@$fields} = @$record;

    print $out <<EOT;
    <EMAIL>

	<HEADER>
	    <ORIGADDRESS>$record{"From: (Address)"}</ORIGADDRESS>
	    <DESTADDRESS>$record{"To: (Address)"}</DESTADDRESS>
	    <SUBJECT>$record{"Subject"}</SUBJECT>
	</HEADER>

	<BODY>$record{"Body"}</BODY>

    </EMAIL>

EOT
}
print $out "</EMAILCOMMENTS>\n";
close $out or die "Can't write mailexport.xml: $!";
close $in;
