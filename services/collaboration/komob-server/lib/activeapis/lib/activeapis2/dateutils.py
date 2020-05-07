
"""Some generic datetime utils."""

import time
import datetime


def datetime_strptime(s, format):
    # Python <2.5 doesn't have datetime.datetime.strptime()
    t = time.strptime(s, format)
    dt = datetime.datetime(*t[:6])
    return dt

def date_strptime(s, format):
    dt = datetime_strptime(s, format)
    d = datetime.date(dt.year, dt.month, dt.day)
    return d

## {{{ http://code.activestate.com/recipes/577274/ (r1)
def add_one_month(t):
    """Return a `datetime.date` or `datetime.datetime` (as given) that is
    one month earlier.
    
    Note that the resultant day of the month might change if the following
    month has fewer days:
    
        >>> add_one_month(datetime.date(2010, 1, 31))
        datetime.date(2010, 2, 28)
    """
    import datetime
    one_day = datetime.timedelta(days=1)
    one_month_later = t + one_day
    while one_month_later.month == t.month:  # advance to start of next month
        one_month_later += one_day
    target_month = one_month_later.month
    while one_month_later.day < t.day:  # advance to appropriate day
        one_month_later += one_day
        if one_month_later.month != target_month:  # gone too far
            one_month_later -= one_day
            break
    return one_month_later

def subtract_one_month(t):
    """Return a `datetime.date` or `datetime.datetime` (as given) that is
    one month later.
    
    Note that the resultant day of the month might change if the following
    month has fewer days:
    
        >>> subtract_one_month(datetime.date(2010, 3, 31))
        datetime.date(2010, 2, 28)
    """
    import datetime
    one_day = datetime.timedelta(days=1)
    one_month_earlier = t - one_day
    while one_month_earlier.month == t.month or one_month_earlier.day > t.day:
        one_month_earlier -= one_day
    return one_month_earlier
## end of http://code.activestate.com/recipes/577274/ }}}

def parse_date(date_str, return_datetime=False):
    """Return (<scope>, <datetime.date() instance>) for the given date
    string.  A number of formats are accepted.
    """
    formats = [
        # <scope>, <pattern>, <format>
        ("year", "YYYY", "%Y"),
        ("month", "YYYY-MM", "%Y-%m"),
        ("month", "YYYYMM", "%Y%m"),
        ("day", "YYYY-MM-DD", "%Y-%m-%d"),
        ("day", "YYYYMMDD", "%Y%m%d"),
    ]
    for scope, pattern, format in formats:
        try:
            t = datetime.datetime.strptime(date_str, format)
        except ValueError:
            pass
        else:
            if return_datetime:
                return scope, t
            else:
                return scope, datetime.date(t.year, t.month, t.day)
    else:
        raise ValueError("could not determine date from %r: does not "
                         "match any of the accepted patterns ('%s')"
                         % (date_str, "', '".join(s for s,f in patterns)))


