#!/usr/bin/perl
# Copyright (c) 2000-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

require 5.00561;

###############################################################################
#
# dump.pl -- Generates Graphviz "dot" files from regular expressions
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
# own ids to.
$breakpointid = undef;

# Nodes we shouldn't insert break buttons into.
my %unbreakables = set_of(qw(end));

sub set_of {
    my %h;
    $h{$_} = 1 for @_;
    wantarray ? %h : \%h;
}


my $graphOrDigraph = shift || q{graph};
my $edgethingy = $graphOrDigraph eq q{graph} ? q{--} : q{->};

# This hash maps regex node types to functions
# that generate nodes of that type in the dot file.
my %dot_funmap = ("star" => \&dot_star,
		  "exact" => \&dot_exact,
		  "curlym" => \&dot_curly,
		  "curlyx" => \&dot_curly,
		  "curly" => \&dot_curly,
		  "plus" => \&dot_plus,
		  "digit" => \&dot_digit,
		  "space" => \&dot_space,
		  "eol" => \&dot_eol,
		  "bol" => \&dot_bol,
		  "branch" => \&dot_branch,
		  "reg_any" => \&dot_reg_any,
#		  "breakpoint" => \&dot_breakpoint,
		  "end" => \&dot_end,
		  "alnum" => \&dot_alnum,
		  "anyof" => \&dot_anyof,
		  "open" => \&dot_open,
		  "close" => \&dot_close,
		  "whilem" => \&dot_whilem,
		  "match_succeeds" => \&dot_match_succeeds);

# Which nodes have been drawn so far?
%donenodes = ();

$dot_indent = 0;

my %hh = %$s;

dot_header();
print STDERR Dumper(\%hh);
dot_tree(translate_tree(\%hh, "0"));
dot_edges(\%hh, \%donenodes);
dot_footer();


# Translate a regex hash structure into a more tree-like structure
# that is more easily traversed and analyzed.
sub translate_tree {
    my %tree = %{shift()};
    my $node = shift; # Starting node.
    
    my @treeroots; # Array of top level tree nodes (roots).
    
    while(defined $node) {
		if(ref($tree{$node}) == 'HASH') {
			my %nodeguts = %{$tree{$node}};
			
			# Add the node to the treeroots array only there
			# exists a handler function that could some day
			# "draw" it. We don't want to mess around with nodes we
			# can't handle...
			if(defined $nodeguts{TYPE}) {
				push @treeroots, process_node(\%tree, \%nodeguts, $node);
			}
			
			# If the current node didn't give us a next node to traverse to
			# then we must give up.
			unless($node = $nodeguts{NEXT}) {
				last;
			}
		}
	}
    
    return \@treeroots;
}

sub process_node {
	my %tree = %{shift()};
	my %nodeguts = %{shift()};
	my $nodename = shift();

#	print Dumper($nodename);
#	print Dumper(\%nodeguts);

	$nodeguts{'__this__'} = $nodename;

	if($nodeguts{CHILD}) {
		# Now build another translated tree based on the child node of
		# this node.
		my $treerootsref = translate_tree(\%tree, $nodeguts{CHILD});
		$nodeguts{CHILD} = $treerootsref;
	}
	return \%nodeguts;
}


sub dot_header {
    print <<FOOFOOFOO;
$graphOrDigraph rx {
	rankdir=LR;
FOOFOOFOO
}

sub dot_footer {
    print <<FOOFOOFOO;
}
FOOFOOFOO
}

# Prints stuff with the correct indentation.
# Not really necessary in dot files, unless we start using clusters
# for stuff..
sub dot_print {
	print "\t" x $dot_indent;
	print @_;
}

# Prints stuff without indentation.
sub dot_printn {
	print @_;
}

$depth = 0;


# Draw the edges for a regex tree.
# Pass in a reference to the regex hash and another reference to a hash
# containing the names of the nodes to which edges should be connected.
sub dot_edges {
    my %tree = %{shift()};
    my %donenodes = %{shift()};

    foreach(keys %tree) {
	if(defined $donenodes{$_}) {
	    do_edge(\%tree, \%donenodes,
		    $_, $tree{$_}{NEXT}, q[style=solid]);
	    do_edge(\%tree, \%donenodes,
		    $_, $tree{$_}{CHILD}, q[style=dashed]);
	}
    }
}

# Drop in an edge from a particular node to a particular node.
sub do_edge {
    my %tree = %{shift()};
    my %donenodes = %{shift()};
    my $from = shift;
    my $to = shift;
    my $edgeparams = shift;

    local $dot_indent = $dot_indent + 1;

    dot_comment("Doing edge from $from to $to");

    if(defined $to) {
	# If the "to" node "exists", then drop in a link between the
	# from node and the to node and return.
	if($donenodes{$to}) {
	    dot_print(qq["$from"$edgethingy"$to" [$edgeparams];\n]);
	}
	else {
	    # Otherwise.. Keep traversing the network until a suitable next node is
	    # found..
	    dot_comment("$to wasn't done. Moving on to $tree{$to}{NEXT}...");
	    if(defined $tree{$to}{NEXT}) {
		do_edge(\%tree, \%donenodes, $from, $tree{$to}{NEXT},
		$edgeparams);
	    }
	    else {
		dot_comment("There are no links after node $from");
	    }
	}
    }
}

# Print out the dot for a regex tree.
# The first parameter is a tree generated by translate_tree().
# The second parameter is a reference to the parent of the first node
# in the tree (if there is one).
sub dot_tree {
    my @tree = @{shift()};

    local $dot_indent = $dot_indent + 1;

#	dot_comment(Dumper(\@tree));


    # Loop through the nodes in the tree, calling the appropriate handler
    # for each node.
    foreach(@tree) {
		my $noderef = $_;
		if(ref($noderef) eq 'HASH') {
			my %nodeguts = %$noderef;
			
			# Don't draw a node twice.
			if(!defined $donenodes{$nodeguts{'__this__'}}) {

				dot_comment("$nodeguts{TYPE}: $nodeguts{'__this__'}");
				
				# Switch on the node type and call an appropriate node
				# generator function.
				if($nodeguts{TYPE}) {
					# Call a function to "draw" the node.
					if(my $fun = $dot_funmap{$nodeguts{TYPE}}) {
					    $fun->(\%nodeguts);
					    $donenodes{$nodeguts{'__this__'}}++;
					}
					else {
					    if($nodeguts{CHILD}) {
						dot_recursive(\%nodeguts, {label=>$nodeguts{TYPE}});
					    }
					    else {
						dot_atomic(\%nodeguts, {label=>$nodeguts{TYPE}});
					    }
					    $donenodes{$nodeguts{'__this__'}}++;
					}
				}
			}
		}
		else {
#			dot_comment("Hmm.. found a $renoderef in the tree..");
		}
    }
}

sub dot_breakpoint {
    my %renode = %{shift()};
    
    # Set the (ouch) breakpoint id that is used for the
    # XUL "id" attribute of the node to which this breakpoint
    # refers.
    # The node to which this breakpoint ID refers is the next non-breakpoint
    # node in the tree.
    $breakpointid = $renode{ID};

	dot_atomic(\%renode,
			   {label=>"Breakpoint"});
    
    return $nextnode;
}

sub dot_end {
    my %renode = %{shift()};
    
    # We are guaranteed that the end node has id=0 -- even
    # if there wasn't a breakpoint before it (MJD's dumper
    # always makes the end node id=0.)
    $breakpointid = "0";
    
    # Sometimes, multiple parts of the tree will come to "an end".
    # We only want one of them to actually _draw_ an end picture,
    # so we only draw the end marker at the end of the root level of the
    # tree.
    return dot_atomic(\%renode,
		      {shapefile=>"stop.png",
		       label=>"end"});
}

# A generic atomic dot entry, such as an EXACT, or SPACE.
# The first parameter is the contents of the node.
# The second parameter is a hash that specifies extra key/value pairs
# to be stuffed into the dot node.
# e.g.:
#
#   dot_atomic(\%foo, {shape=>"rectangle", label="barf"});
#
#   ...produces something like:
#
#   15e [ label="barf", shape="rectangle" ];
#   15e->15ee; /* this is the edge connecting this node to its "next" */
#
sub dot_atomic {
    my %renode = %{shift()};
    my %fields = %{shift()};
    
    if(!$unbreakables{$renode{TYPE}}) {
		# Do something special for nodes that can have a breakpoint.
		# I'm not sure what, yet...
    }
	
    # Now fire down any fancy fields that were passed in.
    dot_print("\"$renode{'__this__'}\" [ ");
    foreach(keys %fields) {
		if(ref(\$_) eq 'SCALAR') {
			dot_printn("$_ = \"$fields{$_}\", ");
		}
    }
    dot_printn("];\n");
}

sub dot_image {
    my %renode = %{shift()};
    my $image = shift;

    return dot_atomic(\%renode,
		      {label=>$image});
}

sub dot_alnum {
    return dot_image(shift(), "word.png");
}

sub dot_exact {
    my %renode = %{shift()};
    return dot_atomic(\%renode,
					  {label => $renode{STRING},
				   fontname=>"courier",
				   fontsize=>"18"});
}

sub dot_eol {
    return dot_image(shift(), "eol.png");
}

sub dot_bol {
    return dot_image(shift(), "bol.png");
}

sub dot_digit {
    return dot_atomic(shift(),
		      {label=>"digit"});
}

sub dot_space {
    return dot_image(shift(), "space.png");
}

sub dot_anyof {
	%renode = %{shift()};
    return dot_atomic(\%renode,
		      {label=>("\[" . $renode{CLASS} . "\]")});
}

sub dot_reg_any {
    return dot_atomic(shift(),
		      {label=>"Any"});
}

sub dot_branch {
    return dot_recursive(shift(),
			 {label=>"Branch"});
}

sub dot_star {
    return dot_recursive(shift(),
			 {label=>"*"});
}

sub dot_curly {
    my %renode = %{shift()};
    if($renode{ARGS}[0] == 0 && $renode{ARGS}[1] == 1) {
	return dot_recursive(\%renode, {label=>"?"});
    }
    elsif($renode{ARGS}[0] == 0 && $renode{ARGS}[1] > 32766) {
	return dot_recursive(\%renode, {label=>"*"});
    }
    elsif($renode{ARGS}[0] == 1 && $renode{ARGS}[1] > 32766) {
	return dot_recursive(\%renode, {label=>"+"});
    }
    else {
	return dot_recursive(\%renode,
	   {label=>"curly\\n\{$renode{ARGS}[0], $renode{ARGS}[1]\}"});
    }
}

sub dot_plus {
    return dot_recursive(shift(),
			 {label=>"+"});
}

sub dot_open {
    return dot_atomic(shift(),
			 {label=>"("});
}

sub dot_close {
    return dot_atomic(shift(),
			 {label=>")"});
}

sub dot_whilem {
    return dot_atomic(shift(),
		      {label=>"whilem"});
}

sub dot_match_succeeds {
    return dot_atomic(shift(),
		      {label=>"match_succeeds"});
}

# A helper function for node types that are recursive, such as star,
# plus, and curlym.
sub dot_recursive {
    my %renode = %{shift()};
    my %fields = %{shift()};
    
    # First do this node, atomically.
    dot_atomic(\%renode, \%fields);

    # Then process the child node.
    if($renode{CHILD}) {
		dot_tree($renode{CHILD});
    }
    else {
		dot_comment("odd.. recursive node has no children.\n");
    }
}

sub dot_comment {
    my $comment = shift;
    dot_print qq[/* $comment */\n];
}







