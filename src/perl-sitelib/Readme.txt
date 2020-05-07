Differences between the Komodo versions of these files and others:

perl5db.pl -- changed new IO::Socket::INET Timeout from 10 to 2000
  -- This lets us spawn the perl5db.pl datasource first in the
     background, then set up the jacket service, and finally have
     the perl5db.pl datasource connect to it.

NET/Cmd.pm, Config.pm, FTP.pm
  -- No differences.  These aren't part of standard Perl (as of 5.6)

ASRemote/Jacket.pm, Variable.pm
  -- No differences.  These aren't part of standard Perl (as of 5.6).
    
  -- We assume that the AS PDK hasn't been installed.

Assume Komodo=<location of .../chrome/packages/komodo/komodo/content>

To access these files, set the environment variable

PERL5LIB="$PERL5LIB:$Komodo/perl" (or "$Komodo/perl" if PERL5LIB is undefined)
PERLLIB="$PERLLIB:$Komodo/perl"   (or "$Komodo/perl" if PERLLIB is undefined)





