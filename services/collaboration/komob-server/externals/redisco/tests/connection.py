import unittest
import redisco

from distutils.version import LooseVersion as Version

class ConnectionTestCase(unittest.TestCase):

    def test_redis_version(self):
        self.assertTrue(Version(redisco.redis.__version__) >= '2')

    def test_redis_server(self):
        redis_server_version = redisco.connection.info()['redis_version']
        self.assertTrue(Version(redis_server_version) > '1.2')

