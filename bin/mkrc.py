#!/usr/bin/env python
# Copyright (c) 2006-2009 ActiveState Software Inc.

r"""Make a Komodo RC, i.e. copy the bits from the latest release-branch
Komodo IDE and Edit devbuilds to a "RC#" release candidate dir on the file share
(NAS).

Here is how a Komodo RC works:

- Release builds of Komodo are done on the latest "release branch" by this
  buildbot:
    http://i.activestate.com/buildbots/komodorelease/
  Currently these must be started manually via
    http://i.activestate.com/buildbots/komodorelease/rc
  A "release branch" is a branch (in both the Komodo IDE and Edit svn repos)
  with a name matching the version pattern "N.N.N[a|bN]" -- for example "5.2.1",
  "6.0.0a1".
  
  These builds end up here:
    http://komodo.nas1.activestate.com/builds/$version/DevBuilds/$repo-$branch-$rev
  For example, a Komodo IDE 5.2.0a1 build from the "5.2.0a1" release branch:
    http://komodo.nas1.activestate.com/builds/5.2.0a1/DevBuilds/assvn-5.2.0a1-30610/
  and the matching Komodo Edit build:
    http://komodo.nas1.activestate.com/builds/5.2.0a1/DevBuilds/oksvn-5.2.0a1-3810/

- This script is run to create an RC directory (where 'N' is the next available
  RC number, starting from 1):
    http://komodo.nas1.activestate.com/builds/5.2.0a1/RCN
  for example:
    http://komodo.nas1.activestate.com/builds/5.2.0a1/RC1
  By default this merges the bits from the latest Komodo IDE and Edit builds
  on the latest release branch.
"""

__version_info__ = (2, 0, 0)
__version__ = '.'.join(map(str, __version_info__))

import os
from os.path import exists, join, basename, expanduser, dirname, normpath, isdir
from posixpath import join as ujoin
from posixpath import basename as ubasename
from posixpath import dirname as udirname
from posixpath import normpath as unormpath
import sys
import re
from pprint import pprint
from glob import glob
import traceback
import logging
import optparse
import urllib
import tempfile
import socket
import bisect

sys.path.insert(0, join(dirname(__file__), "..", "util"))
import kopkglib
import buildutils
del sys.path[0]



#---- exceptions

class Error(Exception):
    pass




#---- globals

ANNOUNCE_EMAIL_HEADERS = {
    "To": ["qa@activestate.com"],
    "Cc": ["dev-komodo@activestate.com"],
}

KD_URL_FROM_MAJORDOTMINOR_VERSION = {
    "10.1": "http://komodoide.com/changelog/latest/",
    "10.2": "http://komodoide.com/changelog/latest/",
    "11.0": "https://zube.io/komodo/komodo/w/workspace/kanban",
    "11.1": "https://github.com/Komodo/KomodoEdit/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A11.1+",
    "12.0": "https://www.pivotaltracker.com/n/projects/2203557/search?q=includedone%3Atrue%20label%3A%22ide%20integration%22",
}

AS_SLACK_WEBHOOK_URL = os.getenv("AS_SLACK_WEBHOOK_URL")

ANNOUNCE_TEMPLATE = '''
Download installers bits here:

%(rc_url)s

What's new in %(short_ver)s:

<%(kd_url)s>

Build Master: %(builder)s
'''

#---- module API

class _BuildInfo(object):
    """Info on a particular Komodo build."""
    def __init__(self, proj, pkg_prefix, log_prefix, short_ver, rev,
            devbuild_dir, platnames=None, exclude_auto_update=False):
        self.proj = proj
        self.pkg_prefix = pkg_prefix
        self.log_prefix = log_prefix
        self.short_ver = short_ver
        self.major_ver = int(short_ver.split('.', 1)[0])
        self.minor_ver = int(short_ver.split('.', 2)[1])
        self.major_dot_minor_ver = "%s.%s" % (self.major_ver, self.minor_ver)
        long_ver = short_ver.replace("a", "-alpha").replace("b", "-beta").replace("c", "-rc")
        self.pkg_ver = "%s-%s" % (long_ver, rev)
        self.devbuild_dir = devbuild_dir
        self.exclude_auto_update = exclude_auto_update
        if platnames is None:
            self.platnames = set([
                "win32-x86",
                "macosx-x86_64",
                "linux-x86",
                "linux-x86_64",
            ])
        else:
            self.platnames = platnames

def mkrc(branch="rel", ide_revision=None, edit_revision=None, dry_run=False,
         skip_announcement=False, exclude_edit=False,
         exclude_auto_update=False, force_release=False):
    """Put together a Komodo RC directory/

    @param branch {str} Source tree branch whose builds to use.
        ("rel" is default, meaning the latest release branch).
    @param ide_revision {int} The IDE devbuild revision to use. If not given
        the latest available is used.
    @param edit_revision {int} The Edit devbuild revision to use. If not given
        the latest available is used.
    @param dry_run {boolean} do a dry-run
    @param skip_announcement {boolean} Skip sending announcement email.
    @param exclude_edit {boolean} Exclude Komodo edit bits.
    @param exclude_auto_update {boolean} Ignore auto update bits.
    @param force_release {boolean} Make rc with whatever bits it can find.
    """
    if branch == "rel":
        branch = kopkglib.latest_release_branch()
    log.info("mkrc (`%s' branch)", branch)

    # Determine the DevBuild dirs to use.
    # Buildbots get their version from the version file.  Why would we get it
    # from somewhere else?  Just make sure you're on the same branch
    log.info("Retrieving version from src/version.txt")
    ver = file(join(dirname(dirname(__file__)), "src", "version.txt")).read().strip()
    ver = kopkglib.short_ver_from_branch(branch)
    log.info("Using version %s to construct build search path" %ver)
    ide_devbuild_dir = kopkglib.get_devbuild_dir(ver, "assvn", branch, ide_revision)
    log.info("   IDE bits: %s", ide_devbuild_dir)
    if not exclude_edit:
        edit_devbuild_dir = kopkglib.get_devbuild_dir(ver, "oksvn", branch, edit_revision)
        log.info("  Edit bits: %s", edit_devbuild_dir)

    # Get the RC manifest.
    log.info("generate manifest")
    ide_build = _BuildInfo("komodoide", "Komodo-IDE", "komodo_ide", "ide",
        ver, int(ide_devbuild_dir.rsplit('-', 1)[1]), ide_devbuild_dir,
                           exclude_auto_update=exclude_auto_update)
    # Bring this back if we have internal, version specific release info
    # if ide_build.major_dot_minor_ver not in KD_URL_FROM_MAJORDOTMINOR_VERSION:
    #     log.error("Missing feature notes URL.  Please edit bin/mkrc.py."
    #               "\n\tAdd %s (major.minor) version to 'KD_URL_FROM_MAJORDOTMINOR_VERSION' "
    #               "dictionary with appropriate URL.", ide_build.major_dot_minor_ver)
    #     return
    if exclude_edit:
        edit_build = None
    else:
        edit_build = _BuildInfo("komodoedit", "Komodo-Edit", "komodo_edit", "edit",
            ver, int(edit_devbuild_dir.rsplit('-', 1)[1]), edit_devbuild_dir,
                                exclude_auto_update=exclude_auto_update)
    builds = [ide_build]
    if edit_build is not None:
        builds.append(edit_build)
    rc_manifest = get_rc_manifest(builds)
    #pprint(rc_manifest)

    # Make sure we have all the bits we expect.
    log.info("ensure have all expected bits")
    missing_bits = []
    for dst_relpath, src_dir in rc_manifest:
        src_path = ujoin(src_dir, ubasename(dst_relpath))
        if buildutils.is_remote_path(src_path):
            if not buildutils.remote_exists(src_path):
                missing_bits.append(src_path)
        else:
            if not exists(src_path):
                missing_bits.append(src_path)
    if missing_bits:
        if force_release:
            print("Some expected bits destined for the RC dir are missing:\n%s"
                  % _indent('\n'.join(missing_bits)))
            if not dry_run:
                answer = raw_input("\nMissing bits - are you sure you wish to "
                                   "create this rc [y/N]? ")
                if answer.lower() not in ("y", "yes"):
                    print("mkrc aborted")
                    return
        else:
            raise Error("some expected bits destined for the RC dir "
                        "are missing:\n%s"
                        % _indent('\n'.join(missing_bits)))

    # Create the RC dir.
    ver_dir = ujoin(kopkglib.g_remote_builds_dir, ide_build.short_ver)
    assert buildutils.remote_exists(ver_dir), \
        "'%s' doesn't exist!" % ver_dir
    dry_run_str = dry_run and " (dry-run)" or ""
    existing_rc_nums = []
    for p in buildutils.remote_glob(ujoin(ver_dir, "RC*")):
        try:
            existing_rc_nums.append(int(ubasename(p)[2:]))
        except ValueError:
            pass # ignore dirs that don't match "RC<num>"
    if not existing_rc_nums:
        rc_num = 1
    else:
        existing_rc_nums.sort()
        rc_num = existing_rc_nums[-1] + 1
    rc_dir = ujoin(ver_dir, "RC%s" % rc_num)
    log.info("mkdir `%s'%s", rc_dir, dry_run_str)
    assert buildutils.is_remote_path(rc_dir)
    if not dry_run:
        buildutils.remote_makedirs(rc_dir)
    
    # Copy in all bits in the manifest.
    if log.isEnabledFor(logging.INFO):
        # A hacky pprint of the manifest.
        #print _banner("manifest", '-')
        from cStringIO import StringIO
        t = Tree()
        t.add("internal")
        t.add("internal/log")
        t.add("internal/crashreportsymbols")
        t.add("remotedebugging")
        if not exclude_auto_update:
            t.add("updates")
        for dst_relpath, src_dir in rc_manifest:
            t.add(dst_relpath, src_dir)
        s = StringIO()
        t.pprint(s, root=rc_dir)
        log.info("create the following RC tree:\n%s",
                 _indent(s.getvalue(), 2))
        #print _banner(None, '-')

    statusbar = ""
    for i, (dst_relpath, src_dir) in enumerate(rc_manifest):
        if buildutils.is_remote_path(src_dir):
            src_path = ujoin(src_dir, ubasename(dst_relpath))
        else:
            src_path = join(src_dir, basename(dst_relpath))
        if src_path in missing_bits:
            print "  ignoring missing file %r" % (dst_relpath, )
            continue
        dst_path = ujoin(rc_dir, unormpath(dst_relpath))
        if sys.stdout.isatty() and not log.isEnabledFor(logging.DEBUG):
            if statusbar:
                sys.stdout.write('\b' * len(statusbar))
                sys.stdout.write(' ' * len(statusbar))
                sys.stdout.write('\b' * len(statusbar))
            statusbar = "[%d/%d] copying %%s..." % (i+1, len(rc_manifest))
            statusbar = statusbar % basename(dst_relpath)[:80-len(statusbar)]
            assert len(statusbar) < 80, "statusbar too long: %r" % statusbar
            sys.stdout.write(statusbar)
            sys.stdout.flush()
        if not dry_run:
            dst_dir, dst_base = dst_path.rsplit('/', 1)
            if '*' in dst_dir or '?' in dst_dir:
                raise Error("don't support globbing in the dst *dir*: %r"
                    % dst_dir) 
            if not buildutils.remote_exists(dst_dir):
                buildutils.remote_makedirs(dst_dir, log.debug)
            if '*' in dst_base or '?' in dst_base:
                src_paths = (buildutils.is_remote_path(src_path)
                    and buildutils.remote_glob(src_path)
                    or glob(src_path))
                for p in src_paths:
                    buildutils.remote_cp(p, dst_dir, log.debug,
                        hard_link_if_can=True)
            else:
                buildutils.remote_cp(src_path, dst_path, log.debug,
                                     hard_link_if_can=True)
    if sys.stdout.isatty() and statusbar:
        sys.stdout.write('\b' * len(statusbar))
        sys.stdout.write(' ' * len(statusbar))
        sys.stdout.write('\b' * len(statusbar))
        log.info("RC tree successfully created%s", dry_run_str)

    # Create MD5SUM files.
    log.info("Creating MD5SUM files%s...", dry_run_str)
    if not dry_run:
        remote_login, remote_rc_dir = rc_dir.split(':', 1)
        hash_these_dirs = [".", "remotedebugging"]
        if not exclude_auto_update:
            hash_these_dirs.append("updates")
        for subdir in hash_these_dirs:
            remote_dir = ujoin(remote_rc_dir, subdir)
            buildutils.remote_run(remote_login,
                "cd %s && md5sum *.* >MD5SUM" % remote_dir,
                log.debug)

    # Send email.
    if not skip_announcement:
        try:
            send_announcement(ide_build, edit_build,
                rc_dir.split('@', 1)[-1], # drop "user@" prefix
                rc_num, dry_run=dry_run)
        except Exception as e:
            log.exception("Something failed in the announcement function. However, "
                      "the RC directory was successfully created. "
                      "You'll just have to send the announcement to QA "
                      "as per KD 159 yourself.")

def send_announcement(ide_build, edit_build,
        rc_dir, rc_num, dry_run=False):
    import getpass
    dry_run_str = dry_run and " (dry-run)" or ""
    log.info("sending announcement email to QA (to: %s)%s",
             ', '.join(ANNOUNCE_EMAIL_HEADERS["To"]), dry_run_str)
    if dry_run:
        return

    # Put together the email.
    username = getpass.getuser()
    short_ver_str = ide_build.short_ver
    if edit_build and edit_build.short_ver != ide_build.short_ver:
        short_ver_str += " (Edit %s)" % edit_build.short_ver
    ann_data = {
        "builder": username,
        "rc_url": share_url_from_share_path(rc_dir),
        "kd_url": KD_URL_FROM_MAJORDOTMINOR_VERSION[ide_build.major_dot_minor_ver],
        "short_ver": ide_build.short_ver,
    }
    subject = "Komodo %s: RC%s ready for testing"\
                     % (short_ver_str, rc_num)
    message = ANNOUNCE_TEMPLATE % ann_data
    try:
        send_email(subject, username, message)
    except Exception as e:
         log.exception("""Failed to send the announcement email. However, 
                       the RC directory was successfully created. 
                       You'll just have to send the announcement to QA 
                       as per KD 159 yourself.""")
    try:
        message = "%s\n\n%s" %(subject, message)
        send_slack_message(message)
    except Exception as e:
        log.exception("""Failed to send the slack announcement. However, 
                      the RC directory was successfully created. 
                      You'll just have to send the announcement to QA 
                      as per KD 159 yourself.""")
 
def send_slack_message(message):
    import urllib2
    import json
    jsonData1 = json.dumps({
        "username": "Komodo Buildbot",
        "text": message,
        "icon_emoji": ":komodox:",
        "channel": "#devx-squad"
    })
    headers = {
        'Content-Type': 'application/json',
    }
    if (AS_SLACK_WEBHOOK_URL is None):
        print("Missing 'AS_SLACK_WEBHOOK_URL' environmental variable.  Retrieve the webhook url and set the variable.  The webhook can be found in 1Pass (if we're still using 1Pass) under 'ActiveState Slack Webhook URL'.")
        print("**Slack announcement did not send**.  You'll have to do it manually.")
        return
    hookUrl = AS_SLACK_WEBHOOK_URL
    req1 = urllib2.Request(hookUrl, jsonData1, headers)
    urllib2.urlopen(req1)
    log.info("Slack Announcement sent!  Also Again GO TEAM!!!")
    
def send_email(subject, username, message):
    import smtplib
    from email.MIMEText import MIMEText
    ann = MIMEText(message)
    ann["Subject"] = subject
    ann["From"] = "%s@activestate.com" % username
    for header, value in ANNOUNCE_EMAIL_HEADERS.items():
        if isinstance(value, list):
            value = ', '.join(value)
        ann[header] = value

    # Send it.
    try:
        s = smtplib.SMTP("smtp.activestate.com")
        recipents = ANNOUNCE_EMAIL_HEADERS.get("To", []) \
            + ANNOUNCE_EMAIL_HEADERS.get("Cc", []) \
            + ANNOUNCE_EMAIL_HEADERS.get("Bcc", [])
        s.sendmail(ann["From"], recipents, ann.as_string())
        s.close()
        log.info("Announcement email sent!  GO TEAM!!!")
    except:
        print _banner("failed sending this announcement email", '-')
        print ann.as_string()
        print _banner(None, '-')
        raise
    
def share_url_from_share_path(share_path):
    share_path = share_path.split("@", 1)[-1] # drop possible 'user@' prefix
    assert share_path.startswith("mule:/data/komodo/builds")
    return share_path.replace("mule:/data/komodo/",
        "http://komodo.nas1.activestate.com/")
    


#---- internal support functions

def get_rc_manifest(builds):
    rc_manifest = set()

    for build in builds:
        devbuild_dir = build.devbuild_dir
        pkg_prefix = build.pkg_prefix
        pkg_ver = build.pkg_ver

        rc_manifest.add(
            ("internal/log/%s-*.log" % build.log_prefix,
             ujoin(devbuild_dir, "internal", "log")))

        for platname in build.platnames:
            # Main installer package.
            rc_manifest.add((installer_pkg_name(pkg_prefix, pkg_ver, platname),
                 devbuild_dir))

            if platname == "macosx-x86_64":
                # The installer is named 'macosx-x86_64', but most other parts
                # are named 'macosx'.
                platname = "macosx"

            # Crash report symbols zip file.
            symbols_filename = crashreportsymbols_zip_name(pkg_prefix, pkg_ver, platname)
            rc_manifest.add(
                ("internal/crashreportsymbols/%s" % (symbols_filename, ),
                 ujoin(devbuild_dir, "internal", "crashreportsymbols")))

            if not build.exclude_auto_update:
                # Complete update package.
                rc_manifest.add(
                    (ujoin("updates", complete_update_pkg_name(pkg_prefix, pkg_ver, platname)),
                     ujoin(devbuild_dir, "updates")))
    
                # Partial update packages.
                guru = kopkglib.KomodoReleasesGuru(build.proj, platname, pkg_ver)
                last_beta_mar_rpath = guru.last_release_complete_mar
                if last_beta_mar_rpath and buildutils.remote_exists(last_beta_mar_rpath):
                    ref_ver = guru.version_from_mar_path(last_beta_mar_rpath)
                    rc_manifest.add(
                        (ujoin("updates", partial_update_pkg_name(pkg_prefix, pkg_ver, platname, ref_ver)),
                         ujoin(devbuild_dir, "updates"))
                    )
                last_final_mar_rpath = guru.last_final_release_complete_mar
                if (last_final_mar_rpath
                    and last_final_mar_rpath != last_beta_mar_rpath
                    and buildutils.remote_exists(last_final_mar_rpath)):
                    ref_ver = guru.version_from_mar_path(last_final_mar_rpath)
                    rc_manifest.add(
                        (ujoin("updates", partial_update_pkg_name(pkg_prefix, pkg_ver, platname, ref_ver)),
                         ujoin(devbuild_dir, "updates"))
                    )

            # Remote debugging packages.
            if build.proj == "komodoide":
                zip_ext = (platname.startswith("win") and ".zip" or ".tar.gz")
                pkg_infos_from_platname = {
                    "win32-x86": [
                        ("Perl", "win32-x86"),
                        ("PHP", "win32-x86"),
                        ("Python", "win32-x86"),
                        ("Ruby", "win32-x86"),
                        ("Tcl", "win32-x86"),
                    ],
                    "macosx": [
                        ("Perl", "macosx"),
                        ("PHP", "macosx"),
                        ("Python", "macosx"),
                        ("Ruby", "macosx"),
                        ("Tcl", "macosx"),
                    ],
                    "linux-x86": [
                        ("Perl", "linux-x86"),
                        ("PHP", "linux-x86"),
                        ("Python", "linux-x86"),
                        ("Ruby", "linux-x86"),
                        ("Tcl", "linux-x86"),
                    ],
                    "linux-x86_64": [
                        ("Perl", "linux-x86_64"),
                        ("PHP", "linux-x86_64"),
                        ("Python", "linux-x86_64"),
                        ("Ruby", "linux-x86_64"),
                        ("Tcl", "linux-x86_64"),
                    ],
                }
                for pkg_info in pkg_infos_from_platname[platname]:
                    lang, remotedebugging_platname = pkg_info
                    rc_manifest.update([
                        ("remotedebugging/Komodo-%sRemoteDebugging-%s-%s%s"
                            % (lang, pkg_ver, remotedebugging_platname, zip_ext),
                         ujoin(devbuild_dir, "remotedebugging")),
                    ])
    
        if build.proj == "komodoide":
            # Mozilla patches package.
            rc_manifest.add(
                ("Komodo-%s.%s-mozilla-patches.zip"
                    % (build.major_ver, build.minor_ver),
                 devbuild_dir))
            
            # Docs packages.
            # Internal Docs were removed for 9.3
            # rc_manifest.add(
            #     ("internal/Komodo-%s-docs.zip" % pkg_ver,
            #      devbuild_dir))

    rc_manifest = list(rc_manifest)
    rc_manifest.sort()
    return rc_manifest



def complete_update_pkg_name(pkg_prefix, pkg_ver, platname):
    bits = [
        pkg_prefix,
        pkg_ver,
        platname,
        "complete.mar"
    ]
    return '-'.join(bits)

def partial_update_pkg_name(pkg_prefix, pkg_ver, platname, ref_ver):
    bits = [
        pkg_prefix,
        pkg_ver,
        platname,
        "partial",
        ref_ver + ".mar"
    ]
    return '-'.join(bits)

def installer_pkg_name(pkg_prefix, pkg_ver, platname):
    data = {"pkg_prefix": pkg_prefix,
            "pkg_ver": pkg_ver,
            "platname": platname,
            }
    return {
        "win32-x86": "%(pkg_prefix)s-%(pkg_ver)s.msi",
        "linux-x86": "%(pkg_prefix)s-%(pkg_ver)s-%(platname)s.tar.gz",
        "linux-x86_64": "%(pkg_prefix)s-%(pkg_ver)s-%(platname)s.tar.gz",
        "macosx-x86_64": "%(pkg_prefix)s-%(pkg_ver)s-%(platname)s.dmg",
    }[platname] % data

def crashreportsymbols_zip_name(pkg_prefix, pkg_ver, platname):
    data = {"pkg_prefix": pkg_prefix, "pkg_ver": pkg_ver, "platname": platname}
    return "%(pkg_prefix)s-%(pkg_ver)s-%(platname)s.zip" % data

def _isalpha(ch):
    return 'a' <= ch <= 'z' or 'A' <= ch <= 'Z'

def _isdigit(char):
    return '0' <= char <= '9'

def _p4_changenum(p4path):
    cmd = "p4 changes -m1 %s/..." % p4path
    o = os.popen(cmd)
    return int(o.read().split(None, 2)[1])

# Recipe: banner (1.0.1) in C:\trentm\tm\recipes\cookbook
def _banner(text, ch='=', length=78):
    """Return a banner line centering the given text.
    
        "text" is the text to show in the banner. None can be given to have
            no text.
        "ch" (optional, default '=') is the banner line character (can
            also be a short string to repeat).
        "length" (optional, default 78) is the length of banner to make.

    Examples:
        >>> _banner("Peggy Sue")
        '================================= Peggy Sue =================================='
        >>> _banner("Peggy Sue", ch='-', length=50)
        '------------------- Peggy Sue --------------------'
        >>> _banner("Pretty pretty pretty pretty Peggy Sue", length=40)
        'Pretty pretty pretty pretty Peggy Sue'
    """
    if text is None:
        return ch * length
    elif len(text) + 2 + len(ch)*2 > length:
        # Not enough space for even one line char (plus space) around text.
        return text
    else:
        remain = length - (len(text) + 2)
        prefix_len = remain / 2
        suffix_len = remain - prefix_len
        if len(ch) == 1:
            prefix = ch * prefix_len
            suffix = ch * suffix_len
        else:
            prefix = ch * (prefix_len/len(ch)) + ch[:prefix_len%len(ch)]
            suffix = ch * (suffix_len/len(ch)) + ch[:suffix_len%len(ch)]
        return prefix + ' ' + text + ' ' + suffix





# Recipe: indent (0.2.1) in C:\trentm\tm\recipes\cookbook
def _indent(s, width=4, skip_first_line=False):
    """_indent(s, [width=4]) -> 's' indented by 'width' spaces

    The optional "skip_first_line" argument is a boolean (default False)
    indicating if the first line should NOT be indented.
    """
    lines = s.splitlines(1)
    indentstr = ' '*width
    if skip_first_line:
        return indentstr.join(lines)
    else:
        return indentstr + indentstr.join(lines)



#---- internal path tree class for pprint'ing manifest
# (see tm/trentm.com/build.py)

def _splitall(path):
    r"""Return list of all split directory parts.

    Often, it's useful to process parts of paths more generically than
    os.path.split(), for example if you want to walk up a directory.
    This recipe splits a path into each piece which corresponds to a
    mount point, directory name, or file.  A few test cases make it
    clear:
        >>> _splitall('')
        []
        >>> _splitall('a/b/c')
        ['a', 'b', 'c']
        >>> _splitall('/a/b/c/')
        ['/', 'a', 'b', 'c']
        >>> _splitall('/')
        ['/']
        >>> _splitall('C:\\a\\b')
        ['C:\\', 'a', 'b']
        >>> _splitall('C:\\a\\')
        ['C:\\', 'a']

    (From the Python Cookbook, Files section, Recipe 99.)
    """
    allparts = []
    while 1:
        parts = os.path.split(path)
        if parts[0] == path:  # sentinel for absolute paths
            allparts.insert(0, parts[0])
            break
        elif parts[1] == path: # sentinel for relative paths
            allparts.insert(0, parts[1])
            break
        else:
            path = parts[0]
            allparts.insert(0, parts[1])
    allparts = [p for p in allparts if p] # drop empty strings 
    return allparts

def _splithead(path):
    """split the given path at the first path part and return both parts"""
    parts = _splitall(path)
    if len(parts) == 1:
        return (parts[0], '')
    else:
        return (parts[0], os.path.join(*parts[1:]))

class NodeIterator(object):
    def __init__(self, node):
        self._nodes = [node]
        self._indices = [0]
        self._prefixes = [None]
    def __iter__(self):
        return self
    def next(self):
        i = self._indices[-1]
        children = self._nodes[-1].children
        if i >= len(children):
            del self._nodes[-1]
            del self._indices[-1]
            del self._prefixes[-1]
            if not self._nodes:
                raise StopIteration
            else:
                return self.next()
        else:
            child = children[i]
            self._indices[-1] += 1
            self._nodes.append(child)
            self._indices.append(0)
            names = [n.name for n in self._nodes if n.name is not None]
            if i+1 < len(children):
                self._prefixes.append('|')
                prefix = "  ".join(self._prefixes[1:]) + "- "
            else:
                self._prefixes.append('`')
                prefix = "  ".join(self._prefixes[1:]) + "- "
                self._prefixes[-1] = ' '
            return (prefix,
                    child.name,
                    os.path.join(*names),
                    child.data)
class Node(object):
    def __init__(self, name, path, data):
        self.name = name
        self.path = path
        self.data = data
        self.children = []
    def __cmp__(self, other):
        if isinstance(other, Node):
            return cmp(self.name, other.name)
        elif isinstance(other, (str, unicode)):
            return cmp(self.name, other)
        else:
            raise TypeError("cannot compare a Node to a %s" % type(other))
    def addChild(self, child):
        bisect.insort(self.children, child)
    def getNode(self, path):
        if os.path.isabs(path):
            raise Error("don't yet know how to handle absolute paths: %s" % path)
        head, tail = _splithead(path)
        idx = bisect.bisect(self.children, head)
        if idx-1 >= 0 and self.children[idx-1].name == head:
            hnode = self.children[idx-1]
        else:
            raise Error("do not have a '%s' child on %r" % (head, self))
        if not tail:
            return hnode
        else:
            return hnode.getNode(tail)
    def __repr__(self):
        return "<Node %r: %r>" % (self.name or '', self.path or '')
    def pprint(self, stream=sys.stdout, stack=[]):
        newstack = stack + ['|']
        prefix = "  ".join(newstack) + "- "
        endstack = stack + ['`']
        endprefix = "  ".join(endstack) + "- "
        endstack[-1] = ' '
        for i, child in enumerate(self.children):
            if i+1 < len(self.children):
                stream.write(prefix+child.name+'\n')
                child.pprint(stream, newstack)
            else:
                stream.write(endprefix+child.name+'\n')
                child.pprint(stream, endstack)
    def __iter__(self):
        return NodeIterator(self)
class Tree(Node):
    """A tree of nodes that provide pretty printing, iterator traversal, etc.

    The following semantics make this tree specific to displaying dir deployment
    mods in this module:
    - multiple children at one level with the same name are allowed
    - when adding a child to a name with more than one node at that
      level, the last such node gets the child
    """
    def __init__(self, name=None, path=None, data=None):
        super(Tree, self).__init__(name, path, data)
    def add(self, path, data=None):
        if os.path.isabs(path):
            raise Error("don't yet know how to handle absolute paths: %s" % path)
        dir, base = os.path.split(path)
        if not dir:
            dnode = self
        else:
            dnode = self.getNode(dir)
        node = Node(base, path, data)
        dnode.addChild(node)
    def pprint(self, stream=sys.stdout, root=None):
        if root is not None:
            stream.write(root+"/\n")
        super(Tree, self).pprint(stream)
class ActionTree(Tree):
    """A Tree where the datums are Action instances. """
    def pprint(self, stream=sys.stdout, root=None):
        if root is not None:
            stream.write("   %s/\n" % root)
        for prefix, name, path, action in self:
            if isinstance(action, (NoOp, Delete, Skip)):
                pathinfo = action.dstinfo
            elif isinstance(action, (Add, Update)):
                pathinfo = action.srcinfo
            else:
                raise Error("unrecognized action type: %r" % action)
            extra = ''
            marker = ''
            if pathinfo is not None:
                marker = pathinfo.marker
            s = "%s %s%s%s%s\n" % (action.nick, prefix, name, marker, extra)
            stream.write(s)



#---- mainline

# Recipe: pretty_logging (0.1) in C:\trentm\tm\recipes\cookbook
class _PerLevelFormatter(logging.Formatter):
    """Allow multiple format string -- depending on the log level.

    A "fmtFromLevel" optional arg is added to the constructor. It can be
    a dictionary mapping a log record level to a format string. The
    usual "fmt" argument acts as the default.
    """
    def __init__(self, fmt=None, datefmt=None, fmtFromLevel=None):
        logging.Formatter.__init__(self, fmt, datefmt)
        if fmtFromLevel is None:
            self.fmtFromLevel = {}
        else:
            self.fmtFromLevel = fmtFromLevel
    def format(self, record):
        record.lowerlevelname = record.levelname.lower()
        if record.levelno in self.fmtFromLevel:
            #XXX This is a non-threadsafe HACK. Really the base Formatter
            #    class should provide a hook accessor for the _fmt
            #    attribute. *Could* add a lock guard here (overkill?).
            _saved_fmt = self._fmt
            self._fmt = self.fmtFromLevel[record.levelno]
            try:
                return logging.Formatter.format(self, record)
            finally:
                self._fmt = _saved_fmt
        else:
            return logging.Formatter.format(self, record)

def _setup_logging():
    """Setup logging to the console (controlled by -v|-q options) and,
    to log/mkrc.log (always at DEBUG level).
    """
    global console, log

    log = logging.getLogger("mkrc")
    log.setLevel(logging.DEBUG)

    # Logging to console.
    console = logging.StreamHandler()
    defaultFmt = "%(name)s: %(lowerlevelname)s: %(message)s"
    infoFmt = "%(name)s: %(message)s"
    fmtr = _PerLevelFormatter(fmt=defaultFmt,
                              fmtFromLevel={logging.INFO: infoFmt})
    console.setFormatter(fmtr)
    console.setLevel(logging.INFO)
    logging.root.addHandler(console)

    # Logging to 'log/mkrc.log'.
    if not exists("log"):
        os.makedirs("log")
    hdlr = logging.FileHandler(join("log", "mkrc.log"), mode='w')
    fmt = "%(asctime)s: %(levelname)s: %(message)s"
    hdlr.setFormatter(logging.Formatter(fmt))
    hdlr.setLevel(logging.DEBUG)
    logging.root.addHandler(hdlr)

class _NoReflowFormatter(optparse.IndentedHelpFormatter):
    """An optparse formatter that does NOT reflow the description."""
    def format_description(self, description):
        return description or ""

def main(argv):
    usage = "usage: %prog [OPTIONS...]"
    version = "%prog "+__version__
    parser = optparse.OptionParser(prog="mkrc", usage=usage,
        version=version, description=__doc__,
        formatter=_NoReflowFormatter())
    parser.add_option("-v", "--verbose", dest="log_level",
        action="store_const", const=logging.DEBUG,
        help="more verbose output")
    parser.add_option("-q", "--quiet", dest="log_level",
        action="store_const", const=logging.WARNING,
        help="quieter output")
    parser.add_option("-n", "--dry-run", action="store_true",
        help="do a dry-run")
    parser.add_option("--skip-announcement", action="store_true",
        help="skip sending announcement emails (for debugging)")
    parser.add_option("-b", "--branch",
        help="Komodo source tree branch builds to use: 'rel' (the latest "
            "release branch, default), 'trunk', '5.2.0a1', '5.1.x', etc.")
    parser.add_option("-i", "--ide-revision",
        help="Use this specific IDE devbuild revision instead of the latest available.")
    parser.add_option("-e", "--edit-revision",
        help="Use this specific Edit devbuild revision instead of the latest available.")
    parser.add_option("--exclude-edit", dest="exclude_edit",
        action="store_true", help="exclude Komodo Edit bits")
    parser.add_option("--exclude-auto-update", dest="exclude_auto_update",
        action="store_true", help="exclude auto-update bits")
    parser.add_option("--force", dest="force_release",
        action="store_true", help="force mkrc to run even when missing bits")
    parser.set_defaults(log_level=logging.INFO, ide_revision=None,
                        edit_revision=None, dry_run=False, branch="rel",
                        exclude_edit=False, exclude_auto_update=False)
    opts, args = parser.parse_args()
    console.setLevel(opts.log_level)

    mkrc(branch=opts.branch,
         ide_revision=opts.ide_revision,
         edit_revision=opts.edit_revision,
         dry_run=opts.dry_run,
         skip_announcement=opts.skip_announcement,
         exclude_edit=opts.exclude_edit,
         exclude_auto_update=opts.exclude_auto_update,
         force_release=opts.force_release)


if __name__ == "__main__":
    _setup_logging()
    try:
        retval = main(sys.argv)
    except SystemExit:
        pass
    except KeyboardInterrupt:
        sys.exit(1)
    except:
        exc_info = sys.exc_info()
        if hasattr(exc_info[0], "__name__"):
            exc_class, exc, tb = exc_info
            exc_str = str(exc_info[1])
            sep = ('\n' in exc_str and '\n' or ' ')
            where_str = ""
            tb_path, tb_lineno, tb_func = traceback.extract_tb(tb)[-1][:3]
            in_str = (tb_func != "<module>"
                      and " in %s" % tb_func
                      or "")
            where_str = "%s(%s#%s%s)" % (sep, tb_path, tb_lineno, in_str)
            log.error("%s%s", exc_str, where_str)
        else:  # string exception
            log.error(exc_info[0])
        if log.isEnabledFor(logging.INFO-1):
            print
            traceback.print_exception(*exc_info)
        sys.exit(1)
    else:
        sys.exit(retval)
