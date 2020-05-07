#!perl
# Copyright (c) 2003-2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

# See comment at top of rxx_python.py for a description of the protocol

use strict;
use warnings;

use JSON 2.0 qw(from_json to_json);
## no critic (ProhibitStringyEval)

package Evaluator;

sub new {
    my ($class, $requestString) = @_;
    my $requestPacket = JSON::from_json($requestString);
    my $hash = {
        op => $requestPacket->{operation},
        pattern => $requestPacket->{pattern},
        options => $requestPacket->{options},
        subjectText => $requestPacket->{text},
        openDelimiter => $requestPacket->{openDelimiter} || "{",
        closeDelimiter => $requestPacket->{closeDelimiter} || "}",
        requestPacket => $requestPacket,
    };
    my $self = bless $hash, $class;
    return $self;
}

sub init {
    my $self = shift;
    $self->{regex} = $self->_compile();
}

sub _compile {
    my $self = shift;
    my $fullPattern = sprintf('%s%s%s%s',
                       $self->{openDelimiter},
                       $self->{pattern},
                       $self->{closeDelimiter},
                       $self->{options});
    my $stmt = sprintf('$res = qr%s;', $fullPattern);
    my $res;
    eval($stmt);
    if ($@) {
        die $@;
    } elsif (! defined $res) {
        die "Invalid pattern: [$fullPattern] (error unknown)";
    } else {
        return $res;
    }
}

sub _groups_from_match_obj {
    my ($self, $matchStartsA, $matchEndsA, $substitution) = @_;
    my $group = {name => undef,
                 span => [$matchStartsA->[0], $matchEndsA->[0]],
                 value => substr($self->{subjectText},
                                 $matchStartsA->[0],
                                 $matchEndsA->[0] - $matchStartsA->[0]),
                 };
    if (defined $substitution) {
        $group->{replacement} = $substitution;
    }
    my $groups = [$group];
    for my $i (1 .. $#$matchStartsA) {
        if ((not defined $matchStartsA->[$i]) || not defined $matchEndsA->[$i]) {
            $group = {
                name => undef,
                span => [-1, -1],
                value => undef,
            };
        } else {
            $group = {
                name => undef,
                span => [$matchStartsA->[$i], $matchEndsA->[$i]],
                value => substr($self->{subjectText},
                                $matchStartsA->[$i],
                                $matchEndsA->[$i] - $matchStartsA->[$i]),
            };
        }
        if (defined $substitution) {
            $group->{replacement} = "";
        }
        push @$groups, $group;
    }
    return $groups;
}

sub _get_group_info {
    my ($self, $matchStartsA, $matchEndsA, $substitution) = @_;
    my $groups = $self->_groups_from_match_obj($matchStartsA, $matchEndsA, $substitution);
    my @namedGroupsInOrder;
    my @namedGroupNames = keys(%+);
    for my $group (@$groups[1 .. $#$groups]) {
        my $value = $group->{value};
        my $didit = 0;
        for my $groupName (@namedGroupNames) {
            if ($+{$groupName} eq $value) {
                # At some point delete the name from @namedGroupNames
                $group->{name} = $groupName;
                push @namedGroupsInOrder, $groupName;
                $didit = 1;
                last;
            }
        }
        push @namedGroupsInOrder, '' unless $didit;
    }
    return [$groups, \@namedGroupsInOrder];
}

sub do_match {
    my $self = shift;
    if ($self->{subjectText} =~ $self->{regex}) {
        my $res = $self->_get_group_info(\@-, \@+);
        return { 'status' => 'ok',
                     'result' => [$res->[0]],
                 'lastGroupNames' => $res->[1],
                     'lastNumGroups' => 0+@- - 1}
    } else {
        return { 'status' => 'matchFailure' }
    }
}

sub do_matchAll {
    my $self = shift;
    my $groupObjs = [];
    my $start = 0;
    my $lastNamedGroupsInOrder;
    while ($self->{subjectText} =~ /$self->{regex}/g) {
        my $res = $self->_get_group_info(\@-, \@+);
        push @$groupObjs, $res->[0];
        $lastNamedGroupsInOrder ||= $res->[1];
    }
    if (0+ @$groupObjs == 0) {
        return { 'status' => 'matchFailure' }
    };
    my $lastGroup = $groupObjs->[$#$groupObjs];
    my $retObj = { 'status' => 'ok',
            'result' => $groupObjs,
             'lastGroupNames' => $lastNamedGroupsInOrder,
            'lastNumGroups' => $#$lastGroup,
    };
    $retObj->{lastGroupNames} = $lastNamedGroupsInOrder;
    return $retObj;
}

sub do_split {
    my $self = shift;
    return { 'status' => 'ok',
             'result' => [split($self->{regex}, $self->{subjectText})] };
}

sub do_replace {
    my $self = shift;
    my $res = $self->do_match();
    if ($res->{status} ne 'ok') {
        return $res;
    }
    my $replacedText = $self->{subjectText};
    my $replacement = $self->{requestPacket}{replacement};
    my $ptn = $self->{regex};
    # I can't get this to work using the s///e form:
    #$replacedText =~ s/$self->{regex}/$replacement/e;
    my $expn = "\$replacedText =~ s{\$ptn}{$replacement}";
    eval($expn);
    if ($@) {
        return {
            status => 'matchError',
            exception => $@,
        };
    }
    $res->{replacedText} = $replacedText;
    my @substitutions;
    # Now figure out the substitution, using the same technique as in replaceAll
    my ($text, $originalText);
    my $processThisMatch = sub {
        my ($matchedPart) = @_;
        my $matchedPartStart = index($originalText, $matchedPart);
        my $diff = length($text) - length($originalText);
        my $thisSub = substr($text, $matchedPartStart,
                             length($matchedPart) + $diff);
        push @substitutions, $thisSub;
    };
    $originalText = $text = $self->{subjectText};
    eval qq{
        if (\$text =~ s/\$ptn/$replacement/) {
            \&\$processThisMatch(\$\&);
        }
    };
    if ($@) {
        return {
            status => 'matchError',
            exception => $@,
        };
    }
    $res->{substitutions} = \@substitutions;
    return $res;
}

sub do_replaceAll {
    my $self = shift;
    my $res = $self->do_matchAll();
    if ($res->{status} ne 'ok') {
        return $res;
    }
    my $replacedText = $self->{subjectText};
    my $replacement = $self->{requestPacket}{replacement};
    my $expn = "\$replacedText =~ s{\$self->{regex}}{$replacement}g";
    eval($expn);
    $res->{replacedText} = $replacedText;

    # This part's tricky, because Perl doesn't make it easy to
    # get the list of replaced parts.  We have to rerun the
    # sub in a while loop in an eval
    
    my @substitutions = ();
    my ($inputPos, $runningDiff);
    my ($text, $originalText, $beforeText);
    
    my $processThisMatch = sub {
        my ($matchedPart) = @_;
        my $matchedPartStart = $inputPos + index(substr($originalText, $inputPos), $matchedPart);
        $inputPos = $matchedPartStart + length($matchedPart);
        my $diff = length($text) - length($beforeText);
        my $thisSub = substr($text, $matchedPartStart + $runningDiff,
                             length($matchedPart) + $diff);
        push @substitutions, $thisSub;
        $runningDiff += $diff;
        $beforeText = $text;
    };
    $originalText = $beforeText = $text = $self->{subjectText};
    $inputPos = $runningDiff = 0;
    my $ptn = $self->{regex};
    eval qq{
        while (\$text =~ s/\$ptn/$replacement/) {
            \&\$processThisMatch(\$\&);
        }
    };
    if ($@) {
        return {
            status => 'matchError',
            exception => $@,
        };
    }
    $res->{substitutions} = \@substitutions;
    return $res;
}

sub run {
    my $self = shift;
    my $funcName = "do_" . $self->{op};
    my $res = $self->$funcName();
    $res->{operation} = $self->{op};
    $res->{lastGroupNames} = []; #Not available in Perl
    return $res;
}

package main;

sub main {
    my $requestString = shift || <STDIN>;
    local $@;
    my $evaluator;
    eval {
        $evaluator = new Evaluator($requestString);
        $evaluator->init();
    };
    if ($@) {
        if ($@ =~ /^(.*?) in regex; marked by <-- HERE in/) {
            return {
                status => 'matchError',
                exception => $1,
            };
        } elsif ($@ =~ /^(.*?) in regex .*? at .*rxx_perl.pl line/) {
            return {
                status => 'matchError',
                exception => $1,
            };
        } elsif ($@ =~ /^(.*?) at \(eval \d+\) line/) {
            return {
                status => 'matchError',
                exception => $1,
            };
        } else {
            return {
                status => 'matchError',
                exception => $@,
            };
        }
    }
    return $evaluator->run();
}

unless (caller) {
    my $str = "";
    #my $packet = {
    #    text => 'école',
    #    pattern => '(\w)',
    #    operation => 'matchAll',
    #    replacement => '<<[$2]v[$1]>>',
    #    options => '',
    #};
    ##$str = JSON::to_json($packet);
    my $responsePacket = main($str);
    my $jsonResult = JSON::to_json($responsePacket, { ascii => 1 });
    print $jsonResult;
}
