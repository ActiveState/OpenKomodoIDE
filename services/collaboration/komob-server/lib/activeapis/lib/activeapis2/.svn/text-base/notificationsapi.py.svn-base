#!/usr/bin/env python

"""A small library for talking to notifications.as.com.

Module Usage
------------

  >>> from activeapis2.notificationsapi import NotificationsAPI
  >>> api = NotificationsAPI(...)
  >>> api.notificationtypes()
  [
    {
      "name": "icanhaz",
      "id": 1
    }
  ]
  >>> api.notificationtype(1)
  {
    ...
  }

  # Sending a notification.
  # `auth_name` is any of the SSO id (int), username or email address for
  # an account on "https://account.activestate.com/". `auth_password` is
  # the Notifications API password (see
  # http://notifications.activestate.com/settings/).
  >>> api = NotificationsAPI(auth_name="...", auth_password="...")
  >>> api.notify(ntid="_icanhaz", to_sso_id=23,
  ...    template_data=None, is_test=True)
  {
    u'id': 1605,
    u'is_debug': 0,
    u'is_sent': 1,
    u'is_test': 1,
    u'send_error': None,
    u'sent_by_sso_id': 1234,
    u'sent_time': u'2009-09-25 14:08:55',
    'template_data': None,
    u'template_data_json': null,
    u'to_sso_data_json': u'{\n "username": "trentm", ...}',
    u'to_sso_id': 23,
    u'type': {u'id': 1, u'name': u'_icanhaz'}
  }


Command-line Usage
------------------

The command-line interface is a quick hack for testing only.
  
  $ ./notificationsapi.py notificationtypes
  [
    {
      "name": "icanhaz",
      "id": 1
    }
  ]
  $ ./notificationsapi.py notificationtype 1
  {
    ...
  }
  

See <http://notifications.activestate.com/about/#api> for details.
"""

from pprint import pprint, pformat
from urllib import urlencode

if __name__ == "__main__":
    # Magic to allow command line usage.
    import sys
    from os.path import dirname, abspath
    sys.path.insert(0, dirname(dirname(abspath(__file__))))
from activeapis2 import utils
jsonlib = utils.jsonlib
from activeapis2 import apibase



#---- the main API class

class NotificationsAPI(apibase.HttpAPIBase):
    """An interface to the notifications API."""
    DEFAULT_API_URL = "http://notifications.activestate.com/api/"

    def notificationtypes(self):
        """notificationtypes/

        @returns {list} List of all (unretired) notification types. E.g.:
            
        [
          {
            "name": "icanhaz",
            "id": 1
          }
        ]
        """
        url = self._api_url + "notificationtypes/"
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def notificationtype(self, ntid):
        """notificationtypes/$ntid/

        @param ntid {int, str} A notification type id, or name.
        @returns {dict} Notification type dict, e.g.:
        
        {
            "from_header": "ActiveState <noreply@activestate.com>", 
            "extra_headers": "", 
            "name": "icanhaz", 
            "bcc_header": "", 
            "id": 1, 
            "updated_time": "2009-06-16 15:57:59", 
            "is_retired": false, 
            "created_time": "2009-06-16 15:54:33", 
            "subject_template": "[ActiveState] I can has ", 
            "body_text_template": "Hello, {{ account.email }}\r\n\r\n{% spaceless %}\r\n{% if thing %}\r\nI can haz {{ thing }}?\r\n{% else %}\r\nPurrrrrrrrrrrr!\r\n{% endif %}\r\n{% endspaceless %}\r\n\r\n--\r\nThe cat\r\n"
        }
        """
        url = self._api_url + "notificationtypes/%s/" % ntid
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def notify(self, ntid, to_sso_id, template_data=None, is_test=True):
        """POST to 'notifications/'
        
        Send a notification. This is an authenticated call, i.e. you will
        need to have set username/password on the constructor.

        @param ntid {int, str} The notification type id (or name) to send.
        @param to_sso_id {int} The SSO id of the recipient. You can lookup
            SSO ids for ActiveState accounts at <http://pinc.activestate.com/>.
        @param template_data {dict} A set of data (other than the automatic
            "account" field) for rendering of the email templates. Optional.
            `datetime.date()` values are rendered as "YYYY-MM-DD".
        @param is_test {boolean} Whether this is a test notification. If
            so, then the email is rendered for `to_sso_id` but actually
            sent to the authorized caller. This is *true* by default as a
            guard against actually sending to customers.
        @returns {dict} The notification dict for the sent email. See the
            following example. If there was a failure sending the email,
            `is_sent` will be `false` and `send_error` will be a full
            traceback giving details.
            
        {
          u'id': 1605,
          u'is_debug': 0,
          u'is_sent': 1,
          u'is_test': 1,
          u'send_error': None,
          u'sent_by_sso_id': 23,
          u'sent_time': u'2009-09-25 14:08:55',
          'template_data': {u'hunger_date': u'2009-09-25', u'thing': u'fud'},
          u'template_data_json': u'{\n "thing": "fud", \n "hunger_date": "2009-09-25"\n}',
          u'to_sso_data_json': u'{\n "username": "trent.mick", ...}',
          u'to_sso_id': 98543,
          u'type': {u'id': 1, u'name': u'_icanhaz'}
        }
        
        TODO: As a convenience allow "to_sso_id" to be an email address and
            can then lookup the sso_id.
        """
        assert isinstance(ntid, (int, long, str))
        assert isinstance(to_sso_id, (int, long))
        assert not template_data or isinstance(template_data, dict)

        url = self._api_url + "notifications/"
        data = {
            "ntid": ntid,
            "to_sso_id": to_sso_id,
        }
        if template_data:
            data["template_data_json"] = jsonlib.dumps(template_data,
                default=utils.json_serialize_default)
        if is_test:
            data["is_test"] = "true"
        response = self._request_json(url, "POST", data)
        #pprint(response)
        return response

    def notifications(self, ntid=None, to_sso_id=None, is_test=None,
            page=None, per_page=None):
        """notifications/?page=$page&...

        Currently there isn't a way to get a number of notifications or
        pages.

        @param ntid {int|str} Optional. A notification type id or name to
            which to limit results.
        @param to_sso_id {int} Optional. An SSO id for the target recipient
            on which to filter results.
        @param is_test {bool} Optional. A filter for test or non-test
            notifications.
        @param page {int} Optional. The page of results to return. Defaults
            to the first page (i.e. the latest notifications).
        @param per_page {int} Optional. The number of results to return in
            a page. Defaults to 25, max is 100.
        @returns {list} List of notifications matching the given criteria.
        @raises {BadRequestError} On a request for an out-of-range page.

        [
          {
            u'id': 1605,
            u'is_debug': 0,
            u'is_sent': 1,
            u'is_test': 1,
            u'send_error': None,
            u'sent_by_sso_id': 23,
            u'sent_time': u'2009-09-25 14:08:55',
            'template_data': {u'hunger_date': u'2009-09-25', u'thing': u'fud'},
            u'template_data_json': u'{\n "thing": "fud", \n "hunger_date": "2009-09-25"\n}',
            u'to_sso_data_json': u'{\n "username": "trent.mick", ...}',
            u'to_sso_id': 98543,
            u'type': {u'id': 1, u'name': u'_icanhaz'}
          },
          ...
        ]
        """
        url = self._api_url + "notifications/"
        query = {}
        if ntid is not None: query["ntid"] = str(ntid)
        if to_sso_id is not None: query["to_sso_id"] = str(to_sso_id)
        if is_test is not None:
            query["is_test"] = {False: "false", True: "true"}[is_test]
        if page is not None: query["page"] = str(page)
        if per_page is not None: query["per_page"] = str(per_page)
        if query:
            url += "?" + urlencode(query)
        response = self._request_json(url)
        
        # parsing the template_data_json in the response into real live Python data;
        # not sure we want to be doing this, though (too heavy?  what about other json data?)
        for n in response:
            if "template_data_json" in n:
                n["template_data"] = jsonlib.loads(n["template_data_json"])
        
        #pprint(response)
        return response



#---- mainline

def main(argv):
    """Usage: ./notificationsapi.py METHOD ARGS"""
    from os.path import exists, expanduser
    from ConfigParser import SafeConfigParser
    
    # Gather configuration info -- in particular "username/password"
    # credentials required for `api.notify(...)`.
    kwargs = {}
    conf_path = expanduser("~/.notificationsapi.ini")
    if exists(conf_path):
        conf = SafeConfigParser()
        conf.read(conf_path)
        section = os.environ.get("NOTIFICATIONS_API_URL",
            NotificationsAPI._api_url)
        if conf.has_section(section):
            kwargs["auth_name"] = conf.get(section, "username")
            kwargs["auth_password"] = conf.get(section, "password")
    
    api = NotificationsAPI(**kwargs)
    method_name, arg_strs = argv[1], argv[2:]
    method = getattr(api, method_name)
    args = []
    for s in arg_strs:
        try:
            args.append(int(s))
        except ValueError:
            args.append(s)
    response = method(*args)
    #pprint(response)
    print jsonlib.dumps(response, indent=2)

if __name__ == "__main__":
    import sys
    import logging
    if not logging.root.handlers:
        logging.basicConfig()
    sys.exit(main(sys.argv))
