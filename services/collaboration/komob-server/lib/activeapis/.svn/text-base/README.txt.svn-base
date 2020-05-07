ActiveAPIs
==========

<https://svn.activestate.com/repos/activestate/webops/activeapis>

A project to provide a Python package to house interfaces to ActiveState site
APIs (e.g. APIs for account.as.com, store.as.com, etc.). Example usage:

    >>> from activeapis2.accountapi import AccountAPI
    >>> api = AccountAPI()
    >>> api.account_from_user_id(23)
    Account({u'username': u'trentm',
        u'user_id': 23, 
        u'company': u'ActiveState',
        u'is_active': 1,
        u'id': 23,
        u'fullname_ascii': u'Trent Mick',
        u'fullname': u'Trent Mick',
        u'email': u'TrentM@ActiveState.com'})


versions, branches, releases
----------------------------

This is the ActiveAPIs 2.0.x (the trunk) -- and *incompatible* break from
ActiveAPIs 1.0. See CHANGES.md for details on recent changes.

Current active branches are:
- trunk: ActiveAPIs 2.0.x (i.e. the "activeapis2" package).
  <https://svn.activestate.com/repos/activestate/webops/activeapis/trunk>
- branches/1.0.x: 1.0.x maintenance, if any
  <https://svn.activestate.com/repos/activestate/webops/activeapis/branches/1.0.x>

Releases are tagged in
<http://svn.activestate.com/repos/activestate/webops/activeapis/tags/$version>.
The latest current releases are: 2.0.30, 1.0.0.

Releases are also (if remembered) released as Python package sdists to
<http://languages.nas.activestate.com/python/packages/>.


Installing/Deployment
---------------------

Suggested usage is to use an svn:externals to a particular release tag. Add a
line like to `svn propedit svn:externals $DIR`. ActiveAPIs has a dependency
on httplib2, hence the external for that.

    activeapis2 http://svn.activestate.com/repos/activestate/webops/activeapis/tags/$VERSION/lib/activeapis2
    httplib2    http://httplib2.googlecode.com/svn/trunk/httplib2

An alternative way to use this package is to use the released source
distribution from <http://languages.nas.activestate.com/python/packages/>.
See <http://bugs.activestate.com/show_bug.cgi?id=85910#c5> for tips on how to
do that with `easy_install` and `buildout`.


Known Users
-----------

- account.as.com (originally developed for this site)
  https://svn.activestate.com/repos/activestate/sites/account.activestate.com/trunk
- pinc.as.com
  https://svn.activestate.com/repos/activestate/sites/pinc.activestate.com/trunk
- code3.as.com (the future code.as.com)
  https://svn.activestate.com/repos/activestate/sites/code.activestate.com/branches/beta
- Damien's prostudio renewal email sending script (http://svn.activestate.com/repos/activestate/webops/automatic_notifications/renewal_reminders.py)

