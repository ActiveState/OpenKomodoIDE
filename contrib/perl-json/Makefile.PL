require 5.00503;
use strict;
use ExtUtils::MakeMaker;

use lib qw( ./lib );

$| = 1;

eval q| require JSON |;

# B module can't install? I'm not careful for such a problem.
# Leave us alone today?
if ($@) {
    print "We try to look up lib/JSON.pm, but in vain. B module can't install?\n";
    print "Set the environmental variable 'PERL_DL_NONLAZY' with 0.\n";
    print "And see to ExtUtils::MM_Unix.\n";
    print "perl says : $@";
    print "We do not make Makefile by requiring Perl version 7.0.\n";
    require 7.0000;
}


my $version     = JSON->VERSION;
my $req_xs_ver  = JSON->require_xs_version;
my $has_xs      = 0;
my $xs_ver_is_ok;
my $message;

eval q| require JSON::XS |;

$has_xs = 1 unless ($@);


if ($has_xs) {
    my $xs_version = JSON::XS->VERSION;
    if ($xs_version >= $req_xs_ver) {
        $message = "You have JSON::XS (v.$xs_version), so JSON can work very fast!!";
        $xs_ver_is_ok++;
    }
    else {
        $message = "Your JSON::XS version is $xs_version, but if you install v.$req_xs_ver,\n"
                 . "JSON will work faster.";
    }
}
else {
    $message = "If you install JSON::XS v.$req_xs_ver, it makes JSON faster.";
}

print <<EOF;
Welcome to JSON (v.$version)
=============================
$message

 ************************** CAUTION **************************
 * This is 'JSON version 2' and there are many differences   *
 * to version 1.xx                                           *
 * Please check your applications useing old version.        *
 *   See to 'INCOMPATIBLE CHANGES TO OLD VERSION' and 'TIPS' *
 *************************************************************


EOF

sleep 2;

my @prereq_pm;

if ( can_auto_xs_install() and not $xs_ver_is_ok ) {

    my $prompt = prompt("Do you want to install JSON::XS?(Y/n)", 'Y');

    if ( $prompt =~ /^[yY]/ ) {
        @prereq_pm = ( 'JSON::XS' => $req_xs_ver );
    }

}


WriteMakefile(
    'NAME'          => 'JSON',
    'VERSION_FROM'  => 'lib/JSON.pm', # finds $VERSION
    'PREREQ_PM'     => {
              'Test::More'  => 0,
              @prereq_pm,
    },
    ($] >= 5.005 ?    ## Add these new keywords supported since 5.005
      (ABSTRACT_FROM => 'lib/JSON.pm', # retrieve abstract from module
       AUTHOR     => 'Makamaka Hannyaharamitu, E<lt>makamaka[at]cpan.orgE<gt>') : ()),
    ( $ExtUtils::MakeMaker::VERSION >= 6.3002 ? ('LICENSE' => 'perl', ) : () ),

    ( $ExtUtils::MakeMaker::VERSION >= 6.46 ? (
        'META_MERGE' => {
            resources => {
                repository  =>      'http://github.com/makamaka/JSON',
            },
        } ) : ()
    ),
);


if ($] < 5.006) { # I saw to http://d.hatena.ne.jp/asakusabashi/20051231/p1 
    open(IN, "Makefile");
    open(OUT,">Makefile.tmp") || die;
    while(<IN>) {
        s/PERL_DL_NONLAZY=1//g;
        print OUT;
    }
    close(OUT);
    close(IN);
    rename("Makefile.tmp" => "Makefile");
}




sub can_auto_xs_install {
    return 0 if $] < 5.008002; # JSON::XS requires
    return 0 unless ( $ENV{PERL5_CPAN_IS_RUNNING} or $ENV{PERL5_CPANM_IS_RUNNING} ); # not cpan/cpanm running
    return can_cc();
}


# copied from http://cpansearch.perl.org/src/GBARR/Scalar-List-Utils-1.23/Makefile.PL

use Config;


sub can_cc {

    require File::Spec;

    foreach my $cmd (split(/ /, $Config::Config{cc})) {
        my $_cmd = $cmd;

        return $_cmd if (-x $_cmd or $_cmd = MM->maybe_command($_cmd));

        for my $dir ((split /$Config::Config{path_sep}/, $ENV{PATH}), '.') {
            my $abs = File::Spec->catfile($dir, $_[1]);
            return $abs if (-x $abs or $abs = MM->maybe_command($abs));
        }
    }

    return;
}
