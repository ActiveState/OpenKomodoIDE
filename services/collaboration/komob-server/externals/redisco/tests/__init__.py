import os
import unittest
from connection import ConnectionTestCase
from containers import (SetTestCase, ListTestCase, TypedListTestCase, 
        SortedSetTestCase, HashTestCase)
from models import (ModelTestCase, DateFieldTestCase, FloatFieldTestCase,
        BooleanFieldTestCase, ListFieldTestCase, ReferenceFieldTestCase,
        DateTimeFieldTestCase, CounterFieldTestCase, CharFieldTestCase,
        MutexTestCase,)

import redisco
REDIS_DB = int(os.environ.get('REDIS_DB', 10)) # WARNING TESTS FLUSHDB!!!
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6380))
redisco.connection_setup(host="localhost", port=REDIS_PORT, db=REDIS_DB)

typed_list_suite = unittest.TestLoader().loadTestsFromTestCase(TypedListTestCase)

def all_tests():
    suite = unittest.TestSuite()
    suite.addTest(unittest.makeSuite(ConnectionTestCase))
    suite.addTest(unittest.makeSuite(SetTestCase))
    suite.addTest(unittest.makeSuite(ListTestCase))
    suite.addTest(unittest.makeSuite(TypedListTestCase))
    suite.addTest(unittest.makeSuite(SortedSetTestCase))
    suite.addTest(unittest.makeSuite(ModelTestCase))
    suite.addTest(unittest.makeSuite(DateFieldTestCase))
    suite.addTest(unittest.makeSuite(FloatFieldTestCase))
    suite.addTest(unittest.makeSuite(BooleanFieldTestCase))
    suite.addTest(unittest.makeSuite(ListFieldTestCase))
    suite.addTest(unittest.makeSuite(ReferenceFieldTestCase))
    suite.addTest(unittest.makeSuite(DateTimeFieldTestCase))
    suite.addTest(unittest.makeSuite(CounterFieldTestCase))
    suite.addTest(unittest.makeSuite(MutexTestCase))
    suite.addTest(unittest.makeSuite(HashTestCase))
    suite.addTest(unittest.makeSuite(CharFieldTestCase))
    return suite
