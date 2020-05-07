# ASRemote::Jacket.pm
#
# Written by Graham TerMarsch <gtermars@home.com> and
# Doug Lankshear <dougl@activestate.com>.
#
# Copyright (c) 1998-2000 Activestate Tool Corporation (www.activestate.com)
# All rights reserved.
#
###############################################################################

package ASRemote::Jacket;
use IO::Select;
use overload;

use strict;
use IO::Socket;
use Net::FTP;
use ASRemote::Variable;
use Data::Dumper;

use vars qw( $VERSION $revision );

###############################################################################
# Allow for tracing of everything that gets done in the Jacket; if this
# variable is set to a value then tracing information is sent to it.
###############################################################################
use vars qw( $TraceFile $SessionTraceFile );

#$TraceFile="c:/tmp/jacket-trace.log";
#$SessionTraceFile="c:/tmp/jacket-session-trace.log";

###############################################################################
# Get our revision number from the CVS version number, and set our own VERSION
# number as we see fit; they're likely to not coincide directly with each
# other.
###############################################################################
$revision = do { my @r = q$Revision: 1.2 $ =~ /\d+/g; sprintf '%d.'.'%02d'x$#r, @r };
$VERSION='1.01';

###############################################################################
# Possible error conditions.
###############################################################################
use constant ERR_OK        =>  0;
use constant ERR_BADSOCK   =>  1;
use constant ERR_BADCONN   =>  2;
use constant ERR_PROXSIZE  =>  3;
use constant ERR_INVARGS   =>  4;
use constant ERR_CLOSECONN =>  5;
use constant ERR_CLOSESOCK =>  6;
use constant ERR_SENDCMD   =>  7;
use constant ERR_FAILEDCMD =>  8;
use constant ERR_LOSTCONN  =>  9;
use constant ERR_FTPCONN   => 10;
use constant ERR_FTPLOGIN  => 11;
use constant ERR_FTPXFER   => 12;
use constant ERR_FTPQUIT   => 13;
use constant ERR_GETSCRIPT => 14;
use constant ERR_OPENFILE  => 15;
use constant ERR_BADEXPAND => 16;

###############################################################################
# Errors which we should be choking on when we're processing the output from
# the debug script on the remote host.  For each command we can send there is
# some sort of error msg that it could kick back at us (and these are included
# below).  Note that not all commands in the debug script issue errors when
# they choke; they fail gracefully and don't tell us anything.
###############################################################################
my (@process_errors) = (
                        "Line \\d+ not breakable",
                        "Subroutine .*? not found.",
                        "Can't break at that line",
                        "Can't locate ",
                        "Cannot print stack trace",
                        "Use \`q' to quit",
                        "No file matching \`.*?' is loaded",
                        "No eval block matching \`.*?\' is loaded",
                       );

###############################################################################
# Subroutine:   trace ($indent, $msg)
# Parameters:   $indent     - Amount to modify indent by after outputting msg
#               $msg        - Message to output as trace info
###############################################################################
# Outputs a trace message to a user-defined trace log file.  If '$TraceFile' is
# undefined (default) then no tracing is recorded.
###############################################################################
my $trace_indent=0;
sub trace ($$)
{
    my ($indent, $msg) = @_;
    return if (!defined $TraceFile);
    my $indent_str = '...' x $trace_indent;
    open( TRACEOUT, ">>$TraceFile" );
    print TRACEOUT $indent_str . $msg . "\n";
    close( TRACEOUT );
    $trace_indent += $indent;
}

###############################################################################
# Subroutine:   session_trace ($msg)
# Parameters:   $msg        - Message to output as session trace info
###############################################################################
# Outputs a trace on the session with the remote debugger.  If
# '$SessionTraceFile' is undefined (default) then no tracing is recorded.
###############################################################################
sub session_trace ($)
{
    my ($msg) = @_;
    return if (!defined $SessionTraceFile);
    open( SESSOUT, ">>$SessionTraceFile" );
    print SESSOUT $msg;
    close( SESSOUT );
}

###############################################################################
# Subroutine:   new (%args)
# Parameters:   %args   - Hash of instantiation parameters (see below)
###############################################################################
# Constructs a new ASRemote::Jacket module based on the provided parameters,
# and returns a reference to the newly created Jacket to the caller.  The
# following arguments are supported:
#   -perlsock           Use PerlSock for connection to remote debugger if this
#                       is a non-zero value (e.g. -perlsock => 1).
#   -port               Specifies port number to listen on internally for
#                       connection to remote debugger (e.g. -port => 2000).
# If neither argument is given, it is assumed that we are to do an internal
# listen on the default port (2000).
###############################################################################
sub new
{
    my ($class, %args) = @_;
    trace( 1, "Jacket::new()" );

    ###########################################################################
    # Create a new Jacket object and bless it into our package-space.
    ###########################################################################
    my ($self) = {};
    bless $self, $class;

    ###########################################################################
    # Figure out how to connect to remote debugger based on our instantiation
    # arguments.
    ###########################################################################
    if (defined $args{'-perlsock'})
    {
        $self->{'_perlsock'} = 1;
        trace( 0, 'Using Perlsock' );
    }
    elsif (defined $args{'-port'})
    {
        $self->{'_port'} = $args{'-port'};
        trace( 0, 'Using port ' . $args{'-port'} );
    }
    else
    {
        $self->{'_port'} = 9010;  # Specific Komodo command listener port
        trace( 0, 'Using default port' );
    }

    ###########################################################################
    # All done, return a reference to the newly created object to the caller.
    ###########################################################################
    $self->{'debuggerInitialized'} = 0;
    trace( -1, "done Jacket::new(); $self" );
    return $self;
}

###############################################################################
# Subroutine:   Connect ()
###############################################################################
# Connects the Jacket to the remote debugger.  This method takes into account
# whether or not we're supposed to be using an internal socket connection or
# whether we're to use PerlSock instead.
#
# Once we're connected to the remote debugger, the remote debugger is
# initialized.
###############################################################################
sub Connect ()
{
    my ($self) = @_;
    trace( 1, 'Jacket::Connect()' );
    my $rc = 0;
    ###########################################################################
    # If we're doing an internal socket connection, call off to listen on the
    # socket...
    ###########################################################################
    if (defined $self->{'_port'})
    {
        trace( 0, 'doing listen' );
        $rc = $self->_Listen();
        if ($rc)
        {
            trace( -1, "listen failed, done Jacket::Connect(); $rc" );
            return $rc;
        }
        trace( 0, 'listen successful' );
    }
    ###########################################################################
    # OR, if we're using PerlSock, just set things up based on STDIN/STDOUT.
    ###########################################################################
    elsif (defined $self->{'_perlsock'})
    {
        trace( 0, 'using PerlSock; mapping STDIN/OUT' );
        $self->{'IN'}  = \*STDIN;
        $self->{'OUT'} = \*STDOUT;
    }
    ###########################################################################
    # Otherwise, we don't know what to do; choke HARD (we should never end up
    # here though).
    ###########################################################################
    else
    {
        trace( 0, 'Unable to determine how to connect; aborting debugger.' );
        die "Unable to determine how to connect to remote debugger.\n";
    }

    ###########################################################################
    # All set up with a connection to the remote debugger...initialize it.
    ###########################################################################
    #my $rc = $self->_InitDebugger();
    trace( -1, "done Jacket::Connect(); $rc" );
    return $rc;
}

###############################################################################
# Subroutine:   _Listen ()
###############################################################################
# INTERNAL METHOD.  Listens on a given port for a connection from a remote
# server and then sets up the socket connection.  When finished we should have
# a socket connection all set up and aliased onto 'IN' and 'OUT' for the rest
# of the Jacket to use.
###############################################################################
sub _Listen ()
{
    my ($self) = shift;
    my $rc = 0;
    trace( 1, 'Jacket::_Listen()' );

    ###########################################################################
    # Create the socket to listen on, and throw an error if we were unable to
    # create one.
    # various reuse args to cover different versions of IO::Socket::INET
    ###########################################################################
    $self->{'_sock'} = new IO::Socket::INET( #Timeout   => '30',
                                             Listen    => 1,
                                             ReuseAddr => 1,
                                             # ReusePort => 1,
                                             # LocalAddr => 'localhost',
                                             LocalPort => $self->{'_port'},
                                             Proto     => 'tcp',
                                           );
    if (!$self->{'_sock'})
    {
        $rc = $self->_Error( ERR_BADSOCK, 'port' => $self->{'_port'} );
        trace( -1, "Unable to create socket, done Jacket::_Listen(); $rc" );
	return $rc;
    }

    ###########################################################################
    # Listen for a connection from a remote script, and throw an error if we
    # don't get one.
    ###########################################################################
    $self->{'_conn'} = $self->{'_sock'}->accept();
    # $self->{'conn'} as a new socket, close the accept socket
    if (!$self->{'_sock'}->close())
    {
        $rc = $self->_Error( ERR_CLOSESOCK );
        trace( -1, "Unable to close socket; done Jacket::Quit(); $rc" );
        # somethings foul, attempt to close connection
        if (defined $self->{'_conn'}) {
            $self->{'_conn'}->close();
        }
        return $rc;
    }
    undef $self->{'_sock'};
    if (!$self->{'_conn'})
    {
        $rc = $self->_Error( ERR_BADCONN, 'port' => $self->{'_port'} );
        trace( -1, "Unable to connect, done Jacket::_Listen(); $rc" );
	return $rc;
    }
    $self->{'peerhost'} = $self->{'_conn'}->peerhost();
    $self->{'peerport'} = $self->{'_conn'}->peerport();
    ###########################################################################
    # Set some socket options.
    ###########################################################################
    $self->{'_conn'}->autoflush();

    ###########################################################################
    # Alias the connection across both the IN and OUT file handles that we're
    # going to use throughout the rest of the Jacket.
    ###########################################################################
    $self->{'IN'}  = $self->{'_conn'};
    $self->{'OUT'} = $self->{'_conn'};
    $rc = ERR_OK();
    trace( -1, "done Jacket::Listen(); $rc" );
    return $rc;
}

###############################################################################
# Action extensions which we wish to have the remote debugger execute before
# each prompt.  Note that these are loaded _after_ the extensions so we can
# safely use anything which they provide.
###############################################################################
my %actions = (
    ###########################################################################
    # Command to output watch variables just before the prompt is output.
    ###########################################################################
    'show_watch' =>
        q{  sub DB::ASRemote::show_watch
            {
                local $DB::ASRemote::var;
                foreach $DB::ASRemote::var (keys %DB::ASRemote::watched)
                {
                    local $DB::onetimeDump;
                    local $DB::evalarg;
                    $DB::evalarg = $DB::ASRemote::var;
                    my ($val) = &DB::eval;
                    $val = (defined $val ? "'$val'" : 'undef');

                    $DB::evalarg = "scalar $DB::ASRemote::var";
                    my ($scalar) = &DB::eval;
                    $scalar = (defined $scalar ? "'$scalar'" : 'undef');

                    print ${DB::OUT} "ASRemote::Watch $DB::ASRemote::var ";
                    print ${DB::OUT} " $scalar (\n";
                    print ${DB::OUT} $val;
                    print ${DB::OUT} "\n)\n";
                }
            }
        },
	###GST### This block has temporarily been replaced with the one above, to see
	###GST### if it provides a cleaner/easier/more useful implementation of the
	###GST### same stuff.  Should be easier to maintain, but "the jury is still
	###GST### out" as to whether its going to require updates to the Variable.pm
	###GST### module, and whether the values come back match up exactly to those
	###GST### from the commented out code below.
	###GST###
	###GST### NOTE, that this change was initially made in an effort to see if the
	###GST### code below was in fact outputting vars.  It was, but there were other
	###GST### bugs in perl5db.pl, debuglisten.pl and this module that were causing
	###GST### problems in identifying this.
	#        q{  sub DB::ASRemote::show_watch
	#            {
	#                my $var;
	#                foreach $var (keys %DB::ASRemote::watched)
	#                {
	#                    print ${DB::OUT} "ASRemote::Watch $var ";
	#                    if (!defined eval $var)
	#                        { print ${DB::OUT} 'undef'; }
	#                    else
	#                    {
	#                        my $type = eval "ref $var";
	#                        if ($type eq '')
	#                            { DB::dumpit( ${DB::OUT}, eval $var ); }
	#                        else
	#                            { print ${DB::OUT} scalar eval $var; }
	#                    }
	#                    print ${DB::OUT} " (\n";
	#                    DB::dumpit( ${DB::OUT}, eval $var );
	#                    print ${DB::OUT} ")\n";
	#                }
	#            }
	#        },

    ###########################################################################
    # Command to output proximity variables just before each prompt is output.
    ###########################################################################
    ###GST### Note that although this extension is currently defined, there is a
    ###GST### kludge later on in the module that prevents it from being downloaded
    ###GST### to the remote debugger.  This kludge was put in place as the current
    ###GST### 'debuglisten' and GUI portions don't accept the proximity vars coming
    ###GST### back this way but instead treat them as 'special' watch vars internal
    ###GST### to themselves.
    'show_proximity' =>
        q{  sub DB::ASRemote::show_proximity
            {
                my $line;
                my %proximityvars;
                for $line ( ($DB::line - $DB::ASRemote::proximity_before) ..
                            ($DB::line + $DB::ASRemote::proximity_after)
                        )
                {
                    foreach $var ($DB::dbline[$line] =~ /$DB::ASRemote::proximityrgx/g)
                    {
                        $proximityvars{ $var } = undef;
                    }
                }
                my $var;
                foreach $var (keys %proximityvars)
                {
                    print ${DB::OUT} "ASRemote::Proximity $var ";
                    if (!defined eval $var)
                        { print ${DB::OUT} 'undef'; }
                    else
                    {
                        my $type = eval "ref $var";
                        if ($type eq '')
                            { DB::dumpit( ${DB::OUT}, eval $var ); }
                        else
                            { print ${DB::OUT} scalar eval $var; }
                    }
                    print ${DB::OUT} " (\n";
                    DB::dumpit( ${DB::OUT}, eval $var );
                    print ${DB::OUT} ")\n";
                }
            }
        },
);

###############################################################################
# Extensions which add support or new methods to the remote debugger that we're
# going to use.  Note that these are simply loaded into the remote debugger,
# and are _NOT_ set up to run at any given point; they're just extensions.
###############################################################################

my @extensions = (
    q{
        use overload;
    },
    ###########################################################################
    # Regular expression used to match scalar variables.
    ###########################################################################

    #NOTE!!!!
    # Don't put comments inside these things -- each string gets
    # squashed into a single line by the evaluator.
    q{
        $DB::ASRemote::proximityrgx = qr/(\$[a-zA-Z][a-zA-Z0-9_]*
            (?:
                (?:
                    \:\:[a-zA-Z][a-zA-Z0-9_]*
                )*
                (?:
                    \[[ \t]*
                    (?:[0-9]+|\$[a-zA-Z][a-zA-Z0-9_]*)
                    [ \t]*\]
                )*
                |
                (?:
                    \{[ \t]*
                    (?:[a-zA-Z0-9_]+|\$[a-zA-Z][a-zA-Z0-9_]*)
                    [ \t]*\}
                )*
            )*
        )
        /x;
    },

    ###########################################################################
    # Command to spit out an eval block as a chunk of code.  We'll stick this
    # into our own little 'DB::ASRemote:dumpEval($name)' method.
    ###########################################################################
    q{
        sub DB::ASRemote::dumpEval ($)
        {
            my $name = shift;
            if (defined $main::{"_<$name"})
            {
                print ${DB::OUT} @{ $main::{"_<$name"} };
            }
            else
            {
                print ${DB::OUT} "No eval block matching `$name' is loaded.";
            }
        }
    },

    ###########################################################################
    # Command to spit out the contents of a file as a chunk of code.  We'll
    # stick this into our own little 'DB::ASRemote::dumpFile($name)' method.
    ###########################################################################
    # Escape sequences are processed once on this side and
    # once on the remote side

    q{
        sub DB::ASRemote::dumpFile ($)
        {
            my $name = shift;
            my $incname = $name;
            $incname =~ s,^/PerlApp/,,;
            my $script = INC($incname) if defined &INC;
            if (!defined $script && defined &Win32::FreeStanding::GetModule) {
                $script = Win32::FreeStanding::GetModule($name);
            }
            if (defined $script) {
                print $DB::OUT $script;
                return;
            }

            $name =~ s/\\\\/\\\\\\\\/g;
            my ($try) = grep( m#^_<.*$name#, keys %main:: );
            if (defined $try)
            {
                local $_;
                $try = substr( $try, 2 );
                $try =~ s/^\\(eval \\d+\\)\\[(.*):\\d+\\]$/$1/;
                open( DB::ASRemote::fh, "<$try" ) ||
                    print $DB::OUT "Can't locate $try; $!\n";
                while (<DB::ASRemote::fh>)
                    { print $DB::OUT $_; }
                close( DB::ASRemote::fh );
            }
            else
            {
                print $DB::OUT "No file matching `$name' is loaded.\n";
            }
        }
    },
    
    ###########################################################################
    # Takes a reference to a variable, and returns its contents as one
    # string with all special characters escaped using HTTP %[hex][hex]
    # notation.  Also, the first character of the returned string is either
    # 'a' or 'A'.  
    # The 'a' of either case indicates that it's returning children of an array.
    # The second character is the separator character.  If the first char is
    # 'a', the array can be regenerated by doing
    #
    # @result = split(/$str[1]/, substr($str, 2))
    #
    # If the first char is 'A', it means that we need to use the next
    # two-chars to rebuild the original array.  $str[1] is still the separator
    # char, but we need to rebuild each item.  Map instances of <$str[2],$str[3]>
    # back to $str[1], and <$str[2],$str[2]> to one instance of $str[2].
    #
    # $str[2] acts like an escape char.
    # $str[3] is an innocuous char used with the escape char to
    # encode the separator character.
    # 
    ###########################################################################
    q{
        sub DB::ASRemote::escapeArrayChildren ($) {
	  my $aref = shift;
	  my @a = map overload::StrVal($_), @$aref;
	  return DB::ASRemote::escapeRest('a', 'A', \@a);
	}
     },

    q{
	sub DB::ASRemote::escapeHashChildren ($) {
	    my $aref = shift;
	    my @a = map overload::StrVal($_), %$aref;
	    return DB::ASRemote::escapeRest('h', 'H', \@a);
	}
     },
    
    q{
        sub DB::ASRemote::escapeArrayChildrenRefs ($) {
	    local ($_, $`, $.);
	  my $aref = shift;
	  my @a = map { ref($_) } @$aref;
	  return DB::ASRemote::escapeRest('a', 'A', \@a);
	}
     },

    q{
	sub DB::ASRemote::escapeHashChildrenRefs ($) {
	    local ($_, $`, $.);
	    my $aref = shift;
	    my %h1 = %$aref;
	    my %h2 = map { $_ => ref($h1{$_}) } (keys %h1);
	    my @a = %h2;
	    return DB::ASRemote::escapeRest('h', 'H', \@a);
	}
     },

    ################################################################
    # In the next routine, first  winnow out all alphanumeric chars that will slow
    # down pseudo-pattern-matching
    #
    # $childrenString ends up containing only non-alnum chars.
    #
    # Then find a char that's in %hc that isn't in $childrenString
    #
    # Finally do the escaping.
    #
    # If we need to do http-escaping as well, this is
    # the place.
    ################################################################

    q{
	sub DB::ASRemote::escapeRest ($$$) {
	    local ($_, $`, $.);
	    my ($simpleLetter, $compoundLetter, $aref) = @_;
	    my @children = @$aref;
	    my $childrenString = join('', @children);
	
	    $childrenString =~ s/[a-zA-Z0-9]+//g;
	    my $res;
	    my %hin = map { $_ => 1 } split(//,$childrenString);
	
	    my $charsOfInterest = '#!-_,=;:<>@&';
	    my %hc = map { $_ => 1 } split(//,$charsOfInterest);
	
	    foreach my $possibleChar (keys %hc) {
		if (! defined $hin{$possibleChar}) {
		    return "$simpleLetter$possibleChar" . join($possibleChar, @children);
		}
	    }
	
	    my $sepChar = '!';
	    my $escapeChar = ';';
	    my $encodedEscapedSepChar = 'q';
	    for (my $i = 0; $i < @children; $i++) {
		$children[$i] =~ s/$escapeChar/$escapeChar$escapeChar/g;
		$children[$i] =~ s/$sepChar/$escapeChar$encodedEscapedSepChar/g;
	    }
	    return "$compoundLetter$sepChar$escapeChar" . join($sepChar, @children);
	
	}
    },

    ### Pickles the arguments into a Python tuple of strings. 
    q{
        sub DB::ASRemote::pickle {
	    my $i = 0;
	    my $str = "(";
	    for my $elem (@_) {
		$elem =~ 
		    s{([\'\\\\\x00-\x19\x7F-\xFF])}{'\\x'.sprintf("%.2x",ord($1))}eg;
		$str .= defined $elem ? ("S'$elem'\012p" . $i++ . "\012") : "N";
	    }
	    $str .= "tp$i\012.";
	    return $str;
	}
    }
);

# Delete the lines after 'my $remoteIO_FileNum = fileno $DB::remoteIO;'
# and replace with these.

#	  close STDOUT;
#	  open(STDOUT, ">&$remoteIO_FileNum") or die "Couldn't redirect stdout: $!, remoteIO_FileNum = $remoteIO_FileNum";
#	  select((select(STDOUT), $| = 1)[0]);


###############################################################################
# Subroutine:   _InitDebugger ()
###############################################################################
# Initializes the remote debugger, by cleaning out the list of commands to
# execute on each prompt, and sending down the extensions we wish to use.
###############################################################################
sub InitDebugger ()
{
    my ($self) = shift;
    my ($rtnval);               # For propogating error msgs from send/process
    trace( 1, 'Jacket::_InitDebugger()' );
    my $tieHandleSub;

    ###########################################################################
    # Get any initial header information sent back by the remote debugger,
    # clear the list of active prompt extensions, and set default values.
    ###########################################################################
    $rtnval = ($self->_ProcessOutput() ||           # Clear any header info
               $self->_SendCommand( '<' ) ||        # Clear extensions
               $self->_ProcessOutput() ||
               $self->ProximityWindow( 4, 5 )       # Set proximity window size
              );
    if ($rtnval) {
      # A problem here means that Perl is no longer running.
      $self->{'OUT'}->shutdown(2);
      $self->{'IN'} = $self->{'OUT'} = $self->{'_conn'} = 0;
      trace( 0, 'Perl is dead, shutdown the socket and return.' );
    }

    ###########################################################################
    # Send down the extensions which we want to add to the remote debugger.
    ###########################################################################
    if (!$rtnval)
    {
        trace( 0, 'Sending extensions to remote debugger.' );

	# This thing decides how to redirect stdout:
	# Debug in a console: no redirection
	#
	# Debug remotely, in ide: redirect program output
	# to both the program's stdout as well as the debugger UI
	#
	# Debug locally in IDE: redirect program output to IDE
	

	if (!$self->{'showConsole'}) {
	    if ($self->{'isRemote'}) {
		$tieHandleSub = q[
		    package DB::ASRemote::WriteToBoth;

		    use strict;

		    sub TIEHANDLE
		    {
			my ($class,$self) = @_;
			bless $self, $class;
			return $self;
		    }

		    sub PRINT
		    {
			my $self = shift;
			eval {print STDOUT @_;};
			eval {print $self @_;};
		    }

		    sub PRINTF
		    {
			my $self = shift;
			my $fmt = shift;
			eval {printf STDOUT $fmt, @_;};
			eval {printf $self $fmt, @_;};
		    }
		];
	    } else {
		$tieHandleSub = "";
	    }
	    $tieHandleSub .= q{
		package DB;

		sub DB::ASRemote::redirectStdio {
		    my ($isRemote, $IOPortNum) = @_;
		    my $remote_io_port;
		    if ($DB::remoteport =~ /(.*):(\d+)$/) {
			$remote_io_port = "$1:$IOPortNum"
		    } else {
			$remote_io_port = "127.0.0.1:$IOPortNum";
			print STDERR "Couldn't match pattern on $DB::remoteport\n";
		    }
		    $DB::remoteIO = new IO::Socket::INET( Timeout  => '10',
							  PeerAddr => $remote_io_port,
							  Proto    => 'tcp',
							  );
		    if (! $DB::remoteIO) {
			print STDERR "Could not create socket to connect to remote host at $remote_io_port: $!\n";
			0;
		    } else {
			my $remoteIO_FileNum = fileno $DB::remoteIO;
			if ($isRemote) {
			    tie (*DB::NEWOUT, "DB::ASRemote::WriteToBoth", $DB::remoteIO);
			    select DB::NEWOUT;
			    $| = 1;
			} else {
			    close STDERR;
			    open(STDERR, ">&$remoteIO_FileNum") or die "Couldn't redirect stderr: $!";
			    select(STDERR);
			    $| = 1;
			    close STDOUT;
			    open(STDOUT, ">&$remoteIO_FileNum") or die "Couldn't redirect stdout: $!";
			    select(STDOUT);
			    $| = 1;
			}
		    }
		    "1";
		};
	    };
	    push @extensions, $tieHandleSub;
	}
        foreach my $var (@extensions)
        {
            my $cleanvar = $self->_clean_ext( $var );
            $rtnval |= $self->_SendCommand( $cleanvar ) ||
                       $self->_ProcessOutput();

            last if ($rtnval);
        }
    }

    ###########################################################################
    # Send down the actions we wish to have performed before each prompt.  Note
    # that these are sent AFTER the extensions as we _may_ require them to be
    # available.
    ###########################################################################
    if (!$rtnval)
    {
        trace( 0, 'Sending actions to remote debugger.' );
        foreach my $key (keys %actions)
        {
            next if $key eq 'show_proximity';       # KLUDGE: TEMP work around
            my $var = $actions{ $key };
            my $cleanvar = $self->_clean_ext( $var );
            $rtnval |= $self->_SendCommand( $cleanvar ) ||
                       $self->_ProcessOutput() ||
                       $self->_SendCommand( "<< DB::ASRemote::$key()" ) ||
                       $self->_ProcessOutput();
            last if ($rtnval);
        }
    }
    if (!$rtnval && !$self->{'showConsole'}) {
      $rtnval = ($self->_SendCommand("p DB::ASRemote::redirectStdio(" .
				     $self->{'isRemote'} .
				     ", " .
				     $self->{'IOPort'} .
				     ")"
				     ) ||
		 $self->_ProcessOutput());
    } else {
        trace( -1, "Don't send a redirect req because \$rtnval = 0\n" );
      #print STDERR "Don't send a redirect req because \$rtnval = 0\n";
    }
    trace( -1, "done Jacket::_InitDebugger(); $rtnval" );
    $self->{'debuggerInitialized'} = !$rtnval;
    return $rtnval;
}

###############################################################################
# Subroutine:   _clean_ext ($unclean)
# Parameters:   $unclean    - "Unclean" version of extension to send
# Returns:      $clean      - "Clean" version of extension to send
###############################################################################
# INTERNAL METHOD.  Cleans up an extension/action that is about to be sent to
# the remote debugger for execution.  Strips all newlines from the data and
# turns the extension into a single line of Perl code.
###############################################################################
sub _clean_ext ($)
{
    my ($self, $unclean) = @_;
    trace( 1, 'Jacket::_cleanext()' );
    my @tmp = split( /^/o, $unclean );
    map { s/^\s+//o; chomp; } @tmp;
    my $rc = join( '', @tmp );
    trace( -1, "done Jacket::_cleanext(); $rc" );
    return $rc;
}

###############################################################################
# Subroutine:   ProximityWindow ( before, after )
# Parameters:   before  - Size of proximity window before current line
#               after   - Size of proximity window after current line
###############################################################################
# Sets the size of the proximity window on the remote debugger to include the
# given number of lines before and after the current line.
###############################################################################
sub ProximityWindow ($$)
{
    my ($self) = shift;
    my ($before) = int( shift );
    my ($after)  = int( shift );
    my ($rtnval);                   # For propogating errors from send/process
    trace( 1, 'Jacket::ProximityWindow()' );

    ###########################################################################
    # If invalid value given, choke.
    ###########################################################################
    if (($before <= 0) || ($after <= 0))
    {
        $rtnval = $self->_Error( ERR_PROXSIZE,
                                 'before' => $before,
                                 'after' => $after );
        trace( -1, "Bad window size, done Jacket::ProximityWindow(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Set the values for the proximity window.
    ###########################################################################
    $rtnval = ($self->_SendCommand( "\$DB::ASRemote::proximity_before=$before"  ) ||
               $self->_ProcessOutput() ||

               $self->_SendCommand( "\$DB::ASRemote::proximity_after=$after" ) ||
               $self->_ProcessOutput()
              );
    trace( -1, "done Jacket::ProximityWindow(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   SetWatch ( $expression )
# Parameters:   $expression - Expression to set a watch on
###############################################################################
# Sets a watch variable and queries it's value immediately.  Note that we do
# _not_ have to explicitly expand out the variable as this is done by the
# _ProcessOutput() method.
###############################################################################
sub SetWatch ($)
{
    my ($self) = shift;
    my ($expression) = @_;
    my ($rtnval);               # For propogating errors from send/process
    my ($escaped) = $expression;
    trace( 1, 'Jacket::SetWatch()' );

    ###########################################################################
    # Escape out the var name so we can put it in our own little header
    ###########################################################################
    $escaped =~ s/'/\\'/g;

    ###########################################################################
    # Add this expression to the list of expressions we're to be watching.
    ###########################################################################
    $rtnval = ($self->_SendCommand( "\$DB::ASRemote::watched{'$escaped'} = 1" ) ||
               $self->_ProcessOutput() 
              );

    ###########################################################################
    # Query the value of the variable immediately.  Note that this action
    # queries the values of ALL the currently watched expressions, so we need
    # to make sure to clear our own list of watched expressions first.
    ###########################################################################
    ###GST### This code has been commented out to help reduce the overhead of using
    ###GST### the GUI debugger; it resets all of the watch vars after each step
    ###GST### through the script, which is a total waste of system resources to
    ###GST### parse everything through time after time after time again (all of the
    ###GST### vars are output on subsequent runs, not just the one that was set).
    ###GST###
    ###GST### As well, note that because the GUI debugger currently does an
    ###GST### 'UpdateStatus' itself after each step, this block of code is _only_
    ###GST### required if you want to have the watch vars shown the instant that
    ###GST### they're set; otherwise they'll come back automatically anyways.
    #    if (!$rtnval)
    #    {
    #        undef @{$self->{'_watched'}};
    #        $rtnval |= ($self->_SendCommand( 'DB::ASRemote::show_watch' ) ||
    #                    $self->_ProcessOutput()
    #                );
    #    }
    trace( -1, "done Jacket::SetWatch(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   RemoveWatch ( $expression )
###############################################################################
# Removes a watched expression from the list of things that we're watching.
# Does this by removing the expression from our own internal lists, and then by
# resetting the entire list of watched expressions on the remote end.
###############################################################################
sub RemoveWatch ($)
{
    my ($self) = shift;
    my ($expression) = @_;
    my ($rtnval);                   # For propogating errors from send/process
    my ($watch);
    trace( 1, 'Jacket::RemoveWatch()' );

    ###########################################################################
    # Remove the watched expression from our internal list of what we're
    # watching.
    ###########################################################################
    foreach my $idx (0 .. scalar @{$self->{'watched'}})
    {
        if ($self->{'watched'}[$idx]->{'name'} eq $expression)
        {
            splice( @{$self->{'watched'}}, $idx, 1 );
            last;
        }
    }

    foreach my $idx (0 .. scalar @{$self->{'_watched'}})
    {
        if ($self->{'_watched'}[$idx]->{'name'} eq $expression)
        {
            splice( @{$self->{'_watched'}}, $idx, 1 );
            last;
        }
    }

    ###########################################################################
    # Remove the watch on this variable on the remote end.
    ###########################################################################
    my $sanitized = $expression;
    $sanitized =~ s/'/\\'/go;
    $rtnval = $self->_SendCommand(
                "delete \$DB::ASRemote::watched{'$sanitized'};"
                ) ||
              $self->_ProcessOutput();

    ###########################################################################
    # Done, return something suitable.
    ###########################################################################
    trace( -1, "done Jacket::RemoveWatch(); $rtnval" );
    return $rtnval;
}


###############################################################################
###############################################################################


sub GetCurrentLine ()
{
    my ($self) = shift;
    my ($rtnval);
    trace( 1, 'Jacket::GetCurrentLine()' );

    $rtnval = ($self->_SendCommand( "." ) ||
               $self->_ProcessOutput() 
              );
    $rtnval = $self->{'linenum'};
    trace( -1, "done Jacket::GetCurrentLine(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   Expand ($expansion)
# Parameters:   $expansion  - Information from ASRemote::Variable to expand var
###############################################################################
# Expands a watch/proximity variable.
###############################################################################
sub Expand ($)
{
    my ($self, $expansion) = @_;
    my $rc;
    trace( 1, 'Jacket::Expand()' );

    ###########################################################################
    # Choke if we haven't been given all of the params we need.
    ###########################################################################
    if (!defined $expansion)
    {
        $rc = $self->_Error( ERR_INVARGS, 'method' => 'Expand()' );
        trace( -1, "No var given to expand, done Jacket::Expand(); $rc" );
        return $rc;
    }

    ###########################################################################
    # Get the list of things to expand out
    ###########################################################################
    my @expansion_list = split( /\|,\|/, $expansion );
    if (scalar @expansion_list == 0)
        { return $self->_Error( ERR_INVARGS, 'method' => 'Expand()' ); }
    my $type = $expansion_list[0];
    my $name = $expansion_list[1];

    ###########################################################################
    # Find the offset of the destination watch/proximity variable that we're
    # expanding.
    ###########################################################################
    my $offset;
    my $dst;
    if ($type =~ /watch/io)
    {
        foreach $offset (0 .. $#{$self->{'watched'}})
        {
            if ($self->{'watched'}[$offset]->{'name'} eq $name)
            {
                $dst = $self->{'watched'}[$offset];
                last;
            }
        }
    }
    elsif ($type =~ /proximity/io)
    {
        foreach $offset (0 .. $#{$self->{'proximity'}})
        {
            if ($self->{'proximity'}[$offset]->{'name'} eq $name)
            {
                $dst = $self->{'proximity'}[$offset];
                last;
            }
        }
    }
    else
    {
        $rc = $self->_Error( ERR_INVARGS, 'method' => 'Expand()' );
        trace( -1, "Invalid var type given, done Jacket::Expand(); $rc" );
    }

    ###########################################################################
    # If we couldn't find the destination watch/proximity variable that we're
    # supposed to be expanding into, choke.
    ###########################################################################
    if (!defined $dst)
    {
        $rc = $self->_Error( ERR_BADEXPAND, type => $type, name => $name );
        trace( -1, "Unknown expansion dst '$name', done Jacket::Expand(); $rc" );
    }

    ###########################################################################
    # Find the original (full) watch/proximity variable that we're expanding
    # from.
    ###########################################################################
    my $src;
    if ($type =~ /watch/io)
    {
        foreach my $elem (@{$self->{'_watched'}})
        {
            if ($elem->{'name'} eq $name)
            {
                $src = $elem;
                last;
            }
        }
    }
    else
    {
        foreach my $elem (@{$self->{'_proximity'}})
        {
            if ($elem->{'name'} eq $name)
            {
                $src = $elem;
                last;
            }
        }
    }

    ###########################################################################
    # Add this expansion to the list of expansions we should continue to do.
    ###########################################################################
    push( @{$self->{'_expansions'}}, $expansion );

    ###########################################################################
    # If we managed to find a source var to expand information from, expand
    # that out.
    ###########################################################################
    if (defined $src)
    {
        $dst->expand_from( $src, @expansion_list );
    }

    trace( -1, "done Jacket::Expand(); 0" );
    return 0;
}

###############################################################################
# Subroutine:   Collapse ($expansion)
# Parameters:   $expansion  - Information from ASRemote::Variable to collapse
#                             var
###############################################################################
# Collapses a watch/proximity variable.
###############################################################################
sub Collapse ($)
{
    my ($self, $expansion) = @_;
    trace( 1, 'Jacket::Collapse()' );
    my @newlist = grep( !/^$expansion$/, @{$self->{'_expansions'}} );
    @{$self->{'_expansions'}} = @newlist;
    $self->_ExpandAsNeeded();
    trace( -1, "done Jacket::Collapse(); 0" );
    return 0;
}

###############################################################################
# Subroutine:   _ExpandAsNeeded ()
###############################################################################
# Expands out the watch/proximity variables as required.
###############################################################################
sub _ExpandAsNeeded ()
{
    my $self = shift;
    my $var;
    trace( 1, 'Jacket::_ExpandAsNeeded()' );

    ###########################################################################
    # First, do the watch variables
    ###########################################################################
    undef @{$self->{'watched'}};
    foreach $var (@{$self->{'_watched'}})
    {
	###GST###trace( 0, "Expanding watch var '$var->{name}'." );
        my $dst = $var->clone();
        my $prefix = $var->{'type'} . '|,|' . $var->{'name'};
        my @exp = grep( /^\Q$prefix\E/, @{$self->{'_expansions'}} );
        if (scalar @exp > 0)
        {
            foreach my $expansion (@exp)
            {
                my @broken = split( /\|,\|/, $expansion );
                $dst->expand_from( $var, @broken );
            }
        }
        push( @{$self->{'watched'}}, $dst );
	###GST###trace( 0, "Added '$dst->{name}' to 'watched'." );
    }

    ###########################################################################
    # Then, do the proximity variables
    ###########################################################################
    undef @{$self->{'proximity'}};
    foreach $var (@{$self->{'_proximity'}})
    {
	###GST###trace( 0, "Expanding proximity var '$var->{name}'." );
        my $dst = $var->clone();
        my $prefix = $var->{'type'} . '|,|' . $var->{'name'};
        my @exp = grep( /^\Q$prefix\E/, @{$self->{'_expansions'}} );
        if (scalar @exp > 0)
        {
            foreach my $expansion (@exp)
            {
                my @broken = split( /\|,\|/, $expansion );
                $dst->expand_from( $var, @broken );
            }
        }
        push( @{$self->{'proximity'}}, $dst );
	###GST###trace( 0, "Added '$dst->{name}' to 'proximity'." );
    }
    trace( -1, 'done Jacket::_ExpandAsNeeded()' );
}

###############################################################################
# Subroutine:   _ParseFileLine ($where)
# Parameters:   $where  - String to check for filename/line number combination
# Returns:      ($newfile, $linenum, $oldfile)
###############################################################################
# Parses a given string to pull out any filename/linenumber information which
# it may contain.  This method returns a three element list value to the caller
# containing: 1) The name of the file contained in the given parameter, 2) The
# line number contained in the given parameter, and 3) The name of the file
# which we are currently in.
#
# Note that if unable to parse out any filename information from the given
# string, the entire string will be returned in the $linenum element of the
# return value.
###############################################################################
sub _ParseFileLine ($)
{
    my ($self, $lineinfo) = @_;
    my ($newfile, $linenum);
    trace( 1, 'Jacket::_ParsefileLine()' );

    if ($lineinfo =~ /^(.+):(\d+)/o)
    {
        $newfile = $1;
        $linenum = $2;
    }
    else
    {
        $linenum = $lineinfo;
    }

    my @rc = ($newfile, $linenum, $self->{'filename'});
    trace( -1, "done Jacket::_ParsefileLine(); @rc" );
    return @rc;
}

###############################################################################
# Subroutine:   SetBreakpoint ( $where, $condition )
# Parameters:   $where  - Location to set the breakpoint at.
###############################################################################
# Sets a breakpoint at a given line of code, and updates our internal list of
# where the breakpoints are.  Accepts inputs in any of the following formats:
#   file:line       e.g. "foo.pl:23"	- Sets breakpoint in other file
#   line            e.g. 23		- Sets breakpoint in current file
###############################################################################
sub SetBreakpoint ($$)
{
    my ($self) = shift;
    my ($where) = shift;
    my ($condition) = @_;
    my $rtnval = 0;
    trace( 1, 'Jacket::SetBreakpoint()' );
    my ($newfile, $linenum, $oldfile) = $self->_ParseFileLine( $where );

    ###########################################################################
    # If we're supposed to be switching files before setting the breakpoint,
    # switch into the file the breakpoint is in.
    ###########################################################################
    my $switchFiles = (defined $newfile) && ($newfile ne $oldfile);
    if ($switchFiles)
    {
        $rtnval = ($self->_SendCommand( "f $newfile" ) ||
                   $self->_ProcessOutput()
                  );
    }

    ###########################################################################
    # Set the breakpoint.
    ###########################################################################
    if (!$switchFiles or $rtnval ne ERR_FAILEDCMD)
    {
        $self->{'_captureraw'} = 'result';
	$rtnval |= ($self->_SendCommand( "b $linenum $condition" ) ||
		    $self->_ProcessOutput()
		    );
        undef $self->{'_captureraw'};
    }
    elsif ($switchFiles) {
        # by definition, rtnval eq ERR_FAILEDCMD, so the file is not loaded, break on load
        # we want to reset rtnval to the error so that dbgutils.py will resend this breakpoint
        # when the file is loaded
	$rtnval |= ($self->_SendCommand( "b load $newfile" ) ||
		    $self->_ProcessOutput()
		    );
        $rtnval |= ERR_FAILEDCMD;
    }

    ###########################################################################
    # Try switching back to the file we started in.  We need to do this
    # regardless of whether or not WE think we switched files as depending on
    # the input we were given the remote debugger may have switched files on us
    # without telling us (thanks).  If we think we were supposed to have
    # changed files, then we propogate the return value, otherwise we just
    # ignore it.
    ###########################################################################
    my $rtn_test = ($self->_SendCommand( "f $oldfile" ) ||
                    $self->_ProcessOutput()
                   );
    if ((!defined $newfile) || ($newfile ne $oldfile))
    {
        $rtnval |= $rtn_test;
    }

    # If we haven't had an error yet, update the breakpoints.
    $rtnval |= $self->_UpdateBreakpoints();
    trace( -1, "done Jacket::SetBreakpoint(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   RemoveBreakpoint ( $where )
# Parameters:   $where  - Location of breakpoint to remove
###############################################################################
# Removes a breakpoint at a given line of code, and updates our internal list
# of where the breakpoints are.  Accepts inputs in any of the following
# formats:
#   file:line       e.g. "foo.pl:23"	- Removes breakpoint in other file
#   line            e.g. 23		- Removes breakpoint in current file
###############################################################################
sub RemoveBreakpoint ($)
{
    my ($self) = shift;
    my ($where) = @_;
    my $rtnval = 0;
    trace( 1, 'Jacket::RemoveBreakpoint()' );
    my ($newfile, $linenum, $oldfile) = $self->_ParseFileLine( $where );

    ###########################################################################
    # If we're supposed to be switching files before removing the breakpoint,
    # switch into the file the breakpoint is in.
    ###########################################################################
    my $switchFiles = (defined $newfile) && ($newfile ne $oldfile);
    if ($switchFiles)
    {
        $rtnval = ($self->_SendCommand( "f $newfile" ) ||
                   $self->_ProcessOutput()
                  );
    }

    ###########################################################################
    # Clear the breakpoint.
    ###########################################################################
    if (!$switchFiles or $rtnval ne ERR_FAILEDCMD)
    {    
	$rtnval |= ($self->_SendCommand( "d $linenum" ) ||
		    $self->_ProcessOutput()
		    );
    }

    ###########################################################################
    # If we'd switched files, switch back to the file we were in to start with.
    ###########################################################################
    if ((defined $newfile) && ($newfile ne $oldfile))
    {
        $rtnval |= ($self->_SendCommand( "f $oldfile" ) ||
                    $self->_ProcessOutput()
                   );
    }

    # If we hadn't found any errors yet, update the breakpoints.
    $rtnval |= $self->_UpdateBreakpoints();
    trace( -1, "done Jacket::RemoveBreakpoint(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   ClearBreakpoints ()
###############################################################################
# Clears the list of currently set breakpoints.
###############################################################################
sub ClearBreakpoints ()
{
    my ($self) = shift;
    trace( 1, 'Jacket::ClearBreakpoints()' );

    my $rtnval = ($self->_SendCommand( "D" ) || $self->_ProcessOutput());
    if (!$rtnval) { %{ $self->{'breakpoints'} } = () };

    trace( -1, "done Jacket::ClearBreakpoints(); $rtnval" );
    return $rtnval;
}


sub QQQ_ListBreakpoints ()
{
    my ($self) = shift;
    trace( 1, 'Jacket::QQQ_ListBreakpoints()' );

    $self->{'_captureraw'} = 'result';
    my $rtnval = ($self->_SendCommand( "L" ) || $self->_ProcessOutput());
    undef $self->{'_captureraw'};
    trace( -1, "done Jacket::QQQ_ListBreakpoints(); $rtnval" );
    return $rtnval;
}
###############################################################################
# Subroutine:   _UpdateBreakpoints ()
###############################################################################
# Updates our internal list of where the breakpoints are in the code.
###############################################################################
sub _UpdateBreakpoints ()
{
    my $self = shift;
    my $file;
    my $linenum;
    my @breaks;
    my $rtnval;
    trace( 1, 'Jacket::_UpdateBreakpoints()' );

    ###########################################################################
    # Ask the remote debugger for the current breakpoints, and capture all the
    # data raw so we can process it ourselves.
    ###########################################################################
    $self->{'_captureraw'} = '_debugger_breakpoints';
    $rtnval = ($self->_SendCommand( "L" ) ||
               $self->_ProcessOutput()
              );
    undef $self->{'_captureraw'};
    if ($rtnval)
    {
        trace( -1, "Capture raw failed, done Jacket::_UpdateBreakpoints(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Fill our breakpoints property with the values we just read back
    ###########################################################################
    %{ $self->{'breakpoints'} } = ();
    @breaks = split( "\n", $self->{'_debugger_breakpoints'} );

    while (scalar @breaks > 0)
    {
        my ($scratch) = shift @breaks;
        if ($scratch =~ /^(.*):$/)              # Grab filenames
            { $file = $1; }
        elsif ($scratch =~ /^\s*(\d+):\s+/)     # And line numbers
        {
            $linenum = $1;
	    my $condition = shift @breaks;
            if (defined $file)
            {
		if ($condition =~ /break if \((.*)\)$/) { $condition = $1; }
		else { $condition = "1"; }
                my $breakhere = join( ':', $file, $linenum );
                trace( 0, "Found breakpoint at '$breakhere'." );
                $self->{'breakpoints'}->{$breakhere} = $condition;
            }
        }
    }

    ###########################################################################
    # Clean up the temp space we used and return peacefully.
    ###########################################################################
    undef $self->{'_debugger_breakpoints'};
    trace( -1, 'done Jacket::_UpdateBreakpoints(); 0' );
    return 0;
}

###############################################################################
# Subroutine:   Step ()
###############################################################################
# Performs a single "step" operation.  This will step into any functions or
# subroutines.
###############################################################################
sub Step ()
{
    my ($self) = shift;
    trace( 1, 'Jacket::Step()' );
    my $rtnval = ($self->_SendCommand( "s" ) || $self->_ProcessOutput());
    trace( -1, "done Jacket::Step(); $rtnval" );

    ###GST### This code has been added in to try to help determine why the
    ###GST### "DB::pre" variable gets reset after doing a 'step' command.  It
    ###GST### doesn't happen in the command line debugger, but only happens when
    ###GST### running under the GUI.  Even after littering my 'perl5db.pl' with
    ###GST### code to help show why the value of this var changes, I'm left with no
    ###GST### answers as to what's happening; its not being changed at any point
    ###GST### where it gets changed in perl5db.pl.
    #$self->{'_captureraw'} = '__dbpre';
    #$self->_SendCommand( 'x $DB::pre' ) || $self->_ProcessOutput();
    #undef $self->{'_captureraw'};
    #trace( 0, "DB::pre: " . $self->{'__dbpre'} );
    #undef $self->{'__dbpre'};
    ###GST### END

    return $rtnval;
}

###############################################################################
# Subroutine:   StepOver ()
###############################################################################
# Performs a single "step" operation, stepping over functions or subroutines.
###############################################################################
sub StepOver ()
{
    my ($self) = shift;
    trace( 1, 'Jacket::StepOver()' );
    my $rtnval = ($self->_SendCommand( "n" ) || $self->_ProcessOutput());
    trace( -1, "done Jacket::StepOver(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   ReturnFromSub ()
###############################################################################
# Returns from the current subroutine.  The value that is returned is stuffed
# into a ASRemote::Variable structure as best we can, and is placed in our own
# 'return' property.
###############################################################################
sub ReturnFromSub ()
{
    my ($self) = shift;
    trace( 1, 'Jacket::ReturnFromSub()' );

    ###########################################################################
    # Set ourselves up to capture the raw return value and then return from the
    # subroutine that we're in.
    ###########################################################################
    $self->{'_captureraw'} = '_returnfromsub';
    my $rtnval = ($self->_SendCommand( "r" ) || $self->_ProcessOutput());
    undef $self->{'_captureraw'};

    ###########################################################################
    # Depending on what type of return value we were given, either make the
    # value void or parse out the value as best we can.
    ###########################################################################
    if ($self->{'_returnfromsub'} =~ /^void context return/o)
    {
        $self->{'return'} = 'void';
    }
    else
    {
# UNFINISHED -> Need to give this thing a scalar value.
        $self->{'_returnfromsub'} =~
            s/^\S+ context return from (\S+):/ASRemote::Return $1 returnval (/;
        $self->{'_returnfromsub'} .= "\n)\n";
        $self->{'return'} = new ASRemote::Variable( $self->{'_returnfromsub'} );
    }

    ###########################################################################
    # Clean up the memory we used for the raw feedback from the remote debugger
    # and return.
    ###########################################################################
    undef $self->{'_returnfromsub'};
    trace( -1, "done Jacket::ReturnFromSub(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   RunUntil ( $where )
# Parameters:   $where  - File/line number to run until
###############################################################################
# Runs the script on the remote debugger up to the given file/line number
# provided.  Note that any breakpoints which have been set _will_ be broken on
# when reached.
###############################################################################
sub RunUntil ($)
{
    my ($self) = shift;
    my ($where) = @_;
    my $rtnval = 0;
    trace( 1, 'Jacket::RunUntil()' );
    my ($newfile, $linenum, $oldfile) = $self->_ParseFileLine( $where );

    ###########################################################################
    # If we're supposed to be switching files before running up to the given
    # line, switch into that file.
    ###########################################################################
    my $switchFiles = (defined $newfile) && ($newfile ne $oldfile);
    if ($switchFiles)
    {
        $rtnval = ($self->_SendCommand( "f $newfile" ) ||
                   $self->_ProcessOutput()
                  );
    }

    ###########################################################################
    # Send the command to run up to the given line of code.
    ###########################################################################
    if (!$switchFiles or $rtnval ne ERR_FAILEDCMD)
    {
	$rtnval |= ($self->_SendCommand( "c $linenum" ) ||
		    $self->_ProcessOutput()
		    );
    }

    trace( -1, "done Jacket::RunUntil(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   QuickEval ( expression )
# Parameters:   expression  - Expression to do an 'eval' on in the debugger
###############################################################################
# Does an 'eval' on the given expression in the context of the target script.
###############################################################################
sub QuickEval ($)
{
    my ($self) = shift;
    my ($expression) = @_;
    my ($rtnval);
    trace( 1, 'Jacket::QuickEval()' );

    ###########################################################################
    # Be sure to grab the raw output from the expression we eval
    ###########################################################################
    undef $self->{'result'};
    $self->{'_captureraw'} = 'result';

    ###########################################################################
    # Eval the expression and get the output.  Then, clear our capturing of raw
    # data so we don't pollute everything else.
    ###########################################################################
    $rtnval = ($self->_SendCommand( "p $expression " ) ||
               $self->_ProcessOutput()
              );
    undef $self->{'_captureraw'};

    trace( -1, "done Jacket::QuickEval(); $rtnval" );
    return $rtnval;
}



sub RelayToDebugger ($)
{
    my ($self) = shift;
    my ($expression) = @_;
    my ($rtnval);
    trace( 1, 'Jacket::RelayToDebugger()' );

    ###########################################################################
    # Be sure to grab the raw output from the expression we eval
    ###########################################################################
    undef $self->{'result'};
    $self->{'_captureraw'} = 'result';

    # Add the space so the debugger evaluates the expression in the
    # Perl context.
    
    $rtnval = ($self->_SendCommand( " $expression" ) ||
               $self->_ProcessOutput()
              );
    undef $self->{'_captureraw'};

    trace( -1, "done Jacket::RelayToDebugger(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   DumpCallStack ()
###############################################################################
# Try to return the CallStack
###############################################################################
sub DumpCallStack ()
{
    my ($self) = shift;
    trace( 1, 'Jacket::DumpCallStack()' );
    undef $self->{'result'};
    $self->{'_captureraw'} = 'result';
    my $rtnval = ($self->_SendCommand( "T" ) || $self->_ProcessOutput());
    undef $self->{'_captureraw'};
    trace( -1, "done Jacket::DumpCallStack(); $rtnval" );
    return $rtnval;
}


###############################################################################
# Subroutine:   AddWatchExpression ()
###############################################################################
# Add an expression to watch
###############################################################################
sub AddWatchExpression ()
{
    my ($self) = shift;
    my ($expression) = @_;
    print STDERR "AddWatchExpression $expression\n";
    trace( 1, 'Jacket::AddWatchExpression()' );
    undef $self->{'result'};
    $self->{'_captureraw'} = 'result';
    my $rtnval = ($self->_SendCommand( "W $expression " ) ||
		  $self->_ProcessOutput()
		  );
    undef $self->{'_captureraw'};
    trace( -1, "done Jacket::AddWatchExpression(); $rtnval" );
    return $rtnval;
}


###############################################################################
# Subroutine:   Quit ()
###############################################################################
# Quits debugging the target script, and shuts down the connection to the
# remote host.
###############################################################################
sub Quit ()
{
    my ($self) = shift;
    trace( 1, 'Jacket::Quit()' );
    $self->{'terminated'} = 1;
    ###########################################################################
    # Quit working in the remote debugger.
    ###########################################################################
    my $rtnval = ($self->_SendCommand( "q" ) || $self->_ProcessOutput());
    if ($rtnval)
    {
        trace( -1, "Unable to quit, done Jacket::Quit(); $rtnval" );
        # return $rtnval;
    }

    ###########################################################################
    # Shut down the connection at this end.
    ###########################################################################
    if (defined(fileno($self->{'IN'}))) {
	if (!close( $self->{'IN'} ))
	{
	    $rtnval = $self->_Error( ERR_CLOSECONN ) || $rtnval;
	    trace( -1, "Unable to close input stream; done Jacket::Quit(); $rtnval" );
	    # return $rtnval;
	}
    } else {
	trace(-1, "\$self->{'IN'} is already undefined\n");
	$rtnval = 0;
    }

    if (defined(fileno($self->{'OUT'}))) {
	if (!close( $self->{'OUT'} ))
	{
	    $rtnval = $self->_Error( ERR_CLOSECONN ) || $rtnval;
	    trace( -1, "Unable to close output stream; done Jacket::Quit(); $rtnval" );
	    # return $rtnval;
	}
    } else {
	trace(-1, "\$self->{'OUT'} is already undefined\n");
	# Leave $rtnval alone.
    }

    ###########################################################################
    # If we had an internal socket connection, shut down the socket too.
    ###########################################################################
    if (defined $self->{'_port'})
    {
        undef $self->{'_conn'}; # Already closed via 'IN' and 'OUT'
        if (defined $self->{'_sock'} && !$self->{'_sock'}->close())
        {
            $rtnval = $self->_Error( ERR_CLOSESOCK ) || $rtnval;
            trace( -1, "Unable to close socket; done Jacket::Quit(); $rtnval" );
            # return $rtnval;
        }
    }

    ###########################################################################
    # Done closing things down...
    ###########################################################################
    trace( -1, "done Jacket::Quit(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   _SendCommand ( command )
# Parameters:   command - Raw debugger command to send to the remote host
###############################################################################
# Sends a raw debugger command to the remote host.
###############################################################################
sub _SendCommand ($)
{
    my ($self) = shift;
    my ($cmd) = @_;
    my $rc;
    #$cmd =~ s#\n#\\\n#mg;
    trace( 1, "Jacket::SendCommand($cmd)" );
    session_trace( "$cmd\n" );
    if (!$self->{'OUT'}) {
      trace( 0, "out socket is null.");
      $rc = 1;
    } else {
      if (! print {$self->{'OUT'}} $cmd . "\n") {
	trace( 0, "print failed.");
        $self->_Error( ERR_SENDCMD, 'cmd' => $cmd );
	$rc = 1;
      } else {
	$rc = 0;
      }
    }
    trace( -1, 'done Jacket::SendCommand(); 0' );
    return $rc;
}

###############################################################################
# Subroutine:   _getline ()
# Returns:      $buffer     - Line read in from user
###############################################################################
# INTERNAL METHOD.  Reads in a line of input from the user, using UNBUFFERED
# I/O.  We read things in until such a point that there is nothing left to read
# from the user or we have reached the end of a line.  This method has been
# split out from the '_ProcessOutput()' method as its only required when
# running under PerlSock on Win32.
###############################################################################
sub _getline
{
    my ($self) = @_;
    my $ch = '';
    my $buffer = '';
    my $count = 0;
    my $stdin = $self->{'IN'};
    trace( 1, "_getline()" );

    ###########################################################################
    # Keep reading until we decide we're done...
    ###########################################################################
    for (;;)
    {
        #######################################################################
        # Get one more char from the input...
        #######################################################################
        if ($count = sysread( $stdin, $ch, 1 ))
        {
            ###################################################################
            # Exit out if this is the EOL or EOF.
            ###################################################################
            last if (($ch eq "\n") || ($ch eq chr(255)));

            ###################################################################
            # Otherwise, add to our buffer unless its a CR
            ###################################################################
            $buffer .= $ch unless ($ch eq "\r");
            if ($buffer =~ /^  DB<+\d+>+ $/o)
            {
                trace( 0, "Found something that looks like a prompt string." );
                last;
            }
        }
        last if ($count == 0);
    }

    ###########################################################################
    # If we lost the connection (EOF) then choke hard.
    ###########################################################################
    die "Lost connection to remote script.\n" if ($ch eq chr(255));

    ###########################################################################
    # Prepare the buffer for return and send it back to the caller.
    ###########################################################################
    $buffer .= "\n" if ($ch eq "\n");   # Add back in any CR we stripped
    trace( -1, "done _getline(); $buffer" );
    return $buffer;
}

###############################################################################
# Subroutine:   _ProcessOutput ()
###############################################################################
# Processes the output which we've received from the remote debugger, filing
# away watch/proximity variables and raw results as needed.
###############################################################################
# UNFINISHED -> Could use some SERIOUS cleaning and documentation.
sub _ProcessOutput ()
{
    my ($self) = shift;
    my ($rtnval) = 0;
    my ($much_output);
    trace( 1, 'Jacket::_ProcessOutput()' );

    ###########################################################################
    # So long as we still have a connection, keep reading
    ###########################################################################
    my $fh_in = $self->{'IN'};
    while ($fh_in)
    {
        my ($outbits);

        #######################################################################
        # Based on whether we're connected via internal socket or PerlSock,
        # read some stuff in from the remote debugger.
        #######################################################################
        if (defined $self->{'_port'})
        {
            $fh_in->recv( $outbits, 1024 );
        }
        else
        {
            $outbits = $self->_getline();
        }
        trace( 0, "Rcvd: '$outbits'" );
        session_trace( $outbits );

        #######################################################################
        # If we didn't read anything in then quit (there's nothing left to
        # read).  Otherwise, add it to the list of stuff we've read in so far
        # and keep going...
        #######################################################################
        last if ($outbits eq "");  # can't use !$outbits because otherwise
	                           # Perl will interpret '0' as false!
        $much_output .= $outbits;

        #######################################################################
        # If we haven't been issued a prompt yet, keep reading...
        #######################################################################
        next if ($outbits !~ /  DB<+\d+>+\s*$/mo);
        trace( 0, 'Found prompt.' );

        #######################################################################
        # Ok, got a prompt, can start to parse out the results we were just
        # sent back...
        #######################################################################
        if ($outbits =~ /  DB<+\d+>+\s*$/m)
        {
            my (@output);
            push( @output, split( /\n/, $much_output ));
            pop @output;            # Don't need the prompt any more.
            my ($oneline) = shift @output;
            my ($first);
            trace( 0, 'Processing results...' );

            ###################################################################
            # We don't want to step into the DB:: package
            ###################################################################
            if ($oneline =~ /^DB::fake::\(/o)
            {
                trace( 0, 'Avoiding step into DB::fake:: package.' );
                $oneline = shift @output
            }

            ###################################################################
            # Read through everything we've been given before the line that's
            # about to be executed.  From this stuff we'll determine whether
            # or not the command we just executed was actually successful or
            # not.  While we're at it, if we've been told to capture the raw
            # data into somewhere, do that as well.
            ###################################################################
            $first = 1;
            until ( (!defined $oneline) ||
                    ($oneline =~ /^.+?::[^:]*?\(.+?:\d+\):/o) ||
                    ($oneline =~ /^ASRemote::/o)
                  )
            {
                my ($chokeon);
                foreach $chokeon (@process_errors)
                {
                    if ($oneline =~ /^$chokeon/)
                        { $rtnval = ERR_FAILEDCMD; }
                }

                if ($oneline =~ /Debugged program terminated/o)
                {
		    trace( 0, '===========================SCRIPT TERMINATED====================' );
                    trace( 0, 'Script terminated.' );
                    undef $self->{'module'};
                    undef $self->{'function'};
                    undef $self->{'linenum'};
                    undef $self->{'codeline'};
		    $self->Quit();
		    last;
#                    $self->_SendCommand("q");
#                    last;
                }

                if (defined $self->{'_captureraw'})
                {
                    trace( 0, 'Capturing raw output...' );
                    my $rawdst = $self->{'_captureraw'};
                    if ($first)
                    {
                        $first = 0;
                        undef $self->{ $rawdst };
                    }
                    else
                    {
                        $self->{ $rawdst } .= "\n";
                    }

                    $self->{ $rawdst } .= $oneline;
                }
                $oneline = shift @output;
            }

            ###################################################################
            # Try to get our location info out of the line sent back telling
            # us what line of code is about to be executed.  As well, clear all
            # of the proximity vars that we had (we've obviously moved to a new
            # line.
            ###################################################################
            if ($oneline =~ /^(.+)::(CODE\(0x[a-fA-F0-9]+\))\((.*):(\d+)\):(.*)$/o  # match anonymous functions
		or $oneline =~ /^(.+?)::([^:]*?)\((.+?):(\d+)\):(.*)$/o)            # match normal cases
            {
                $self->{'module'}   = $1;
                $self->{'function'} = $2;
                $self->{'filename'} = $3;
                $self->{'linenum'}  = $4;
                $self->{'codeline'} = $5;
                trace(  1, 'New location:' );
                trace(  0, 'Module...: ' . $self->{'module'} );
                trace(  0, 'Function.: ' . $self->{'function'} );
                trace(  0, 'Filename.: ' . $self->{'filename'} );
                trace(  0, 'Line Num.: ' . $self->{'linenum'} );
                trace( -1, 'Code Line: ' . $self->{'codeline'} );
                $oneline = shift @output;
                undef @{$self->{'_proximity'}};
                undef @{$self->{'_watched'}};
            }

            ###################################################################
            # Then, take any lines following this and add them to the
            # 'codeline' property; the code which is about to be executed on
            # the next step.
            #
            # Note that they might come as lines with a leading numeric OR they
            # might come as lines looking just as they did a moment ago when we
            # pulled out the module, filename, and line number.
            ###################################################################
	    ###GST###
	    trace( 0, 'OUTPUT: ' . join( "\n", $oneline, @output ) );
	    trace( 0, "Getting 'codeline' from '$oneline'" );
	    ###GST### END
            while ($oneline =~ /^\d+:\s*(.*?)$|^.+?::[^:]*?\(.+?:\d+\):\s*(.*?)$/o)
            {
                $self->{'codeline'} .= "\n$1";
                $oneline = shift @output;
            }
	    ###GST###
	    trace( 0, "Got codeline and now have '$oneline'" );
	    ###GST### END

            ###################################################################
            # Then, take care of any watched expressions or proximity vars.
            # Note that the proximity list is cleared above when we first
            # determined that we'd moved to a new line in the source file.
            ###################################################################
	    ###GST###
	    trace( 0, "Checking for watch/proximity in '$oneline'" );
	    ###GST### END
            while ($oneline =~ /^ASRemote::(\w+) +(\S+)\s+(.*)/o)
            {
                my ($type, $varname, $remainder) = ($1, $2, $3);
                my ($varval);
                my ($numquotes) = 0;
                my @quotedticks;
                trace( 0, 'Got a watch/proximity var to parse...' );

                $varval = $oneline . "\n";

                ###############################################################
                # Don't forget to catch possible quoting in scalar value.  We
                # make the regex to catch the number of quotes a var as we use
                # it in more than one place following here.
                ###############################################################
                my $quotregex = '(?<!\\\\)(\')';
                @quotedticks = ($remainder =~ m/$quotregex/go);
                $numquotes += scalar @quotedticks;

                while (scalar @output > 0)
                {
                    ###########################################################
                    # Keep track of whether or not we're inside a quoted string
                    ###########################################################
                    $oneline = shift @output;
                    @quotedticks  = ($oneline =~ m/$quotregex/go);
                    $numquotes += scalar @quotedticks;
		    ###GST###
		    #trace( 0, "\tGathering output..." );
		    #trace( 0, "\t\tOneline: \"$oneline\"" );
		    #trace( 0, "\t\tQuotedticks: \"@quotedticks\"" );
		    #trace( 0, "\t\tQuotedticks: " . scalar @quotedticks );
		    #trace( 0, "\t\tNumquot: $numquotes" );
		    ###GST### END
                    $varval .= $oneline . "\n";

                    last if (($oneline =~ /^\)$/o) and ($numquotes%2 == 0));
                }
		###GST###
		trace( 0, "\tGot variable in '$varval'" );
		###GST### END
                ###############################################################
                # Parse the value out of the string we've got.
                ###############################################################
                my $item = new ASRemote::Variable( $varval );
                if (!defined $item)
                {
                    die "Weren't able to parse the variable out of $varval\n";
                }
		###GST###
		trace( 0, "\tInstantiated object: value=" . $item->{'scalar'} );
		###GST### END

                ###############################################################
                # Hang on to the value of this expression.
                ###############################################################
                if ($type eq 'Watch')
                {
                    trace( 0, 'Was a watched variable.' );
                    push( @{$self->{'_watched'}}, $item );
                }
                elsif ($type eq 'Proximity')
                {
                    trace( 0, 'Was a proximity variable.' );
                    push( @{$self->{'_proximity'}}, $item );
                }
                else
                {
                    trace( 0, "Unknown variable type: $type" );
                    die "Unknown variable type: $type\n";
                }

                ###############################################################
                # Get the next line we should be working with.
                ###############################################################
                $oneline = shift @output;
		###GST###
		trace( 0, "Next line to check for watch/prox: '$oneline'" );
		###GST### END
            } # end of 'while ($oneline=~/ASRemote...'

            ###################################################################
            # Shouldn't have anything left (hopefully)
            ###################################################################
            last;
        } # end of 'if we just hit a prompt'
	###GST###
	###GST### Should this be here (inside the loop), rather than below?
	$self->_ExpandAsNeeded();
	###GST### END
    } # end of (while $self->{'_conn'})

    ###########################################################################
    # Expand out the watch/proximity variables as needed.
    ###########################################################################
    $self->_ExpandAsNeeded();

    ###########################################################################
    # If we lost the connection to the remote, we need to fail
    ###########################################################################
    if (!$self->{'IN'})
    {
        my $rc = $self->_Error( ERR_LOSTCONN );
        trace( -1, "Lost connection; done Jacket::_ProcessOutput(); $rc" );
        return $rc;
    }

    ###########################################################################
    # Return to the caller, letting him know whether we were successful or not.
    ###########################################################################
    if ($rtnval) { $rtnval = $self->_Error( $rtnval ); }
    trace( -1, "done Jacket::_ProcessOutput(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Define the error messages we can output, and the parameters which they take.
###############################################################################
my %error_msgs = (
    ERR_BADSOCK()   => q{ 'Could not open socket on port ' .
                          $params{'port'}
                        },
    ERR_BADCONN()   => q{ 'Could not open connection to remote host on port ' .
                          $params{'port'}
                        },
    ERR_PROXSIZE()  => q{ 'Proximity window size of ' .
                          $params{'before'} . ' by ' $params{'after'} .
                          ' is invalid'
                        },
    ERR_INVARGS()   => q{ 'Invalid number arguments given to the ' .
                          $params{'method'} . ' method'
                        },
    ERR_CLOSECONN() => q{ 'Unable to close connection to remote host' },
    ERR_CLOSESOCK() => q{ 'Unable to close socket to remote host' },
    ERR_SENDCMD()   => q{ 'Unable to send command to remote debugger' },
    ERR_FAILEDCMD() => q{ 'Command sent to remote debugger failed' },
    ERR_LOSTCONN()  => q{ 'Lost connection to ' . $params{'host'} },
    ERR_FTPCONN()   => q{ 'Could not connect to ' .  $params{'host'} .
                          ' via FTP'
                        },
    ERR_FTPLOGIN()  => q{ 'Could not log in to ' .  $params{'host'} .
                          ' via FTP'
                        },
    ERR_FTPXFER()   => q{ 'Could not transfer ' .  $params{'filename'} .
                          ' to/from '.  $params{'host'} .  ' via FTP'
                        },
    ERR_FTPQUIT()   => q{ 'Could not close FTP session connected to ' .
                          $params{'host'}
                        },
    ERR_GETSCRIPT() => q{ 'Could not get remote file ' . $params{'filename'} },
    ERR_OPENFILE()  => q{ 'Could not open local file ' . $params{'filename'} },
    ERR_BADEXPAND() => q{ 'Could not expand ' . $params{'type'} .
                          ' expression "' . $params{'name'} . '"'
                        },
    );

###############################################################################
# Subroutine:   _Error ($error, %params)
# Parameters:   $error  - Error code describing the type of error that occurred
#               %params - Parameters for the error message (message specific)
###############################################################################
# Builds the current error value based on the information in the hash shown
# above, and the parameters passed to the method.  It's been localized in this
# way in case we ever need to change the error messages; just update the hash
# or add new values to it and we'll have new/updated error messages.
#
# When complete, this method returns the given error code _back_ to the caller.
###############################################################################
sub _Error ($%)
{
    my ($self) = shift;
    my ($error) = shift;
    my (%params) = @_;
    trace( 1, 'Jacket::_Error()' );

    ###########################################################################
    # Get the error text for the given error that occurred.  We do the 'eval'
    # so that we can also substitute in the values that were present in the
    # error messages shown above.
    ###########################################################################
    $self->{'error_text'} = (eval $error_msgs{ $error });

    ###########################################################################
    # If we weren't able to find an error message, create one stating that we
    # don't know what error occurred; no message for it.
    ###########################################################################
    if (!defined $self->{'error_text'})
    {
        $self->{'error_text'} = "Unknown error condition: $error";
    }
    else
    {
        $self->{'error_text'} .= '.';
    }

    trace( -1, "done Jacket::_Error(); $error" );
    return $error;
}

###############################################################################
# Subroutine:   GetScript ($script_name, $local_file)
# Parameters:   $script_name    - Name of script/module on remote system to get
#               $local_file     - Name of file to store in locally
###############################################################################
# Gets a script or an eval block from the remote system as a chunk of code and
# dumps it into a file on the local system.
###############################################################################
sub GetScript ($$)
{
    my ($self) = shift;
    my ($script_name, $local_file) = @_;
    my $readcmd;
    my $rtnval;
    trace( 1, "Jacket::GetScript('$script_name', '$local_file')" );

    ###########################################################################
    # Check to see if we've been given all the right args
    ###########################################################################
    if (($script_name eq '') or ($local_file eq ''))
    {
        $rtnval = $self->_Error( ERR_INVARGS, 'method' => 'GetScript()' );
        trace( -1, "Invalid args; done Jacket::GetScript(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Figure out if we're supposed to be getting a file or an eval block; they
    # use different extensions which we've sent down to the remote debugger.
    ###########################################################################
    if ($script_name =~ /^\(eval \d+\)$/io)
        { $readcmd = "DB::ASRemote::dumpEval('$script_name')"; }
    else
        { $readcmd = "DB::ASRemote::dumpFile('$script_name')"; }

    ###########################################################################
    # Execute the command to dump the file and get the information back from
    # the remote debugger.
    ###########################################################################
    $self->{'_captureraw'} = '_retrieved_script';
    $rtnval = ($self->_SendCommand( $readcmd ) ||
               $self->_ProcessOutput()
               );
    undef $self->{'_captureraw'};
    trace( 0, 'Got script as raw.' );

    ###########################################################################
    # If we managed to get something successfully, dump it out to a local
    # file.  Otherwise, generate an error message and choke.
    ###########################################################################
    if (!$rtnval)
    {
        open( FH, ">$local_file" ) ||
            return $self->_Error( ERR_OPENFILE, 'filename' => $local_file );
        print FH $self->{'_retrieved_script'};
        close( FH );
    }
    elsif ($rtnval == ERR_FAILEDCMD)
    {
        $rtnval = $self->_Error( ERR_GETSCRIPT, 'filename' => $script_name );
        trace( -1, "Failed to get script; done Jacket::GetScript(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Clean up the scratch space we used, and return.
    ###########################################################################
    undef $self->{'_retrieved_script'};
    trace( -1, "done Jacket::GetScript(); $rtnval" );
    return $rtnval;
}


###############################################################################
# Subroutine:   PutFile ( local_file, remote_host, username, password,
#               remote_file )
# Parameters:   local_file      - File on local system to FTP over
#               remote_host     - Host to FTP the file to
#               username        - Username to log in with
#               password        - Password to log in with
#               remote_file     - Full path to file on remote system
###############################################################################
# Puts a given file onto a remote server using FTP.
###############################################################################
sub PutFile ($$$$$)
{
    my ($self) = shift;
    my ($local_file, $remote_host, $username, $password, $remote_file) = @_;
    my $rtnval = 0;
    trace( 1, 'Jacket::PutFile()' );

    ###########################################################################
    # Check to make sure we were given all the required parameters.
    ###########################################################################
    if ( (!defined $local_file)  ||
         (!defined $remote_host) ||
         (!defined $username)    ||
         (!defined $password)    ||
         (!defined $remote_file)
       )
    {
        $rtnval = $self->_Error( ERR_INVARGS, 'method' => 'PutFile()' );
        trace( -1, "Invalid args; done Jacket::PutFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Create the connection to the remote host, choking if unable
    ###########################################################################
    my ($ftpconn) = new Net::FTP( $remote_host );
    if (!defined $ftpconn)
    {
        $rtnval = $self->_Error( ERR_FTPCONN, 'host' => $remote_host );
        trace( -1, "Unable to connect via FTP; done Jacket::PutFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Log in to the remote server.
    ###########################################################################
    if (!$ftpconn->login( $username, $password ))
    {
        $rtnval = $self->_Error( ERR_FTPLOGIN, 'host' => $remote_host );
        trace( -1, "Unable to login via FTP; done Jacket::PutFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Put the file onto the remote server.
    ###########################################################################
    if (!$ftpconn->put( $local_file, $remote_file ))
    {
        $rtnval = $self->_Error( ERR_FTPXFER,
                                 'host' => $remote_host,
                                 'filename' => $local_file );
        trace( -1, "Unable to put file; done Jacket::PutFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Shut down the connection
    ###########################################################################
    if (!$ftpconn->quit())
    {
        $rtnval = $self->_Error( ERR_FTPQUIT, 'host' => $remote_host );
        trace( -1, "Unable to close FTP; done Jacket::PutFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Done!
    ###########################################################################
    trace( -1, "done Jacket::PutFile(); $rtnval" );
    return $rtnval;
}

###############################################################################
# Subroutine:   GetFile ( local_file, remote_host, username, password,
#               remote_file )
# Parameters:   local_file      - File on local system
#               remote_host     - Host to FTP the file to
#               username        - Username to log in with
#               password        - Password to log in with
#               remote_file     - Full path to file on remote system to get
###############################################################################
# Gets a given file from a remote server using FTP.
###############################################################################
sub GetFile ($$$$$)
{
    my ($self) = shift;
    my ($local_file, $remote_host, $username, $password, $remote_file) = @_;
    my $rtnval = 0;
    trace( 1, 'Jacket::GetFile()' );

    ###########################################################################
    # Check to make sure that we were given all the required parameters
    ###########################################################################
    if ( (!defined $local_file)  ||
         (!defined $remote_host) ||
         (!defined $username)    ||
         (!defined $password)    ||
         (!defined $remote_file)
       )
    {
        $rtnval = $self->_Error( ERR_INVARGS, 'method' => 'GetFile()' );
        trace( -1, "Invalid args; done Jacket::GetFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Create the connection to the FTP server, choking if unable
    ###########################################################################
    my ($ftpconn) = new Net::FTP( $remote_host );
    if (!defined $ftpconn)
    {
        $rtnval = $self->_Error( ERR_FTPCONN, 'host' => $remote_host );
        trace( -1, "Unable to connect via FTP; done Jacket::GetFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Log in to the FTP server
    ###########################################################################
    if (!$ftpconn->login( $username, $password ))
    {
        $rtnval = $self->_Error( ERR_FTPLOGIN, 'host' => $remote_host );
        trace( -1, "Unable to login via FTP; done Jacket::GetFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Get the file from the remote end and put it locally
    ###########################################################################
    if (!$ftpconn->get( $local_file, $remote_file ))
    {
        $rtnval = $self->_Error( ERR_FTPXFER,
                                 'host' => $remote_host,
                                 'filename' => $local_file );
        trace( -1, "Unable to get file via FTP; done Jacket::GetFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Shut the connection down
    ###########################################################################
    if (!$ftpconn->quit())
    {
        $rtnval = $self->_Error( ERR_FTPQUIT, 'host' => $remote_host );
        trace( -1, "Unable to close FTP; done Jacket::GetFile(); $rtnval" );
        return $rtnval;
    }

    ###########################################################################
    # Done!
    ###########################################################################
    trace( -1, "done Jacket::GetFile(); $rtnval" );
    return $rtnval;
}


1;

###############################################################################
# POD documentation follows.
###############################################################################

__END__;

=head1 NAME

ASRemote::Jacket - Debugging Jacket for use within Visual Perl

=head1 SYNOPSIS

    use ASRemote::Jacket;
    my ($jacket) = new ASRemote::Jacket();

=head1 DESCRIPTION

C<ASRemote::Jacket> provides an object interface to a debugging session
executed on a remote machine.  Methods are provided to direct the debugging
process as well as to query the state of the script being debugged.

=head1 CONSTRUCTOR

=over 4

=item new ( $port )

Creates a C<ASRemote::Jacket>, which is a reference to a newly created object.
A single optional argument is taken; the port to listen on for scripts asking
to be debugged.  If no port argument is given, port 2000 will be used as a
default.  Note that the constructor does not create the socket connection to
the remote debugging script, you must call C<Listen()> in order to have the
socket created.

=back

=head1 METHODS

=over 4

=item Listen ()

Creates a socket connection and waits for a connection on it.  Once a
connection to a remote debugger has been established, any extensions required
by the Jacket module are downloaded to the remote debugger, and initial
headers provided by the debugger are removed.  This method returns zero if
successful, and a non-zero error code if any errors occurred.

=item ProximityWindow ( $before, $after )

Sets the size of the proximity window to include the given number of lines
before and after the current line.  The proximity window will be used to
determine which variables are in near proximity and can be queried to see
their current values.  By default, the proximity window is set to include
the four lines previous, and five lines after the current line.  Values given
for C<$before> and C<$after> B<must> be positive integer numbers.  This method
returns zero if successful, and a non-zero error code if some error occurred.

=item SetWatch ( $expression )

Sets 'C<$expression>' to be an expression which is watched.  This method
returns zero if it was able to set the watch, and a non-zero error code if some
error occurred.  When a watch is set on an expression, the values of all of the
watched expressions are re-queried so that we immediately have access to the
value of the expression we just put a watch on.

=item RemoveWatch ( $expression )

Removes 'C<$expression>' from being a watched expression.  The value given
should be an expression which was previously watched using the C<SetWatch()>
method.  If the expression that is to be removed is B<not> currently being
watched, this method fails silently, not returning an error condition.  This
method returns zero if it was able to remove the watch and a non-zero error
code if some error occurred.

=item Expand ( $expansion )

Expands a watch/proximity variable.  The value given for 'C<$expansion>' should
be the value of the 'C<expandable>' property of the C<ASRemote::Variable>
object which we want to expand.  This method returns zero if it was able to
expand the watch/proximity variable, and a non-zero error code if some error
occurred.  Note that any expansions which are set at a sub-level will remain
expanded if the parent variable is collapsed and then expanded again.

=item Collapse ( $expansion )

Collapses a watch/proximity variable.  The value given for 'C<$expansion>'
should be the value of the 'C<expandable>' property of the
C<ASRemote::Variable> object which we want to collapse.  This method always
returns successfully; it simply updates our list of expansions and repopulates
the list of expanded watch/proximity variables.

=item SetBreakpoint ( $where, $condition )

Sets a breakpoint in the remote script being debugged.  The value of C<$where>
can be either a line number within a file (if none given, assumed to be the
current file), or it can be the name of a subroutine to break on (e.g. 6,
"CGI.pm:244", "CGI::new").  The value of C<$condition> can be any expression
to determine returning 1 if the break should happen.  This method returns zero 
if it was able to set the breakpoint, and a non-zero error code if some error 
occurred.

=item RemoveBreakpoint ( $where )

Removes a breakpoint in the remote script being debugged.  The value of
C<$where> must be a line number within a file (if none given, assumed to be the
current file) (e.g. 6, "CGI.pm:244").  If a breakpoint is to be removed which
has not yet been set, this method fails silently and does not return an error
condition.  A list of the current breakpoints are available in the
C<breakpoints> property of the Jacket module.  This method returns zero if it
was able to remove the breakpoint, and a non-zero error code if some error
occurred.

=item ClearBreakpoints ()

Clears all currently set breakpoints.  This method returns zero if it was able
to clear all of the breakpoints, and a non-zero error code if some error
occurred.

=item Step ()

Single steps through the script being debugged, with steps taken such that they
will step into any encountered subroutines.  This method returns zero if
successful, and a non-zero error code if some error occurred.

=item StepOver ()

Steps through the script being debugged, with steps taken such that they will
step over any encountered subroutines. This method returns zero if successful,
and a non-zero error code if some error occurred.

=item ReturnFromSub ()

Runs the script until it returns from the current subroutine.  This method
returns zero if successful, and a non-zero error code if some error occurred.
The value which is returned by the remote debugger as the return value from the
subroutine is parsed as a C<ASRemote::Variable> object and is placed within our
'C<return>' property.

=item RunUntil ( $where )

Runs the script being debugged until either some previously set breakpoint is
reached or C<$where> is reached.  The value of C<$where> can be any of the
following:

    - Line number in current file (e.g. "13")
    - Subroutine name (e.g. "foo::bar", "bar")
    - Line number in a different file (e.g. "foo.pl:31")

If no value is given for C<$where>, the script being debugged will run until
either a previously set breakpoint has been reached or the script terminates.
This method returns zero if successful, and a non-zero error code if some
error occurred.

=item QuickEval ( $expression )

Performs an C<eval> on the provided expression, in the context of the script
being debugged.  Results from the evaluation will be placed into the
'C<result>' property of this object, in a scalar context.  This method returns
zero if successful, and a non-zero error code of some error occurred.

=item Quit ()

Quits the current debugging session, and closes down the socket to the remote
script being debugged.  This method returns zero if successful, and a non-zero
error code if some error occurred.

=item GetScript ( $script_name, $local_file )

Gets a script from the remote system (e.g. 'require'd module) and dumps it to
a local file.  C<$script_name> can be either the name of a script/module (e.g.
"CGI.pm") or the name of an eval block (e.g. "(eval 3)").  Note that files can
only be retrieved which have been loaded into the Perl debugger, and that eval
blocks can only be retrieved if they're currently in scope.  Attempts to get
arbitrary files or non-existant eval blocks will fail.  This method returns
zero on success, and a non-zero error code if some error occurred.

=item PutFile ( $local_file, $remote_host, $username, $password, $remote_file )

Puts a file onto a remote system using FTP.  C<$local_file> is the file on the
local system which is to be put on the remote.  C<$remote_host> is the name or
IP address of the remote host to be sending to.  C<$username> and C<$password>
are the username and password to log into the remote system with.
C<$remote_file> is the full path to the location of the file on the remote
system.  This method returns zero if it was able to put the file onto the
remote system, and a non-zero error code if any errors occurred.

=item GetFile ( $local_file, $remote_host, $username, $password, $remote_file )

Gets a file from a remote system using FTP.  The parameters for this method are
exactly the same as they are for the C<PutFile()> method.  This method returns
zero if it was able to get the file from the remote system, and a non-zero
error code if any errors occurred.

=back

=head1 PROPERTIES

=over 4

=item watched

List of C<ASRemote::Variable> objects, containing the expanded versions of all
of our currently watched expressions.

=item proximity

List of C<ASRemote::Variable> objects, containing the expanded versions of all
of the variables currently within proximity.

=item result UNFINISHED

Result of last C<QuickEval()>, in a scalar context.

=item return

Result of last C<ReturnFromSub()>, as a C<ASRemote::Variable> object.

=item filename

Name of the file that is currently being debugged.

=item module

Name of the module that is currently being debugged.

=item function

Name of the function that is currently being debugged.

=item linenum

Line number in the current file being debugged.  Note that the line number is
of the B<next> line to be executed, B<not> the line that B<was> just executed.

=item codeline

Line of code that is about to be executed upon the next step.  This is the line
of code which begins at the current line number, and could span multiple lines
within the source.

=item error_text

Text description of the B<last> error that occurred.  Note that this value is
never cleared, even after calling methods which are successful; do not use it
as a replacement for checking your return values.

=item breakpoints

Hash of breakpoints and conditions which are currently set.  Each key item is 
in the form of "filename:line_number" (e.g. "foo.pl:13"). The values are the
cnditions.

=back

=head1 INTERNAL METHODS/PROPERTIES

The following methods are used internally to the C<ASRemote::Jacket> module and
should not be called.  They are documented primarily for developmental
purposes.  For clarity, all internal methods are prefixed by an B<_> character.

=over 4

=item _SendCommand ( $command )

Sends a raw command to the remote debugger.  The command given will be sent
directly to the Perl debugger on the remote host for execution.  This method
returns zero if successful, and a non-zero error code if any errors occurred.

=item _ProcessOutput () UNFINISHED

Obtains and processes any output generated by the debug script running on the
remote host.  After processing, any internal counter, properties or variables
will be up to date as per information received from the remote host.  This
method returns zero if succesful, and a non-zero error code if any errors
occurred.

=item _InitDebugger ()

Initializes the remote C<perl5db.pl> debugging script by downloading to it any
additional extensions we may wish to add.  This method returns zero if
successful, and a non-zero error code if any errors occurred.

=item _UpdateBreakpoints ()

Updates the C<breakpoints> property of the C<Jacket> object with the current
breakpoints as determined by the remote debug script.  Does this by asking the
remote debugger what the breakpoints are and then parsing the output which it
provides.  Returns zero if successful, and a non-zero error code if any errors
occurred.

=item _ExpandAsNeeded ()

Expands out the list of watch and proximity variables, repopulating the
'C<watched>' and 'C<proximity>' properties.  The list of expansions to be
performed will be taken from the 'C<_expansions>' property.

=item _Error ( $error_code, %parameters )

Sets the value of the C<error_text> property for a given error code.  Each
error code has it's own set of parameters which can be used to add more
information to the resulting error string.  This method returns the value of
the given error code.

=item _captureraw

If set to some value, this property contains the name of the property into
which raw data is to be placed when received back from the remote debug script.
This property can be used for debugger commands that require specific parsing
outside of the "normal" scope of C<ProcessOutput()> by requiring that method
to understand the type of output that is to be received.  If this property is
undefined, no raw data is captured.

=item _expansions

A list of the expansions which we are currently supposed to be doing.  The
values contained in this list are the values we've received from any call to
C<Expand()>.

=item _watched

Internal list of all of the currently watched expressions, B<fully> expanded.
We use this list to copy values over to the 'C<watched>' property whenever an
expression is expanded in that list.

=item _proximity

Internal list of all of the current proximity variables, B<fully> expanded.  We
use this list to copy values over to the 'C<proximity>' property whenever a
variable is expanded in that list.

=item trace ($indent, $msg)

Outputs a trace message to a user-defined trace log file.  If 'C<$TraceFile>'
is undefined (default) then no tracing is recorded.

=item session_trace ($msg)

Outputs a trace on the session with the remote debugger.  If
'C<$SessionTraceFile>' is undefined (default) then no tracing is recorded.

=back

=head1 TRACING THE JACKET

By setting a value for the C<$ASRemote::Jacket::TraceFile> variable, the
Jacket will dump tracing information to that file.  This trace file can be used
to help debug unusual situations in which you feel that the Jacket itself is
buggy or not working as expected.  Note, however, that a B<large> volume of
trace information is dumped to this file.

As well, a dump of the entire communications between the Jacket and the remote
debugger can be dumped to a trace file by setting the value of the
C<$ASRemote::Jacket::SessionTraceFile> variable.  This trace file is useful for
recording the entire transcript of a debugging session for later analysis and
evaluation.

=head1 NOTES

=over 4

=item Default port number

Default port number used to listen on is port B<2000>.

=item Default proximity window size

Default proximity window includes the B<four> lines previous and B<five> lines
after the current line.  As well, note that the minimum size for the proximity
window is B<one> line before and after the current line pointer.

=back

=head1 AUTHORS

Graham TerMarsch <gtermars@home.com>

Doug Lankshear <dougl@activestate.com>

Dick Hardt <dickh@activestate.com>

=cut
