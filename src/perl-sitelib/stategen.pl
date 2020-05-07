#!/usr/bin/perl
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

require 5.00561;

# Produces a state chart from the debugging of a regex.
# Started July 7, 2000 by Ken Simpson.

use Rx;

prompt_for(\$r, 'Regex');
prompt_for(\$o, 'Options');
prompt_for(\$t, 'Target');

Rx::test_it($r, $o, $t);

sub prompt_for {
  my ($ref, $p) = @_;
  unless (defined($$ref = shift @ARGV)) {
    print $p, "> ";
    $$ref = <STDIN>;
    chomp $$ref;
  }
}
