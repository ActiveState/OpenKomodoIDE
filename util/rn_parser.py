#!/usr/bin/env python

# Sample usage
# $ python rn_parser.py 27716 31057 > rn.html
#

import sys
import re

from subprocess import Popen, PIPE
from argparse import ArgumentParser

def html_escape(s):
    s = s.replace("&", "&amp;")
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    return s

def parseGitCommits(data, showAll = False):
    html = []
    commits = data.split("\n\ncommit ")
    for commit in commits:
        if not showAll and "rn=" not in commit:
            continue
        lines = commit.splitlines(0)[3:]
        while lines and not lines[0].strip():
            lines = lines[1:]
        message = None
        bug_number = None
        for line in lines:
            if not message:
                message = line.strip()
                # Work around Eric's commit format:
                if "http" in message and "bug" in message:
                    message = None

            # The "rn=" comment overrides the message.
            m = re.match(r'^rn=(.*)$', line, flags=re.IGNORECASE)
            if m and len(m.group(1).strip()) > 10:
                message = m.group(1).strip()
                continue

            #m1 = re.match(r'^fix:?\s+\"?(.*)\"?$', line, flags=re.IGNORECASE)
            m = re.match(r'^.*https?:\/\/bugs\.activestate\.com\/show_bug\.cgi\?id\=(\d+).*$', line, flags=re.IGNORECASE)
            # Match bugzilla
            if m is None:
                m = re.match(r'^.*\bbug\s(\d+).*$', line, flags=re.IGNORECASE)
            if m is not None:
                bug_number = m.group(1)
        if message:
            if message.endswith("."):
                message = message[:-1]
            # Work around Todd's commit format:
            if message.startswith("fix: "):
                message = message[5:]
            # Work around quotes in commit message:
            if message.startswith('"') and message.endswith('"'):
                message = message[1:-1]
            # Work around Eric's commit format:
            msplit = message.split(":")
            if len(msplit) > 2 and msplit[1] == " fix":
                message = msplit[0] + ":" + ":".join(msplit[2:])
            if message and not message.endswith("."):
                message += "."
            message = html_escape(message)
            message = re.sub(r'#(\d+)', r'[#\1](https://github.com/Komodo/KomodoEdit/issues/\1)', message, flags=re.IGNORECASE)
            if bug_number:
                message += ' [Bugzilla #%s](href="https://bugs.activestate.com/show_bug.cgi?id=%s)' %(bug_number,bug_number)
            html.append('*   %s' % (message))
    html.sort()
    return "\n".join(html)


def main():
    parser = ArgumentParser(description='ReleaseNote Parser')

    parser = ArgumentParser(description='CodeIntel Server')

    parser.add_argument('fromRevision', metavar='R', type=str,
                        help='The revision to start parsing from')

    parser.add_argument('-t', "--to", type=str, default="HEAD",
                        help='The revision to parse to')

    parser.add_argument('-a', "--all", action="store_true",
                        help='Output all commit message, not just korel')

    args = parser.parse_args()

    rev1 = args.fromRevision
    rev2 = args.to

    git_cmd = ["git", "log", "%s..%s" % (rev1, rev2)]
    p = Popen(git_cmd, stdout=PIPE)
    stdout, stderr = p.communicate()
    if stderr:
        if not stdout:
            print "Error: %s" % (stderr, )
            return 1
        sys.stderr.write(stderr)
    html = parseGitCommits(stdout, args.all)
    print html
    return 0

if __name__ == '__main__':
    sys.exit(main())
