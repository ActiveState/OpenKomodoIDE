#!/usr/bin/perl
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

require 5.00561;

###############################################################################
#
# dump.pl -- Generates Mozilla XUL files from regular expressions
#            using Mark Jason Dominus' Rx module.
#
# Written by Ken Simpson <KenS@ActiveState.com>
#
#
###############################################################################

use Data::Dumper;
use Rx;

unless ($rx = shift) {
	print "Regex> " if -t;
	$rx = <STDIN>;
	chomp $rx;
}

if($test = shift) {
	$s = Rx::pl_instrument($rx, "");
	my %hh = %$s;
	print "testing\n";
	my @foo = translate_tree(\%hh, "0");
	
	print Dumper(\@foo);
}

$s = Rx::pl_instrument($rx, "");

# Ouch.. The breakpointid is set to the most recent
# breakpoint id so that nodes know what to set their
# own xul ids to.
$breakpointid = undef;

# Nodes we shouldn't insert break buttons into.
my %unbreakables = set_of(qw(end));

sub set_of {
	my %h;
	$h{$_} = 1 for @_;
	wantarray ? %h : \%h;
}

# This hash maps regex node types to functions
# that generate nodes of that type in the xul file.
my %xul_funmap = ("star" => \&xul_star,
				  "exact" => \&xul_exact,
				  "curlym" => \&xul_curlym,
				  "curlyx" => \&xul_curlyx,
				  "curly" => \&xul_curly,
				  "plus" => \&xul_plus,
				  "digit" => \&xul_digit,
				  "space" => \&xul_space,
				  "open" => \&xul_open,
				  "close" => \&xul_close,
				  "eol" => \&xul_eol,
				  "bol" => \&xul_bol,
				  "branch" => \&xul_branch,
				  "reg_any" => \&xul_reg_any,
				  "breakpoint" => \&xul_breakpoint,
				  "end" => \&xul_end,
				  "alnum" => \&xul_alnum,
				  "anyof" => \&xul_anyof);

$xul_indent = 0;

my %hh = %$s;

# print STDERR Dumper(\%hh);

xul_header();
xul_tree(translate_tree(\%hh, "0"));
xul_footer();

sub xul_header {
	print <<FOOFOOFOO;
<?xml version="1.0"?>
<?xml-stylesheet href="less://komodo/skin/global/global.less" type="text/css"?>

<window
		id="regexdebug-window"
		title="RegexDebug"
		xmlns:html="http://www.w3.org/TR/REC-html40"
		xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
		class="color-dialog"
		orient="vertical">

<box orient="horizontal" align="center" valign="center">

FOOFOOFOO

	$xul_indent++;
}

# Translate a regex hash structure into a more tree-like structure
# that is easily traversed to generate XUL elements.
sub translate_tree {
	my %tree = %{shift()};
	my $node = shift; # Starting node.

	my @treeroots; # Array of top level tree nodes (roots).
	
	while(defined $node) {
		if(ref($tree{$node}) == 'HASH') {
			my %nodeguts = %{$tree{$node}};

			push @treeroots, process_node(\%tree, \%nodeguts, $node);
			
			# If the current node didn't give us a next node to traverse to
			# then we must give up.
			unless($node = $nodeguts{NEXT}) {
				last;
			}
		}
	}

	return @treeroots;
}

sub process_node {
	my %tree = %{shift()};
	my %nodeguts = %{shift()};
	my $nodename = shift();

#	print Dumper($nodename);
#	print Dumper(\%nodeguts);

	if($nodeguts{CHILD}) {
		# Now build another translated tree based on the child node of
		# this node.
		my @treeroots = translate_tree(\%tree, $nodeguts{CHILD});
		$nodeguts{CHILD} = \@treeroots;
	}
	return \%nodeguts;
}

sub xul_footer {
	print "</box></window>\n";
}

# Prints stuff with the correct indentation.
sub xul_print {
	print "\t" x $xul_indent;
	print @_;
}

$depth = 0;

# Print out the XUL for a regex tree (or subtree!)
# Pass in a tree generate by translate_tree.
sub xul_tree {
	local $firsttimearound = 1;
	local $breakpointid;

	$depth++;

	# Loop through the nodes in the tree, calling the appropriate handler
	# for each node.
	foreach(@_) {
		if(ref($_) eq 'HASH') {
			my %nodeguts = %$_;
		
			xul_comment("$nodeguts{TYPE}: $node");

			# Switch on the node type and call an appropriate node
			# generator function.
			if($nodeguts{TYPE}) {
				if(my $fun = $xul_funmap{$nodeguts{TYPE}}) {
					$fun->(\%nodeguts);
				}
				else {
					xul_comment("no handler for node type $nodeguts{TYPE}");
				}
			}
		}
		else {
			xul_comment("Hmm.. found a " . ref($_) . " in the tree..");
		}
	}

	$depth--;
}

sub xul_breakpoint {
    my %renode = %{shift()};
	
	# Set the (ouch) breakpoint id that is used for the
	# XUL "id" attribute of the node to which this breakpoint
	# refers.
	# The node to which this breakpoint ID refers is the next non-breakpoint
	# node in the tree.
	$breakpointid = $renode{ID};

	return $nextnode;
}

sub xul_end {
    my %renode = %{shift()};

	# We are guaranteed that the end node has id=0 -- even
	# if there wasn't a breakpoint before it (MJD's dumper
	# always makes the end node id=0.)
	$breakpointid = "0";

	# Sometimes, multiple parts of the tree will come to "an end".
	# We only want one of them to actually _draw_ an end picture,
	# so we only draw the end marker at the end of the root level of the
	# tree.
	if($depth == 1) {
		return xul_atomic(\%renode,
						  qq[<box orient="horizontal">/n<spacer flex="1"/><image src="stop.png"/><spacer flex="1"/></box>]);
	}
}

sub xul_rightarrow {
	if(!$firsttimearound) {
		xul_print qq[<box orient="vertical">\n];
		xul_print qq[<spacer flex="1"/>\n];
		xul_print qq[<image src="rarrow_small.png"/>\n];
		xul_print qq[<spacer flex="1"/>\n];
		xul_print qq[</box>\n];
	}
	else {
		$firsttimearound = 0;
	}
}

# A generic atomic XUL entry, such as EXACT, or SPACE.
# The fourth parameter is a string that spells out exactly what
# type of atomic element it is, i.e. qq[<text value="space"/>].
sub xul_atomic {
	my %renode = %{shift()};
	my $boxlabel = shift;

	xul_rightarrow();

	xul_print qq[<!-- an exact node -->\n];
	xul_print qq[<box orient="vertical" align="center">\n];
	xul_print qq[<spacer flex="1"/>\n];
	xul_print qq[<box align="center" orient="horizontal">$boxlabel</box>\n];

	if($unbreakables{$renode{TYPE}}) {
		xul_print qq[<spacer flex="1"/>\n];
	}
	else {
		# Fire in a breakpoint for only those nodes that should be broken.
		xul_print qq[<checkbox value="Break?" checked="true"
					 oncommand="parent.onToggleBreakpoint('$breakpointid');"/>\n];
	}
	xul_print qq[<box id="$breakpointid" height="5"
				 style="background: transparent">\n];
    xul_print qq[</box>\n];
	xul_print qq[</box>\n];
}

sub xul_alnum {
	return xul_atomic(shift(),
			   qq[<image src="word.png"/>]);
}

sub xul_exact {
	my %renode = %{shift()};
	return xul_atomic(shift(),
			   qq[<text style="font-size: medium; font-weight: bold"
				  value="$renode{STRING}"/>]);
}

sub xul_eol {
	return xul_atomic(shift(),
			   qq[<image src="eol.png"/>]);
}

sub xul_bol {
	return xul_atomic(shift(),
			   qq[<image src="bol.png"/>]);
}

sub xul_digit {
	return xul_atomic(shift(),
			   qq[<text value="digit"/>]);
}

sub xul_space {
	return xul_atomic(shift(),
			   qq[<image src="space.png"/>]);
}

sub xul_anyof {
	return xul_atomic(shift(),
			   qq[<text value="[$renode{CLASS}]"/>]);
}

sub xul_reg_any {
	return xul_atomic(shift(),
			   qq[<text value="Any Character"/>]);
}

sub xul_branch {
	return xul_recursive(shift(),
				  qq[<text value="BRANCH"/>]);
}

sub xul_star {
	return xul_recursive(shift(),
						 qq[\t<image src="larrowd_small.png"/>\n]);
}

sub xul_curly {
	return xul_recursive(shift(),
						 qq[\t<image src="larrowd_small.png"/>\n]);
}

sub xul_curlym {
	return xul_recursive(shift(),
						 qq[\t<image src="larrowd_small.png"/>\n]);
}

sub xul_curlyx {
	return xul_recursive(shift(),
						 qq[\t<image src="larrowd_small.png"/>\n]);
}

sub xul_plus {
	return xul_recursive(shift(),
						 qq[\t<image src="larrow_small.png"/>\n]);
}

sub xul_open {
	my %renode = %{shift()};

#	xul_print qq[<!-- an open node -->\n];
#	xul_print qq[<box id="$breakpointid" style="border: solid 1px" orient="horizontal" align="center">\n];
}

sub xul_close {
	my %renode = %{shift()};

#	xul_print qq[<!-- a close node -->\n];
#	xul_print qq[</box>\n];
}


# A helper function for node types that are recursive, such as star,
# plus, and curlym. Pass in a "box label" as the second parameter. The
# box label will be printed out verbatim. See the xul_star function
# for an example.
sub xul_recursive {
	my %renode = %{shift()};
	my $boxlabel = shift;

	xul_rightarrow();
	xul_print qq[<box id="$breakpointid"
				 style="border: none"
				 orient="vertical"
				 valign="bottom"
				 align="center">\n];
	xul_print "$boxlabel\n";
	xul_print qq[<box orient="horizontal" align="center">\n];

	# Now do the recursive's children.
	# It's sooo kick ass how easy this is.
	if($renode{CHILD}) {
		local $xul_indent = $xul_indent + 1;
		xul_tree(@{$renode{CHILD}});
	}
	else {
		xul_comment("  odd.. recursive node has no children");
	}

	xul_print qq[</box>\n];
	xul_print qq[</box>\n];

	xul_comment("END xul_recursive");
}

sub xul_comment {
	my $comment = shift;
	xul_print qq[<!-- depth: $depth; $comment -->\n];
}



