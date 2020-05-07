#!/usr/bin/env python

"""A demostration of building on `common.py` to build an API client class.

Module Usage
------------

  >>> from activeapis2.exampleapi import ExampleAPI
  >>> api = ExampleAPI()
  >>> api.ping()
  "pong"
"""

from pprint import pprint
if __name__ == "__main__":
    # Magic to allow command line usage.
    import sys
    from os.path import dirname, abspath
    sys.path.insert(0, dirname(dirname(abspath(__file__))))
from activeapis2 import apibase



class ExampleAPI(apibase.HttpAPIBase):
    DEFAULT_API_URL = "http://example.activestate.com/api/"

    def ping(self):
        """ping

        @returns {str} "pong"
        """
        url = self._api_url + "ping/"
        # Would normally do the following, however there *isn't* a
        # null.activestate.com, so we fake it.
        #   response = self._request_json(url)
        #   return response
        return "pong"
    
    def error(self):
        """raise an error
        
        @raises {ExampleAPI.ServerNotFoundError} Actually tries our non-existant
            API url, so this will fail.
        """
        url = self._api_url + "error/"
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def makeachange(self, foo):
        """Example of a POST to the API."""
        url = self._api_url + "makeachange/"
        # Note: passing a dict as the `body` implies that we want
        # appropriate form encoding.
        response = self._request_json(url, "POST", {"foo": foo})
        #pprint(response)
        return response


#---- mainline (just for play)

def main(argv):
    """Usage: ./exampleapi.py METHOD ARGS"""
    import logging
    from os.path import exists, expanduser
    from activeapis2.apibase import jsonlib
    if not logging.root.handlers:
        logging.basicConfig()
    
    api = ExampleAPI()
    method_name, arg_strs = argv[1], argv[2:]
    method = getattr(api, method_name)
    args = []
    for s in arg_strs:
        try:
            args.append(int(s))
        except ValueError:
            args.append(s)
    try:
        response = method(*args)
    except api.APIError, ex:
        logging.error(ex)
    else:
        #pprint(response)
        print jsonlib.dumps(response, indent=2)

if __name__ == "__main__":
    sys.exit(main(sys.argv))
