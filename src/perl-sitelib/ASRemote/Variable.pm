# ASRemote::Variable.pm
#
# Written by Graham TerMarsch <gtermars@home.com> and
# Doug Lankshear <dougl@activestate.com>.
#
# Copyright (c) 1998-2000 Activestate Tool Corporation (www.activestate.com)
# All rights reserved.
#
###############################################################################

package ASRemote::Variable;
use strict;
use vars qw( $VERSION );

###############################################################################
# Get our version number from the CVS revision number.
###############################################################################
$VERSION = do { my @r = q$Revision: 1.1 $ =~ /\d+/g; sprintf '%d.' . '%02d'x$#r, @r };

###############################################################################
# Subroutine:   new ($string)
###############################################################################
# Creates a new instance of a ASRemote::Variable and parses our values out of
# $string.  If able to parse the values properly, this method returns a
# reference to a new ASRemote::Variable object.  If unable to parse the values
# properly, this method returns undef.
###############################################################################
sub new
{
    my $class = shift;
    my ($var) = @_;
    my $self = {};

    if ( ($var =~ /^\s*ASRemote::(\S+) +(.+?) +('.*?[^\\]').? \(\s/sm) ||
         ($var =~ /^\s*ASRemote::(\S+) +(.+?) +(\S+).? \(\s/sm)
       )
    {
        my $leftover = $';
        bless $self, $class;

        # Stuff the name and scalar values we just parsed into ourselves.
        $self->{ 'type' }   = $1;
        $self->{ 'name' }   = $2;
        $self->{ 'scalar' } = $3;
#print STDERR "Type($1), Name($2), Scalar($3)\n";
        # Strip any closing bracket off of the string we've been given.
        $leftover =~ s/\)\s*$//so;

        # Parse out any other data we've got, in case we're a list value.
        my $expand_prefix = join( "|,|", $self->{'type'}, $self->{'name'} );
        $self->{ 'list' } = $self->_parseList( $expand_prefix, $leftover );

        if (defined $self->{'list'})
            { $self->{ 'expandable' } = $expand_prefix; }

        return $self;
    }

    return undef;
}

###############################################################################
# Subroutine:   expand_from ($src, @expansion)
# Parameters:   $src        - Source variable to expand items from
#               @expansion  - List of expansions to perform
###############################################################################
# Expands a set of sub-elements from the $src variable, copying them into our
# own structure.  The list of expansions to be performed comes from @expansion;
# a comma-separated list of the 'name' properties to expand and copy over.
###############################################################################
sub expand_from ($@)
{
    my ($self, $src, @expansion) = @_;
    my ($dst, $exp);
    my $roottype = shift @expansion;
    my $rootname = shift @expansion;

    if (scalar @expansion > 0)
    {
        foreach $exp (@expansion)
        {
            my $dst;

            # Find the element to expand in our own list of sub-elements
            foreach my $key (@{$self->{'list'}})
            {
                if ($key->{'name'} eq $exp)
                    { $dst = $key; }
            }

            # Find the element to expand from in the source variable
            my $srcelem;
            foreach my $key (@{$src->{'list'}})
            {
                if ($key->{'name'} eq $exp)
                    { $srcelem = $key; }
            }

            # Clone the sub-element over.
            foreach my $elem (@{$srcelem->{'list'}})
            {
                push( @{$dst->{'list'}}, $elem->clone() );
            }
        }
    }
    else
    {
        $self->{'list'} = [];
        foreach my $elem (@{$src->{'list'}})
        {
            push( @{$self->{'list'}}, $elem->clone() );
        }
    }
}

###############################################################################
# Subroutine:   clone ()
###############################################################################
# Clones a copy of the ASRemote::Variable object EXCEPT FOR IT'S LIST CONTEXT.
# Returns a new ASRemote::Variable object to the caller.
###############################################################################
sub clone ()
{
    my $self = shift;
    my $dst;
    foreach my $key (keys %{$self})
    {
        if (ref $self->{$key})
            { $dst->{$key} = undef; }
        else
            { $dst->{$key} = $self->{$key}; }
    }
    bless $dst, ref $self;
    return $dst;
}

###############################################################################
# Subroutine:   as_string
###############################################################################
# Returns a string value containing the information which this variable
# contains.  This string value can then be used for outputting of the value to
# the user (if you choose).
###############################################################################
sub as_string
{
    my ($self, $indent) = @_;
    my $rtnval;

    $rtnval  = ' ' x $indent .
               $self->{ 'name' } .
               ' -> ' .
               $self->{ 'scalar' };

    if (defined $self->{'expandable'})
        { $rtnval .= ' (' . $self->{'expandable'} . ')'; }

    $rtnval .= "\n";

    foreach my $kid (@{$self->{ 'list' }})
        { $rtnval .= $kid->as_string( $indent + 3 ); }

    return $rtnval;
}

###############################################################################
# Subroutine:   _parseList ($expand_prefix, $value)
###############################################################################
# Parses out any list values we find in $value and stuffs them into our own
# 'list' property.
#
# Being that we're not processing things recursively, we're going to cache a
# list of the previous items which we've run across.  This cache will be
# implemented as a hash, with the key being an integer value stating the level
# of indentation and nesting depth at which the item was found.
###############################################################################
sub _parseList ($$)
{
    my ($self, $prefix, $value) = @_;
    my $root = {};                  # Root item in the cache
    my %cache;                      # Cache of previously seen items
    my $level;                      # Starting indentation level

    ###########################################################################
    # Exit early if there's nothing to parse.
    ###########################################################################
    return undef if ($value =~ /^\s*$/o);

    ###########################################################################
    # Figure out our current indentation depth and put our root element at the
    # top of the cache of previously seen items.
    ###########################################################################
    $level = (($value =~ /^(\s*)/o) ? length($1) : 0);
    $cache{ -1 } = $root;

    ###########################################################################
    # So long as we've still got something left to parse, keep parsing.
    ###########################################################################
    while (length($value))
    {
        #######################################################################
        # Get the current indentation level for this item.
        #######################################################################
# UNFINISHED -> Assumes that the indentation level is ALWAYS 4
        my $item_level = (($value =~ /^(\s*)/o) ? length($1) : 0);
        $item_level = int($item_level / 3);

        #######################################################################
        # See if we can parse out some sort of list/hash/scalar item.
        #######################################################################
        my ($name, $scalar, $leftover);
            # Check for hash element
        if ( ($value =~ /^\s*('.*?[^\\]'|\d+)\s+=>\s+/o) ||     # Hash element
             ($value =~ /^\s*([^'\n\r]+)\s+=>\s+/o) ||          # Hash element
             ($value =~ /^\s*(\d+)\s+(?!=>)(?=\S+)/o)           # List element
           )
        {
            $name = $1;
            ($scalar, $leftover) = $self->_parseScalarValue( $' );
            $value = $leftover;
        }
        elsif ($value =~ /^\s*->/o)                             # Glob
        {
            $name = '';
            ($scalar, $leftover) = $self->_parseScalarValue( $' );
            $value = $leftover;
        }
        elsif ( ($value =~ /^\s*('.*?[^\\]')/so) ||             # Scalar element
                ($value =~ /^\s*(.+?)$/mo)
              )
        {
            $scalar = $1;
            $value = $';
        }
        else
        {
            warn "Can't parse out variable information: $value";
            return undef;
        }

        #######################################################################
        # Stuff the value we just parsed into a new item and link it into our
        # cache of previously seen elements.
        #######################################################################
        if ($scalar !~ /^empty /o)                  # Ignore 'empty list/hash'
        {
            my $item = {};
            $item->{ 'name' }   = $name;
            $item->{ 'scalar' } = $scalar;
            $cache{ $item_level } = $item;

            ###################################################################
            # Get ahold of our parent element, and create it's 'expandable'
            # value.
            ###################################################################
            my $parent = $cache{ $item_level - 1 };
            my @parent_names;
            foreach my $tmp_level (0 .. ($item_level - 1))
                { push( @parent_names, $cache{$tmp_level}->{'name'} ); }
            $parent->{ 'expandable' } = join( "|,|", $prefix, @parent_names );

            ###################################################################
            # Bless this new object and add it to the list of children for our
            # parent object.
            ###################################################################
            bless $item, ref($self);
            push( @{$parent->{ 'list' }}, $item );
        }

        #######################################################################
        # Strip any leading carriage returns out of whatever is left over so we
        # don't end up processing blank lines.
        #######################################################################
        $value =~ s/^[\n\r]*//g;
    }

    ###########################################################################
    # If we managed to find some list values, return them.  Otherwise, return
    # undef.
    ###########################################################################
    if ( (defined $root->{'list'}) &&
         (defined $root->{'list'}[0]->{'name'})
       )
    {
        return $root->{ 'list' };
    }

    return undef;
}

###############################################################################
# Subroutine:   _parseScalarValue ($value)
###############################################################################
# Attempts to parse some sort of scalar out of $value.  This method returns a
# two element list; the scalar value found, and the remainder of $value after
# removing the scalar value.
###############################################################################
sub _parseScalarValue ($)
{
    my ($self, $value) = @_;
    my ($scalar, $leftover);

    if ( ($value =~ /^\s*('.*?[^\\]')/so) ||
         ($value =~ /^\s*(.+)/o)
       )
    {
        $scalar = $1;
        $leftover = $';
    }
    else
    {
        warn "Unable to parse a scalar value out of: $value";
    }

    return ($scalar, $leftover);
}

1;
__END__;

###############################################################################
# Pod documentation.
###############################################################################

=head1 NAME

ASRemote::Variable - Watch/proximity variable structure for ASRemote

=head1 SYNOPSIS

 use ASRemote::Variable;
 ...
 my $var = new ASRemote::Variable( $string );

=head1 DESCRIPTION

The C<ASRemote::Variable> module encapsulates all of the functionality required for
parsing watch and proximity variables that are received back from the remote
debugger.  C<ASRemote::Variable> will parse the entire string sent by by the remote
debugger and stuff all of the values into it's own structure.  This structure
can then be traversed to get information as to what the original variable
looked like.

=head1 STRUCTURE

C<ASRemote::Variable> is primarily a hash reference, and all of it's element should
be accessed directly whenever possible (sorry).  As such, it's structure is
unlikely to change except to add more properties whenever they are needed.  The
following properties are available in C<ASRemote::Variable>:

=over 4

=item name

The name of the variable (e.g. C<$foobar>).  In the case of child variables
(e.g. array elements), the name of the variable will be the offset or hash key
for that individual element (e.g. C<'key'>), B<not> the full name of the
variable (e.g. C<$foobar{'key'}>).

=item expandable

A piece of Perl code which can be passed to C<ASRemote::Jacket> to tell it to
expand or contract expansion of this variable.  In the case of scalar values
(which are not expandable) or empty hash/list value, this value will be
C<undef>.

=item scalar

The value of the variable when taken in a scalar context.

=item list

A list of any child variables that this variable may have.  Each of the
elements of this list are also blessed into the C<ASRemote::Variable> package,
although they are B<not> created through the call to 'C<new>' (we build them
directly).  Note that in the case of scalar values or unexpanded lists/hashes,
this value will be C<undef>.

=back

=head1 METHODS

=over 4

=item new ($string)

Creates a new C<ASRemote::Variable> object, parsing the values we're supposed to
contain from C<$string>.  If able to parse the value properly, this method will
return a reference to a new C<ASRemote::Variable> object.  If unable to parse the
value properly, this method returns C<undef>.

The format of the string that we are to be parsing is as follows:

 ASRemote::<type> <variable_name> <scalar_value>
 (
    <list_value>
 )

Examples:

 ASRemote::Watch $DB::single 0
 (
 )

 ASRemote::Proximity @foolist 3
 (
 0  'abc'
 1  'def'
 2  'ghi'
 )

 ASRemote::Watch %foohash 2/8
 (
 'key'  => 'value'
 'newlist'  => ARRAY(0x123456)
    0   'abc'
    1   'def'
 'newkey'   => 'newvalue'
 )

=item as_string

Returns a string value containing a text representation of the
C<ASRemote::Variable> object.  This method can be used to get the information
contained within the object in a format suitable for output to the user.

=back

=head1 KNOWN BUGS / LIMITATIONS

Currently, C<ASRemote::Variable> assumes that everything that comes back from the
remote debugger has an indentation of B<4> characters for any sub-element or
child variable.

=head1 AUTHOR

Graham TerMarsch <grahamt@activestate.com>

Doug Lankshear <dougl@activestate.com>

Dick Hardt <dickh@activestate.com>

=cut
