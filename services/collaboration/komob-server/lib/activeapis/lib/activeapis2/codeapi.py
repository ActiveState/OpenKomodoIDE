#!/usr/bin/env python

"""A client library for code.activestate.com (both internal and external
APIs).

Note: The intention is to have a separate external-APIs-only api modules,
probably one that is more standalone (i.e. inline apibase.py stuff) for
public distribution. See "code.activestate.com/client/lib/recipeslib" for
that.

Module Usage
------------

  >>> from activeapis2.codeapi import CodeAPI
  >>> api = CodeAPI()
  XXX


See <http://code.activestate.com/about/#api> for details.
"""

from pprint import pprint, pformat
from urllib import urlencode, quote as urlquote

if __name__ == "__main__":
    # Magic to allow command line usage.
    import sys
    from os.path import dirname, abspath
    sys.path.insert(0, dirname(dirname(abspath(__file__))))
from activeapis2 import utils
jsonlib = utils.jsonlib
from activeapis2 import apibase



#---- the main API class

class CodeAPI(apibase.HttpAPIBase):
    """An interface to code.activestate.com."""
    DEFAULT_API_URL = "http://code.activestate.com/api/"
    #DEFAULT_API_URL = "http://mower.activestate.com:8002/api/"

    def recipe_lang_tags(self, lang):
        """Return the recipe tags for the given language.
        
        @param lang {str} A language name, e.g. 'python'.
        @returns {list} A list of dicts giving tag info. The list is sorted
            by tag name. E.g.:
                [{u'count': 5, u'font_size': 25, u'name': u'algorithms',
                  u'id': 4},
                ...]
            The `font_size` attribute can be used for tag cloud sizing.
        """
        url = self._api_url + "1/recipes/langs/%s/tags/" % urlquote(lang)
        response = self._request_json(url)
        #pprint(response)
        return response
    


#---- mainline

def main(argv):
    """Usage: ./codeapi.py METHOD ARGS"""
    from os.path import exists, expanduser
    from ConfigParser import SafeConfigParser
    
    # Gather configuration info -- in particular "username/password"
    # credentials required for `api.notify(...)`.
    kwargs = {}
    conf_path = expanduser("~/.codeapi.ini")
    if exists(conf_path):
        conf = SafeConfigParser()
        conf.read(conf_path)
        section = os.environ.get("CODE_API_URL", CodeAPI._api_url)
        if conf.has_section(section):
            kwargs["auth_name"] = conf.get(section, "username")
            kwargs["auth_password"] = conf.get(section, "password")
    
    api = CodeAPI(**kwargs)
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
