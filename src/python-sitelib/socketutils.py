# Copyright (c) 2001-2006 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

import socket

def findOpenPort(start, retries):
    """findOpenPort(9000) => 9002

    Return the first open port greater or equal to the specified one."""    
    
    test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    for i in range(retries):
        port = start+i
        try:
            test_socket.bind(('',port))
            return port
        except socket.error:
            pass
        
    raise "Could not find open port from %d to %d." % (start, start + retries)
