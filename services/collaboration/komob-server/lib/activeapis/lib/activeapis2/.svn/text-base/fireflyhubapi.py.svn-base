#!/usr/bin/env python

"""A small library for talking to fireflyhub.com.
   WARNING: this API is under heavy development and *will* change.
"""

import os
import logging
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

import paramiko

#---- the main API class

class HubError(Exception): pass

class FireflyHubAPI(object): #(apibase.HttpAPIBase):
    """An interface to the notifications API."""
    DEFAULT_API_URL = "http://fireflyhub.com/api/"

    _api_url = "fireflyhub.com"

    def __init__(self, auth_name=None, auth_password=None, host='fireflyhub.com'):
        self.username = auth_name
        self.password = auth_password
        self.host = host
        self._ssh = None

    def ssh(self, command):
        logging.debug("ssh => %r", command)

        if self._ssh is None:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(self.host, username=self.username, password=self.password)
            self._ssh = ssh

        channel = self._ssh.get_transport().open_session()
        channel.exec_command(command)
        channel.shutdown_write()
        channel.set_combine_stderr(True)
        f = channel.makefile()
        for line in f:
            logging.debug("ssh <- %r", line)
            yield line

    def close(self):
        if self._ssh:
            self._ssh.close()
            self._ssh = None

    def ping(self):
        """ping/

        Send a ping request to the server.

        @returns "pong"
        """
        return ''.join(self.ssh('echo -n "pong"'))

    def mknode(self, sso_id, username):
        """mknode/$sso_id

        Create a new hub node asynchronously.
        
        Right after a node creation process start, a 'hub.event' message 
        with event=started parameter is sent to the message queue.

        Upon the completion, a message with either event=created or 
        event=failed is sent.
        
        @param sso_id {str} A node owner's sso id.
        @returns {str} A node creation job id.
        @raises {HubError} The node creation process has not been started.
        """
        res = ''.join(self.ssh('sudo /firefly/hub/bin/hub mknode %d "%s"' % (long(sso_id),
                                                                             username)))
        if res != 'OK\n':
            raise HubError(res)


#---- mainline

def main(argv):
    """Usage: ./fireflyhubapi.py METHOD ARGS"""
    from os.path import exists, expanduser
    from ConfigParser import SafeConfigParser
    
    # Gather configuration info -- in particular "username/password"
    # credentials required for `api.notify(...)`.
    kwargs = {}
    conf_path = expanduser("~/.fireflyhubapi.ini")
    if exists(conf_path):
        conf = SafeConfigParser()
        conf.read(conf_path)
        section = os.environ.get("FIREFLYHUB_API_URL",
                                 FireflyHubAPI._api_url)
        if conf.has_section(section):
            kwargs["auth_name"] = conf.get(section, "username")
            kwargs["auth_password"] = conf.get(section, "password")
    
    api = FireflyHubAPI(**kwargs)
    method_name, arg_strs = argv[1], argv[2:]
    method = getattr(api, method_name)
    args = []
    for s in arg_strs:
        try:
            args.append(int(s))
        except ValueError:
            args.append(s)
    logging.info("************")
    response = method(*args)
    logging.info(repr(response))
    api.close()

if __name__ == "__main__":
    import sys
    import logging
    if not logging.root.handlers:
        #logging.basicConfig(level=logging.DEBUG)
        logging.basicConfig(level=logging.INFO)
    try:
        sys.exit(main(sys.argv))
    except Exception, e:
        logging.exception('Error: %r', e)
        sys.exit(-1)

