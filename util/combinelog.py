#!/usr/bin/env python
# Copyright (c) 2007 ActiveState Software Inc.

r"""combinelog -- Merge squid access, referer, and useragent logs for
multiple squid servers (for load balancing) into a set of normalized
streams of "pylog" records.

A "pylog" record is just a file of Python dictionaries (one per line).
This module provides a way to directly translate these into Apache
Apache "combined"-format log records -- for use for log file analysis
tools. The "pylog" logs are more useful for custom log analysis.

1. You first need a local copy of the appropriate logs from our backup
   server. Here is how to get those for Nov 2007. Note that these
   take a *lot* of space:

    rsync -av rsync://backups.activestate.com/all-logs/raw_logs/ \
        --include='box*/' \
        --include='box*/squid/' \
        --include="access.log-200711*.gz" \
        --include="referer.log-200711*.gz" \
        --include="useragent.log-200711*.gz" \
        --exclude="*" \
        raw_logs/ 

2. Then you need to run in that "raw_logs" directory (or bug Trent to provide
   an option to configure where that is). Example runs:

    cd raw_logs

    # Combine the logs for the first *second* of Nov 2nd, 2007.
    # This is useful for playing with this script. Even a time range
    # of an hour is 100k's of records so takes a long time.
    ./combinelog.py -v -o combined-DOMAIN.log \
        2007-11-02 "2007-11-02 00:00:01" 

    # Combine the logs for the first hour of Nov 2, 2007.
    ./combinelog.py -v -o combined-DOMAIN.log \
        2007-11-02 "2007-11-02 01:00" 

    # Combine the logs for all of Nov 2, 2007. Go for coffee.
    # 'END' defaults to START-plus-one-day
    ./combinelog.py -v -o DOMAIN/combined-20071102.log 2007-11-02

    # Combine the logs for all of Nov 2, 2007. Exclude images, javascript,
    # and CSS.
    ./combinelog.py -v -o combined-20071102.log 2007-11-02 \
        -x 'contenttype=image/.*' \
        -x 'contenttype=application/x-javascript' \
        -x 'contenttype=text/css'

    # Combine the logs for all of Nov 2, 2007 for www.activestate.com
    # (--domain) and including only 404s (-i).
    ./combinelog.py -v -o missing-20071102.log 2007-11-02 \
        --domain www.activestate.com \
        -i 'status=404'

Notes:
- While mostly generic, this module has a number of things hardcoded to
  ActiveState's log situation.
- Because of time skews (e.g. the records in the access log for Nov 2,
  2007 don't start at midnight that day) you'll probably might need log
  files from the day *before* and the day *after* your time range.
- You'll need lots of space (and time!).
- If the parsed data is being used for further analysis, there is an
  module interface that make more sense than the command line iface.
- Field names for include/exclude are: status, contenttype, url,
  remotehost, bytes, elapsed, box_id, referer, useragent, method,
  domain, path, protocol.
"""
#TODO:
# - possible domain alias normalization (see:
#  http://svn.activestate.com/activestate/view/sys/trunk/kickstart/sysconfig/roles/www.activestate.com/www.conf)
#   could add then add "domain_alias" field that gives the original
#  Also handle ":80" port in domain.
# - patch to http://svn.activestate.com/activestate/view/sys/trunk/kickstart/sysconfig/roles/www.activestate.com/www.conf
#   to redir activestate.com -> www.activestate.com.
# - sys bug on www.conf (maybe): activestate.net|ca|etc. 404 instead of redirecting
# - purgatory for non-core domains.
# - url normalization option (Shane was actually asking about URL
#   *path* lowercasing -- which really is a hack.)
# - This record looks wrong (referer is same as url):
#    200.157.29.222 - - [01/Nov/2007:00:00:04 -0700] "GET http://downloads.activestate.com/ActivePython/linux/2.5/ActivePython-2.5.1.1-linux-x86_64.tar.gz HTTP/1.0" 206 24673 "http://downloads.activestate.com/ActivePython/linux/2.5/ActivePython-2.5.1.1-linux-x86_64.tar.gz" "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.0)"


__version_info__ = (1, 0, 0)
__version__ = '.'.join(map(str, __version_info__))

    
import os
from os.path import join, dirname, basename, exists, normpath, abspath, \
                    splitext, expanduser
import sys
import re
from pprint import pprint, pformat
import traceback
import logging
import optparse
import datetime
import gzip
import cPickle as pickle
from hashlib import md5
from collections import defaultdict
import itertools



#---- exceptions

class Error(Exception):
    pass



#---- globals

log = logging.getLogger("combinelog")
apache_date_format = "%d/%b/%Y:%H:%M:%S -0700" #XXX hardcoded tz

# Box (i.e. squid server) mapping to log dir.
boxes = {
    "box7": "box7/squid",
    "box8": "box8/squid",
    "box14": "box14/squid",
}

# Requests on domains other than these get logs in a "purgatory"
# subdirectory.
core_domains = ["activestate.com", "openkomodo.com"]

# Aliases are noted in the "domain_alias" pylog field and are the
# "domain" field is normalized.
domain_aliases = {
    "www.activestate.com": ["www.activestate.ca", "activestate.com",
                            "activestate.net", "activestate.ca",
                            "www.activestate.net", "activestate.org",
                            "www.activestate.org"],
}


#---- module API

def apache_combined_record(record):
    """Return an Apache 'combined'-style log record for the given pylog
    entry.

    http://httpd.apache.org/docs/1.3/logs.html#combined
    Combined Log Format:
        %h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-agent}i\"
    where:
        %h                  remotehost
        %l                  RFC 1413 identity (not used, always '-')
        %u                  user (not used, always '-'
        %t                  time: [day/month/year:hour:minute:second zone]
        %r                  HTTP request line (XXX have the info for this?)
        %>s                 HTTP status code (XXX have the info for this?)
        %b                  num bytes
        %{Referer}i         referer
        %{User-agent}i      useragent
    """
    bits = [
        record["remotehost"],
        '-',
        '-',
        '[%s]' % record["time"].strftime(apache_date_format),
        '"%(method)s %(path)s %(protocol)s"' % record,
        record["status"],
        record["bytes"],
        (record.get("referer") and '"%s"' % record.get("referer") or '-'),
        (record.get("useragent") and '"%s"' % record.get("useragent") or '-'),
    ]
    return ' '.join(bits)


def combinelog(boxes, start, end, includes=None, excludes=None, domain=None):
    #log.debug("combinelog(%s, '%s', '%s', ...)", boxes, start, end)

    if True:
        access_stream = merged_squid_access_log_stream(boxes, start, end)
        referer_stream = merged_squid_referer_log_stream(boxes, start,
            end + datetime.timedelta(hours=1))
        useragent_stream = merged_squid_useragent_log_stream(boxes, start,
            end + datetime.timedelta(hours=1))

        # Mapping of
        #   (remotehost, url) -> referer-record
        #   (remotehost, url) -> useragent-record
        # For memory control, only a window of referer records and read in,
        # and referer records matched to an access record are discarded.
        referer_window = defaultdict(list)
        referer_window_lookahead = datetime.timedelta(seconds=30)
        referer_window_timeout = datetime.timedelta(seconds=30)

        # Mapping of
        #   remotehost -> useragent-record
        # For memory control, only a window of useragent records and read in,
        # and useragent records matched to an access record are discarded.
        useragent_window = defaultdict(list)
        useragent_window_lookahead = datetime.timedelta(seconds=30)
        useragent_window_timeout = datetime.timedelta(seconds=30)

        # Stats data.
        num_records = 0
        num_records_excluded = 0
        num_unknown_referers = 0
        num_timed_out_referers = 0
        num_discarded_referers = 0
        num_unknown_useragents = 0
        num_timed_out_useragents = 0
        num_discarded_useragents = 0

        for r in access_stream:
            #pprint(r)
            num_records += 1

            # Find a referer record for this access.
            t = r["time"]
            referer_key = (r["remotehost"], r["url"])
            if referer_key not in referer_window:
                # Get referer logs up to 1 second later (too much? too
                # little?).
                while True:
                    try:
                        referer_rec = referer_stream.next()
                    except StopIteration:
                        log.warn("ran out of referer records")
                        break
                    k = (referer_rec["remotehost"], referer_rec["url"])
                    #print "referer_window[%r] = %r" % (k, referer_rec)
                    referer_window[k].append(referer_rec)
                    if referer_rec["time"] - t > referer_window_lookahead:
                        break
            if referer_key in referer_window:
                # Discard referer records that have expired.
                referer_recs = referer_window[referer_key]
                idx_to_discard = []
                for i, referer_rec in enumerate(referer_recs):
                    if r["time"] - referer_rec["time"] > referer_window_timeout:
                        # Discard. Unused referer record.
                        idx_to_discard.append(i)
                for i in reversed(idx_to_discard):
                    del referer_recs[i]
                    num_discarded_referers += 1

                if not referer_recs:
                    r["referer"] = None
                    num_unknown_referers += 1
                    num_timed_out_referers += 1
                    del referer_window[referer_key]
                else:
                    referer_rec = referer_recs.pop(0)
                    if not referer_recs:
                        del referer_window[referer_key]
                    r["referer"] = referer_rec["referer"]
            else:
                r["referer"] = None
                num_unknown_referers += 1

            # Find a useragent record for this access.
            t = r["time"]
            useragent_key = r["remotehost"]
            if useragent_key not in useragent_window:
                # Get useragent logs up to 1 second later (too much? too
                # little?).
                while True:
                    try:
                        useragent_rec = useragent_stream.next()
                    except StopIteration:
                        log.warn("ran out of useragent records")
                        break
                    k = useragent_rec["remotehost"]
                    #print "useragent_window[%r] = %r" % (k, useragent_rec)
                    useragent_window[k].append(useragent_rec)
                    if useragent_rec["time"] - t > useragent_window_lookahead:
                        break
            if useragent_key in useragent_window:
                # Discard useragent records that have expired.
                useragent_recs = useragent_window[useragent_key]
                idx_to_discard = []
                for i, useragent_rec in enumerate(useragent_recs):
                    if r["time"] - useragent_rec["time"] > useragent_window_timeout:
                        # Discard. Unused useragent record.
                        idx_to_discard.append(i)
                for i in reversed(idx_to_discard):
                    del useragent_recs[i]
                    num_discarded_useragents += 1

                if not useragent_recs:
                    r["useragent"] = None
                    num_unknown_useragents += 1
                    num_timed_out_useragents += 1
                    del useragent_window[useragent_key]
                else:
                    useragent_rec = useragent_recs.pop(0)
                    if not useragent_recs:
                        del useragent_window[useragent_key]
                    r["useragent"] = useragent_rec["useragent"]
            else:
                r["useragent"] = None
                num_unknown_useragents += 1

            # Filtering.
            if domain and r["domain"] != domain:
                num_records_excluded += 1
                continue
            if includes:
                unmatched_includes = [field for field, regex in includes
                                      if not regex.search(r[field])]
                if unmatched_includes:
                    #log.debug("excluding record not matching '%s' include(s): %r",
                    #          "', '".join(unmatched_includes), r)
                    num_records_excluded += 1
                    continue
            if excludes:
                matched_excludes = [field for field, regex in excludes
                                    if regex.search(r[field])]
                if matched_excludes:
                    #log.debug("excluding record matching '%s' exclude(s): %r",
                    #          "', '".join(matched_excludes), r)
                    num_records_excluded += 1
                    continue

            yield r

        log.info("------------- summary -------------")
        log.info("           number of records: %d", num_records)
        log.info("  number of excluded records: %d (%d remaning)", 
                 num_records_excluded, num_records - num_records_excluded)
        log.info("            unknown referers: %d (%.1f%%)",
                 num_unknown_referers, 
                 num_unknown_referers * 100.0 / num_records)
        log.info("      num timed out referers: %d",
                 num_timed_out_referers)
        log.info("      num discarded referers: %d",
                 num_discarded_referers)
        log.info("          unknown useragents: %d (%.1f%%)",
                 num_unknown_useragents, 
                 num_unknown_useragents * 100.0 / num_records)
        log.info("    num timed out useragents: %d",
                 num_timed_out_useragents)
        log.info("    num discarded useragents: %d",
                 num_discarded_useragents)


    if False:
        print "\n-- accesses"
        access_stream = merged_squid_access_log_stream(boxes, start, end)
        pprint(access_stream.next())
        num_elided = 0
        for access_rec in access_stream:
            num_elided += 1
        print "(... %d records elided ...)" % (num_elided-1)
        pprint(access_rec)

    if False:
        print "\n-- referers"
        referer_stream = merged_squid_referer_log_stream(boxes, start, end)
        pprint(referer_stream.next())
        num_elided = 0
        for referer_rec in referer_stream:
            num_elided += 1
        print "(... %d records elided ...)" % (num_elided-1)
        pprint(referer_rec)

    if False:
        print "\n-- useragents"
        useragent_stream = merged_squid_useragent_log_stream(boxes, start, end)
        pprint(useragent_stream.next())
        num_elided = 0
        for useragent_rec in useragent_stream:
            num_elided += 1
        print "(... %d records elided ...)" % (num_elided-1)
        pprint(useragent_rec)


#---- access log record generation

# http://proxy.nsysu.edu.tw/FAQ/FAQ-6.html
# access.log format:
#   time elapsed remotehost code/status bytes method URL rfc931 peerstatus/peerhost
#
# ActiveState's squid access logs also have a "contenttype" at the end.
# Examples:
#   1193917047.023     20 220.131.101.195 TCP_HIT/200 649 GET http://aspn.activestate.com/ASPN/img/primary_nav_Home_sel.gif - NONE/- image/gif
#   1193917047.105    451 82.152.37.211 TCP_MISS/200 26012 GET http://aspn.activestate.com/ASPN/docs/ActivePerl/5.8/lib/Test/Harness/Results.html - DIRECT/127.0.0.1 text/html
#
_access_log_re = re.compile(r"""^
    (?P<timestamp>\d+\.\d+)
    \s+(?P<elapsed>\d+)
    \s+(?P<remotehost>\d+\.\d+\.\d+\.\d+)
    \s+(?P<code>\w+)/(?P<status>\d+)
    \s+(?P<bytes>\d+)
    \s+(?P<method>\w+)
    \s+(?P<url>.*?)
    \s+(?P<rfc931>-)
    \s+(?P<peerstatus>\w+)/(?P<peerhost>.*?)
    \s+(?P<contenttype>.*?)
    $""", re.M | re.X)

def squid_access_log_stream(box_id, box_dir, start, end):
    from urlparse import urlsplit

    assert exists(box_dir)
    assert isinstance(start, datetime.datetime)
    assert isinstance(end, datetime.datetime)
    assert end > start, "end (%s) must be later than start (%s)" % (end, start)

    # Cache the info needed to more quickly get the log file path and
    # offset for the first record for the `start`.
    #   cache = {("access", box_dir, start): (path, md5sum, offset)}
    cache_path = ".combindedlog-cache.pickle"
    if exists(cache_path):
        f = open(cache_path, 'rb')
        try:
            cache = pickle.load(f)
        finally:
            f.close()
    else:
        cache = {}
    cache_key = ("access", normpath(abspath(box_dir)), str(start))
    if cache_key in cache:
        path, md5sum, offset = cache[cache_key]
        curr_md5sum = md5(open(path, 'rb').read()).hexdigest()
        if curr_md5sum != md5sum:
            #log.debug("out-of-date offset info in cache")
            del cache[cache_key]

    if cache_key in cache:
        #log.debug("offset info in cache: `%s', offset=%r", path, offset)
        log.debug("opening `%s'", path)
        fin = gzip.open(path, 'rb')
        fin.seek(offset)
        on_deck = []
        day_str = splitext(basename(path))[0].split('-')[-1]
        day = datetime.date(year=int(day_str[:4]), month=int(day_str[4:6]),
                            day=int(day_str[6:]))
    else:
        # Find the first log record in this file that is *before* the
        # start of `start` (to ensure we get all records for that time
        # period).
        day = datetime.date(start.year, start.month, start.day)
        while True:
            path = join(box_dir, "access.log-%s.gz" % day.strftime("%Y%m%d"))
            if not exists(path):
                raise Error("cannot get first log record for %s: `%s' does not exist"
                            % (start, path))
            log.debug("opening `%s'", path)
            fin = gzip.open(path, 'rb')
            offset = fin.offset
            line = fin.next()
            timestamp = float(line.split(None, 1)[0])
            t = datetime.datetime.fromtimestamp(timestamp)
            if t < start:
                log.debug("first record for %s IS in `%s'", start, path)
                break
            else:
                log.debug("first record for %s is NOT in `%s'", start, path)

            day = day - datetime.timedelta(1)

        # Seek forward throw log file until find first record for `start`.
        log.debug("seeking first record for %s in `%s'", start, path)
        for line in fin:
            timestamp = float(line.split(None, 1)[0])
            t = datetime.datetime.fromtimestamp(timestamp)
            if t >= start:
                # This is the first record for `start`.
                log.debug("found first record for %s: %s", start, t)
                break
            offset = fin.offset
        else:
            raise Error("first log record for %s was not found in `%s'"
                        % (start, path))
        on_deck = [line]

    # Update the offsets cache.
    curr_md5sum = md5(open(path, 'rb').read()).hexdigest()
    cache[cache_key] = (normpath(abspath(path)), curr_md5sum, offset)
    #log.debug("update offset cache: %s -> %s", cache_key, cache[cache_key])
    f = open(cache_path, 'wb')
    try:
        cache = pickle.dump(cache, f)
    finally:
        f.close()

    # Assumptions:
    #   `fin` is a file handle seeked to the start of the line for the
    #       first log record for `start`.
    #   `day` is a datetime.date instance for the day of this log file
    while True:
        done = False
        offset = fin.offset
        for line in itertools.chain(on_deck, fin):
            m = _access_log_re.match(line)
            if not m:
                raise Error("couldn't match line in %s[%s:%s]: %r"
                            % (path, offset, fin.offset, line))
            d = m.groupdict()
            d["time"] = datetime.datetime.fromtimestamp(float(d["timestamp"]))
            if d["time"] >= end:
                done = True
                break

            # Remove some unwanted keys for clarity.
            del d["code"]
            del d["rfc931"]
            del d["peerhost"]
            del d["peerstatus"]

            # Add some extra wanted data.
            d["box_id"] = box_id
            scheme, netloc, upath, query, fragment = urlsplit(d["url"])
            domain = netloc.split('@', 1)[-1]  # e.g. user@pass:domain
            d["domain"] = domain.lower()       # domains are case-insensitive
            d["path"] = upath
            if query:
                d["path"] += '?' + query
            # Squid logs don't provide the protocol used. We'll guess.
            #TODO: others for here? what about FTP?
            scheme = scheme.lower()
            if scheme == "error":
                # E.g. seen in "box14/squid/access.log-20071104.gz":
                #   1194139600.604    188 87.194.12.255 NONE/413 1572 NONE error:request-too-large - NONE/- text/html
                log.debug("debug: discard squid log error: %r", line)
                continue
            d["protocol"] = {
                "http": "HTTP/1.0",
                "https": "HTTPS/1.0",
            }.get(scheme, "HTTP/1.0")

            yield d
            offset = fin.offset

        fin.close()
        if done:
            break
        else:
            day = day + datetime.timedelta(1)
            path = join(box_dir, "access.log-%s.gz" % day.strftime("%Y%m%d"))
            if not exists(path):
                raise Error("cannot get all log records to %s: `%s' does not exist"
                            % (end, path))
            log.debug("opening `%s'", path)
            fin = gzip.open(path, 'rb')
            on_deck = []

def merged_squid_access_log_stream(boxes, start, end):
    """Generate access log records from multiple squid-format log files
    like this:

        $box_dir/access.log-YYYYMMDD.gz

    @param boxes {dict} is a mapping of box id to
        dir in which the access logs are found. E.g.,
            {'box14': 'box14/squid', ...}
    @param start {datetime.datetime} is the time from which to start
        processing (inclusive).
    @param end {datetime.datetime} is the time at which to stop
        processing (exclusive).

    A squid access log line looks like:
        1193916806.757  39053 135.196.89.95 TCP_MISS/302 520 GET http://www.activestate.com/store/activeperl/ - DIRECT/127.0.0.1 text/html
    Yields records like this:
        {'box_id': 'box7',
         'bytes': '172',
         'code': 'TCP_IMS_HIT',
         'contenttype': 'image/gif',
         'elapsed': '5',
         'method': 'GET',
         'peerhost': '-',
         'peerstatus': 'NONE',
         'remotehost': '87.112.19.156',
         'rfc931': '-',
         'status': '304',
         'time': datetime.datetime(2007, 11, 2, 0, 59, 59, 982000),
         'timestamp': '1193990399.982',
         'url': 'http://www.activestate.com/_images/icons/header-cart-icon_on.gif'}

    This generator knows how to look back to previous logs to deal with
    skew from log rotation not happened at exactly midnight on a given
    day.
    """
    # Get a log record stream for each box.
    stream_from_box_id = {}
    for box_id, box_dir in boxes.items():
        stream = squid_access_log_stream(box_id, box_dir, start, end)
        stream_from_box_id[box_id] = stream

    # Prime the pump: get the first record from each stream.
    next_recs = []  # (<next-record>, <box_id>)
    for box_id, stream in stream_from_box_id.items():  # prime the pump
        try:
            next_recs.append( (stream.next(), box_id) )
        except StopIteration:
            del stream_from_box_id[box_id] # No more records from this stream.

    while next_recs:
        # Pick the earliest record of those from all the boxes and
        # return it.
        next_recs.sort(key=lambda r: r[0]["time"])
        rec, box_id = next_recs.pop(0)
        yield rec
        try:
            next_recs.insert(0, (stream_from_box_id[box_id].next(), box_id))
        except StopIteration:
            del stream_from_box_id[box_id] # No more records from this stream.



#---- useragent log record generation

# Examples:
#   202.130.144.158 [01/Nov/2007:04:19:40 -0700] "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)"
#   65.55.208.210 [01/Nov/2007:04:19:40 -0700] "msnbot/1.0 (+http://search.msn.com/msnbot.htm)"
#   65.55.208.210 [01/Nov/2007:04:19:40 -0800] "msnbot/1.0 (+http://search.msn.com/msnbot.htm)"
_useragent_log_re = re.compile(r"""^
    (?P<remotehost>\d+\.\d+\.\d+\.\d+)
    \s+\[(?P<timestamp>.*?)\]
    \s+"(?P<useragent>.*?)"
    $""", re.M | re.X)

def squid_useragent_log_stream(box_id, box_dir, start, end):
    assert exists(box_dir)
    assert isinstance(start, datetime.datetime)
    assert isinstance(end, datetime.datetime)
    assert end > start, "end (%s) must be later than start (%s)" % (end, start)

    def datetime_from_timestamp(timestamp):
        """'01/Nov/2007:04:19:40 -0700' -> datetime.datetime(...)"""
        # Drop the timezone info for now, because I don't believe we
        # need to do anything with it. The unix-timestamps from the
        # other logs (access.log, referer.log) are, presumably,
        # localtime. Dropping the tz from these timestamps gives us
        # local time as well.
        timestamp = timestamp.rsplit(None, 1)[0]
        timestamp_format = "%d/%b/%Y:%H:%M:%S"
        return datetime.datetime.strptime(timestamp, timestamp_format)

    # Cache the info needed to more quickly get the log file path and
    # offset for the first record for the `start`.
    #   cache = {("useragent", box_dir, start): (path, md5sum, offset)}
    cache_path = ".combindedlog-cache.pickle"
    if exists(cache_path):
        f = open(cache_path, 'rb')
        try:
            cache = pickle.load(f)
        finally:
            f.close()
    else:
        cache = {}
    cache_key = ("useragent", normpath(abspath(box_dir)), str(start))
    if cache_key in cache:
        path, md5sum, offset = cache[cache_key]
        curr_md5sum = md5(open(path, 'rb').read()).hexdigest()
        if curr_md5sum != md5sum:
            #log.debug("out-of-date offset info in cache")
            del cache[cache_key]

    if cache_key in cache:
        #log.debug("offset info in cache: `%s', offset=%r", path, offset)
        log.debug("opening `%s'", path)
        fin = gzip.open(path, 'rb')
        fin.seek(offset)
        on_deck = []
        day_str = splitext(basename(path))[0].split('-')[-1]
        day = datetime.date(year=int(day_str[:4]), month=int(day_str[4:6]),
                            day=int(day_str[6:]))
    else:
        # Find the first log record in this file that is *before* the
        # start of `start` (to ensure we get all records for that time
        # period).
        day = datetime.date(start.year, start.month, start.day)
        while True:
            path = join(box_dir, "useragent.log-%s.gz" % day.strftime("%Y%m%d"))
            if not exists(path):
                raise Error("cannot get first log record for %s: `%s' does not exist"
                            % (start, path))
            log.debug("opening `%s'", path)
            fin = gzip.open(path, 'rb')
            offset = fin.offset
            line = fin.next()
            m = _useragent_log_re.match(line)
            if not m:
                raise Error("couldn't match line in %s[%s:%s]: %r"
                            % (path, offset, fin.offset, line))
            t = datetime_from_timestamp(m.group("timestamp"))
            if t < start:
                log.debug("first record for %s IS in `%s'", start, path)
                break
            else:
                log.debug("first record for %s is NOT in `%s'", start, path)

            day = day - datetime.timedelta(1)

        # Seek forward throw log file until find first record for `start`.
        log.debug("seeking first record for %s in `%s'", start, path)
        for line in fin:
            m = _useragent_log_re.match(line)
            if not m:
                raise Error("couldn't match line in %s[%s:%s]: %r"
                            % (path, offset, fin.offset, line))
            t = datetime_from_timestamp(m.group("timestamp"))
            if t >= start:
                # This is the first record for `start`.
                log.debug("found first record for %s: %s", start, t)
                break
            offset = fin.offset
        else:
            raise Error("first log record for %s was not found in `%s'"
                        % (start, path))
        on_deck = [line]

    # Update the offsets cache.
    curr_md5sum = md5(open(path, 'rb').read()).hexdigest()
    cache[cache_key] = (normpath(abspath(path)), curr_md5sum, offset)
    #log.debug("update offset cache: %s -> %s", cache_key, cache[cache_key])
    f = open(cache_path, 'wb')
    try:
        cache = pickle.dump(cache, f)
    finally:
        f.close()

    # Assumptions:
    #   `fin` is a file handle seeked to the start of the line for the
    #       first log record for `start`.
    #   `day` is a datetime.date instance for the day of this log file
    while True:
        done = False
        offset = fin.offset
        for line in itertools.chain(on_deck, fin):
            m = _useragent_log_re.match(line)
            if not m:
                raise Error("couldn't match line in %s[%s:%s]: %r"
                            % (path, offset, fin.offset, line))
            d = m.groupdict()
            d["time"] = datetime_from_timestamp(d["timestamp"])
            if d["time"] >= end:
                done = True
                break
            d["box_id"] = box_id
            yield d
            offset = fin.offset

        fin.close()
        if done:
            break
        else:
            day = day + datetime.timedelta(1)
            path = join(box_dir, "useragent.log-%s.gz" % day.strftime("%Y%m%d"))
            if not exists(path):
                raise Error("cannot get all log records to %s: `%s' does not exist"
                            % (end, path))
            log.debug("opening `%s'", path)
            fin = gzip.open(path, 'rb')
            on_deck = []

def merged_squid_useragent_log_stream(boxes, start, end):
    """Generate useragent log records from multiple squid-format log files
    like this:

        $box_dir/useragent.log-YYYYMMDD.gz

    @param boxes {dict} is a mapping of box id to
        dir in which the useragent logs are found. E.g.,
            {'box14': 'box14/squid', ...}
    @param start {datetime.datetime} is the time from which to start
        processing (inclusive).
    @param end {datetime.datetime} is the time at which to stop
        processing (exclusive).

    A squid useragent log line looks like:
        XXX
    Yields records like this:
        {'box_id': 'box7',
         'useragent': '...',
         'time': datetime.datetime(2007, 11, 2, 0, 59, 59, 982000),
         'timestamp': '1193990399.982',
         'remotehost': '123.123.123.123'}

    This generator knows how to look back to previous logs to deal with
    skew from log rotation not happened at exactly midnight on a given
    day.
    """
    # Get a log record stream for each box.
    stream_from_box_id = {}
    for box_id, box_dir in boxes.items():
        stream = squid_useragent_log_stream(box_id, box_dir, start, end)
        stream_from_box_id[box_id] = stream

    # Prime the pump: get the first record from each stream.
    next_recs = []  # (<next-record>, <box_id>)
    for box_id, stream in stream_from_box_id.items():  # prime the pump
        try:
            next_recs.append( (stream.next(), box_id) )
        except StopIteration:
            del stream_from_box_id[box_id] # No more records from this stream.

    while next_recs:
        # Pick the earliest record of those from all the boxes and
        # return it.
        next_recs.sort(key=lambda r: r[0]["time"])
        rec, box_id = next_recs.pop(0)
        yield rec
        try:
            next_recs.insert(0, (stream_from_box_id[box_id].next(), box_id))
        except StopIteration:
            del stream_from_box_id[box_id] # No more records from this stream.



#---- referer log record generation

# http://proxy.nsysu.edu.tw/FAQ/FAQ-6.html
# This doesn't mention squid referer logs. Is this ActiveState's own
# thing?
#
# Examples:
#   1193916020.312 212.85.28.67 http://www.activestate.com/Products/activeperl/ http://www.activestate.com/_images/icons/header-cart-icon_on.gif
#   1193916020.454 212.85.28.67 http://www.activestate.com/Products/activeperl/ http://www.activestate.com/store/activeperl/
_referer_log_re = re.compile(r"""^
    (?P<timestamp>\d+\.\d+)
    \s+(?P<remotehost>\d+\.\d+\.\d+\.\d+)
    \s+(?P<referer>.*?)
    \s+(?P<url>.*?)
    $""", re.M | re.X)

def squid_referer_log_stream(box_id, box_dir, start, end):
    assert exists(box_dir)
    assert isinstance(start, datetime.datetime)
    assert isinstance(end, datetime.datetime)
    assert end > start, "end (%s) must be later than start (%s)" % (end, start)

    # Cache the info needed to more quickly get the log file path and
    # offset for the first record for the `start`.
    #   cache = {("referer", box_dir, start): (path, md5sum, offset)}
    cache_path = ".combindedlog-cache.pickle"
    if exists(cache_path):
        f = open(cache_path, 'rb')
        try:
            cache = pickle.load(f)
        finally:
            f.close()
    else:
        cache = {}
    cache_key = ("referer", normpath(abspath(box_dir)), str(start))
    if cache_key in cache:
        path, md5sum, offset = cache[cache_key]
        curr_md5sum = md5(open(path, 'rb').read()).hexdigest()
        if curr_md5sum != md5sum:
            #log.debug("out-of-date offset info in cache")
            del cache[cache_key]

    if cache_key in cache:
        #log.debug("offset info in cache: `%s', offset=%r", path, offset)
        log.debug("opening `%s'", path)
        fin = gzip.open(path, 'rb')
        fin.seek(offset)
        on_deck = []
        day_str = splitext(basename(path))[0].split('-')[-1]
        day = datetime.date(year=int(day_str[:4]), month=int(day_str[4:6]),
                            day=int(day_str[6:]))
    else:
        # Find the first log record in this file that is *before* the
        # start of `start` (to ensure we get all records for that time
        # period).
        day = datetime.date(start.year, start.month, start.day)
        while True:
            path = join(box_dir, "referer.log-%s.gz" % day.strftime("%Y%m%d"))
            if not exists(path):
                raise Error("cannot get first log record for %s: `%s' does not exist"
                            % (start, path))
            log.debug("opening `%s'", path)
            fin = gzip.open(path, 'rb')
            offset = fin.offset
            line = fin.next()
            timestamp = float(line.split(None, 1)[0])
            t = datetime.datetime.fromtimestamp(timestamp)
            if t < start:
                log.debug("first record for %s IS in `%s'", start, path)
                break
            else:
                log.debug("first record for %s is NOT in `%s'", start, path)

            day = day - datetime.timedelta(1)

        # Seek forward throw log file until find first record for `start`.
        log.debug("seeking first record for %s in `%s'", start, path)
        for line in fin:
            timestamp = float(line.split(None, 1)[0])
            t = datetime.datetime.fromtimestamp(timestamp)
            if t >= start:
                # This is the first record for `start`.
                log.debug("found first record for %s: %s", start, t)
                break
            offset = fin.offset
        else:
            raise Error("first log record for %s was not found in `%s'"
                        % (start, path))
        on_deck = [line]

    # Update the offsets cache.
    curr_md5sum = md5(open(path, 'rb').read()).hexdigest()
    cache[cache_key] = (normpath(abspath(path)), curr_md5sum, offset)
    #log.debug("update offset cache: %s -> %s", cache_key, cache[cache_key])
    f = open(cache_path, 'wb')
    try:
        cache = pickle.dump(cache, f)
    finally:
        f.close()

    # Assumptions:
    #   `fin` is a file handle seeked to the start of the line for the
    #       first log record for `start`.
    #   `day` is a datetime.date instance for the day of this log file
    while True:
        done = False
        offset = fin.offset
        for line in itertools.chain(on_deck, fin):
            m = _referer_log_re.match(line)
            if not m:
                raise Error("couldn't match line in %s[%s:%s]: %r"
                            % (path, offset, fin.offset, line))
            d = m.groupdict()
            d["time"] = datetime.datetime.fromtimestamp(float(d["timestamp"]))
            if d["time"] >= end:
                done = True
                break
            d["box_id"] = box_id
            yield d
            offset = fin.offset

        fin.close()
        if done:
            break
        else:
            day = day + datetime.timedelta(1)
            path = join(box_dir, "referer.log-%s.gz" % day.strftime("%Y%m%d"))
            if not exists(path):
                raise Error("cannot get all log records to %s: `%s' does not exist"
                            % (end, path))
            log.debug("opening `%s'", path)
            fin = gzip.open(path, 'rb')
            on_deck = []

def merged_squid_referer_log_stream(boxes, start, end):
    """Generate referer log records from multiple squid-format log files
    like this:

        $box_dir/referer.log-YYYYMMDD.gz

    @param boxes {dict} is a mapping of box id to
        dir in which the referer logs are found. E.g.,
            {'box14': 'box14/squid', ...}
    @param start {datetime.datetime} is the time from which to start
        processing (inclusive).
    @param end {datetime.datetime} is the time at which to stop
        processing (exclusive).

    A squid referer log line looks like:
        1193916020.454 212.85.28.67 http://www.activestate.com/Products/activeperl/ http://www.activestate.com/store/activeperl/
    Yields records like this:
        {'box_id': 'box7',
         'referer': 'http://www.activestate.com/Products/activeperl/'
         'time': datetime.datetime(2007, 11, 2, 0, 59, 59, 982000),
         'timestamp': '1193990399.982',
         'url': 'http://www.activestate.com/store/activeperl/'}

    This generator knows how to look back to previous logs to deal with
    skew from log rotation not happened at exactly midnight on a given
    day.
    """
    # Get a log record stream for each box.
    stream_from_box_id = {}
    for box_id, box_dir in boxes.items():
        stream = squid_referer_log_stream(box_id, box_dir, start, end)
        stream_from_box_id[box_id] = stream

    # Prime the pump: get the first record from each stream.
    next_recs = []  # (<next-record>, <box_id>)
    for box_id, stream in stream_from_box_id.items():  # prime the pump
        try:
            next_recs.append( (stream.next(), box_id) )
        except StopIteration:
            del stream_from_box_id[box_id] # No more records from this stream.

    while next_recs:
        # Pick the earliest record of those from all the boxes and
        # return it.
        next_recs.sort(key=lambda r: r[0]["time"])
        rec, box_id = next_recs.pop(0)
        yield rec
        try:
            next_recs.insert(0, (stream_from_box_id[box_id].next(), box_id))
        except StopIteration:
            del stream_from_box_id[box_id] # No more records from this stream.




#---- internal support stuff

class _NoReflowFormatter(optparse.IndentedHelpFormatter):
    """An optparse formatter that does NOT reflow the description."""
    def format_description(self, description):
        return description or ""

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

def _setup_logging(stream=None):
    """Do logging setup:

    We want a prettier default format:
         do: level: ...
    Spacing. Lower case. Skip " level:" if INFO-level. 
    """
    hdlr = logging.StreamHandler(stream)
    defaultFmt = "%(name)s: %(levelname)s: %(message)s"
    infoFmt = "%(name)s: %(message)s"
    fmtr = _PerLevelFormatter(fmt=defaultFmt,
                              fmtFromLevel={logging.INFO: infoFmt})
    hdlr.setFormatter(fmtr)
    logging.root.addHandler(hdlr)
    log.setLevel(logging.INFO)

def _parse_time(usage, time_str):
    """Return a datetime.datetime() instance for the given time string.
    A number of formats are accepted.
    """
    formats = [
        ("YYYYMMDD", "%Y%m%d"),
        ("YYYY-MM-DD", "%Y-%m-%d"),
        ("YYYYMMDD HH:MM", "%Y%m%d %H:%M"),
        ("YYYY-MM-DD HH:MM", "%Y-%m-%d %H:%M"),
        ("YYYYMMDD HH:MM:SS", "%Y%m%d %H:%M:%S"),
        ("YYYY-MM-DD HH:MM:SS", "%Y-%m-%d %H:%M:%S"),
    ]
    for summary, format in formats:
        try:
            t = datetime.datetime.strptime(time_str, format)
        except ValueError:
            pass
        else:
            #log.debug("parsed %r with %r format", time_str, summary)
            return t
    else:
        raise ValueError("could not determine %s time from %r: does not "
                         "match any of the accepted patterns ('%s')"
                         % (usage, time_str,
                            "', '".join(s for s,f in formats)))

def _nice_datetime_str(t):
    assert not t.tzinfo
    if t.hour == t.minute == t.second == t.microsecond == 0:
        return str(datetime.date(t.year, t.month, t.day))
    else:
        return str(t)


#---- mainline

def main(argv):
    usage = "usage: %prog [[START] END]"
    version = "%prog "+__version__
    parser = optparse.OptionParser(usage=usage,
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
    parser.add_option("-f", "--format", 
        help="output format: "
             "apache-combined (default, apache-style 'combined' log format), "
             "dict (a stream of Python dicts, aka 'pylog'), "
             "dict-pretty (a pprint'd stream of Python dicts)")
    parser.add_option("-d", "--domain", 
        help="Domain to which to restrict output. "
             "The 'apache-combined' log format only supports output for one "
             "domain. So, to use this format you must either use "
             "'--domain DOMAIN' or specify an output path with 'DOMAIN' in it "
             "-- which will be replaced with the actual domain (e.g. "
             "'-o DOMAIN/combined-20071101.log.gz').")
    parser.add_option("-o", "--output", metavar="PATH", dest="output_path",
        help="Path to which to output the combined log. If not specified, "
             "outputs to stdout. If a given path ends with '.gz', the "
             "output log with be gzipped. If the path contains 'DOMAIN' it "
             "will be replaced by the actual record domain -- possibly "
             "creating multiple log files.")
    parser.add_option("-i", "--include", dest="includes",
        action="append", metavar="FIELD:REGEX",
        help="Include only records matching the given includes. E.g. "
             "'url=http://www.activestate.com/.*' will include only "
             "records for www.activestate.com.")
    parser.add_option("-x", "--exclude", dest="excludes",
        action="append", metavar="FIELD:REGEX",
        help="Exclude records matching the given excludes. E.g. "
             "'contenttype=image/.*' will exclude all records of "
             "content-type 'image/png', 'image/gif', etc.")
    parser.set_defaults(log_level=logging.INFO, format="apache-combined",
                        dry_run=False, output_path=None, includes=[],
                        excludes=[], domain=None)
    opts, args = parser.parse_args()
    log.setLevel(opts.log_level)

    # Validate options.
    if opts.format == "apache-combined" and not opts.domain \
       and not (opts.output_path and "DOMAIN" in opts.output_path):
        raise Error("invalid options: If using 'apache-combined' output "
                    "format (the default --format) and --domain was not "
                    "specified, then --output must be used and its value "
                    "must contain 'DOMAIN' (which will be replaced by the "
                    "actual domain names. Example usage might be: "
                    "'-o DOMAIN/combined.log'")

    # Prepare includes/excludes.
    includes = []
    for i in opts.includes:
        field, pattern = i.split('=', 1)
        includes.append( (field, re.compile(pattern)) )
    excludes = []
    for i in opts.excludes:
        field, pattern = i.split('=', 1)
        excludes.append( (field, re.compile(pattern)) )

    # Default is 2 days ago (b/c can't do yesterday or today because of
    # logs).
    today = datetime.date.today()
    two_days_ago = datetime.date.today() - datetime.timedelta(days=2)
    default_start = datetime.datetime(two_days_ago.year, two_days_ago.month,
        two_days_ago.day)
    if len(args) > 2:
        raise Error("incorrect number of args (see `%s --help')" % argv[0])
    elif len(args) == 0:
        start = default_start
        end = start + datetime.timedelta(days=1)
    elif len(args) == 1:
        start = _parse_time("start", args[0])
        end = start + datetime.timedelta(days=1)
    elif len(args) == 2:
        start = _parse_time("start", args[0])
        end = _parse_time("end", args[1])

    def _file_from_path(path, domain, cache):
        if path is None:
            return sys.stdout
        elif domain is None or "DOMAIN" not in path:
            key = (path, None)
        else:
            path = path.replace("DOMAIN", domain)
            key = (path, domain)
        if key not in cache:
            dir = dirname(path) or os.curdir
            if not exists(dir):
                os.makedirs(dir)
            log.debug("create `%s' output file", path)
            if path.endswith(".gz"):
                f = gzip.open(path, 'wb')
            else:
                f = open(path, 'wb')
            cache[key] = f
        return cache[key]

    log.info("combine squid logs for %s to %s (format=%s)",
             _nice_datetime_str(start), _nice_datetime_str(end),
             opts.format)
    trace_start = datetime.datetime.now()
    if not opts.dry_run:
        records = combinelog(boxes, start, end,
            includes=includes, excludes=excludes,
            # Normalize the given domain.
            domain=(opts.domain and opts.domain.lower() or None))
        output_file_cache = {}
        try:
            if opts.format in ("dict", "pylog"):
                for r in records:
                    f = _file_from_path(opts.output_path, r["domain"],
                                        output_file_cache)
                    f.write(str(r) + '\n')
            elif opts.format == "dict-pretty":
                for r in records:
                    f = _file_from_path(opts.output_path, r["domain"],
                                        output_file_cache)
                    f.write(pformat(r) + '\n')
            elif opts.format == "apache-combined":
                for r in records:
                    f = _file_from_path(opts.output_path, r["domain"],
                                        output_file_cache)
                    f.write(apache_combined_record(r) + '\n')
        finally:
            while output_file_cache:
                (path, domain), f = output_file_cache.popitem()
                f.close()
                if domain:
                    log.info("`%s' records written to `%s'", domain, path)
                else:
                    log.info("records written to `%s'", path)
    trace_end = datetime.datetime.now()
    log.info("completed in %s", trace_end-trace_start)


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
            import traceback
            print
            traceback.print_exception(*exc_info)
        sys.exit(1)
    else:
        sys.exit(retval)



