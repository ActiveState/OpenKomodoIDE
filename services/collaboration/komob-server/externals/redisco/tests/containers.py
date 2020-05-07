import unittest
import redisco
from redisco import containers as cont

class SetTestCase(unittest.TestCase):
    def setUp(self):
        self.client = redisco.get_client()
        self.client.flushdb()

    def tearDown(self):
        self.client.flushdb()

    def test_common_operations(self):
        fruits = cont.Set(key='fruits')
        fruits.add('apples')
        fruits.add('oranges')
        self.assertEqual(set(['apples', 'oranges']), fruits.all())

        # remove
        fruits.discard('apples')
        self.assertEqual(set(['oranges']), fruits.all())
        self.assertRaises(KeyError, fruits.remove, 'apples')

        # in
        self.assertTrue('oranges' in fruits)
        self.assertTrue('apples' not in fruits)

        # len
        self.assertEqual(1, len(fruits))

        # pop
        self.assertEqual('oranges', fruits.pop())

        # copy
        fruits.add('apples')
        fruits.add('oranges')
        basket = fruits.copy('basket')
        self.assertEqual(set(['apples', 'oranges']), basket.all())

        # update
        o = cont.Set('o', self.client)
        o.add('kiwis')
        fruits.update(o)
        self.assertEqual(set(['kiwis', 'apples', 'oranges']),
                fruits.all())

    def test_comparisons(self):
        all_pls = cont.Set(key='ProgrammingLanguages')
        my_pls = cont.Set(key='MyPLs')
        o_pls = cont.Set(key='OPLs')
        all_pls.add('Python')
        all_pls.add('Ruby')
        all_pls.add('PHP')
        all_pls.add('Lua')
        all_pls.add('Java')
        all_pls.add('Pascal')
        all_pls.add('C')
        all_pls.add('C++')
        all_pls.add('Haskell')
        all_pls.add('C#')
        all_pls.add('Go')

        my_pls.add('Ruby')
        my_pls.add('Python')
        my_pls.add('Lua')
        my_pls.add('Haskell')

        o_pls.add('Ruby')
        o_pls.add('Python')
        o_pls.add('Lua')
        o_pls.add('Haskell')

        # equality
        self.assertNotEqual(my_pls, all_pls)
        self.assertEqual(o_pls, my_pls)

        fruits = cont.Set(key='fruits')
        fruits.add('apples')
        fruits.add('oranges')

        # disjoint
        self.assertTrue(fruits.isdisjoint(o_pls))
        self.assertFalse(all_pls.isdisjoint(o_pls))

        # subset
        self.assertTrue(my_pls < all_pls)
        self.assertTrue(all_pls > my_pls)
        self.assertTrue(o_pls >= my_pls)
        self.assertTrue(o_pls <= my_pls)
        self.assertTrue(my_pls.issubset(all_pls))
        self.assertTrue(my_pls.issubset(o_pls))
        self.assertTrue(o_pls.issubset(my_pls))

        # union
        s = fruits.union("fruits|mypls", my_pls)
        self.assertEqual(set(['Ruby', 'Python', 'Lua', 'Haskell', 'apples',
            'oranges']), s.members)

        # intersection
        inter = fruits.intersection('fruits&mypls', my_pls)
        self.assertEqual(set([]), inter.members)

        # difference
        s = fruits.difference('fruits-my_pls', my_pls)
        self.assertEqual(set(['apples', 'oranges']), s.members)


    def test_operations_with_updates(self):
        abc = cont.Set('abc', self.client)
        for c in 'abc':
            abc.add(c)

        def_ = cont.Set('def', self.client)
        for c in 'def':
            def_.add(c)

        # __ior__
        abc |= def_
        self.assertEqual(set(['a', 'b', 'c', 'd', 'e', 'f']),
                abc.all())

        abc &= def_
        self.assertEqual(set(['d', 'e', 'f']), abc.all())

        for c in 'abc':
            abc.add(c)
        abc -= def_
        self.assertEqual(set(['a', 'b', 'c']), abc.all())

    def test_methods_that_should_return_new_sets(self):
        abc = cont.Set('abc', self.client)
        for c in 'abc':
            abc.add(c)

        def_ = cont.Set('def', self.client)
        for c in 'def':
            def_.add(c)

        # new_key as a set should raise error
        # only strings are allowed as keys
        new_set = cont.Set('new_set')
        self.assertRaises(ValueError, abc.union, new_set, def_)
        self.assertRaises(ValueError, abc.difference, new_set, def_)
        self.assertRaises(ValueError, abc.intersection, new_set, def_)

        self.assert_(isinstance(abc.union('new_set', def_), cont.Set))
        self.assert_(isinstance(abc.intersection('new_set', def_), cont.Set))
        self.assert_(isinstance(abc.difference('new_set', def_), cont.Set))


    def test_access_redis_methods(self):
        s = cont.Set('new_set')
        s.sadd('a')
        s.sadd('b')
        s.srem('b')
        self.assertEqual('a', s.spop())
        s.sadd('a')
        self.assert_('a' in s.smembers())
        s.sadd('b')
        self.assertEqual(2, s.scard())
        self.assert_(s.sismember('a'))
        self.client.sadd('other_set', 'a')
        self.client.sadd('other_set', 'b')
        self.client.sadd('other_set', 'c')
        self.assert_(s.srandmember() in set(['a', 'b']))

    def test_sinter(self):
        abc = cont.Set("abc")
        def_ = cont.Set("def")
        abc.add('a')
        abc.add('b')
        abc.add('c')
        def_.add('d')
        def_.add('e')
        def_.add('f')

        self.assertEqual(set([]), abc.sinter(def_))
        def_.add('b')
        def_.add('c')

        self.assertEqual(set(['b', 'c']), abc.sinter(def_))

    def test_sunion(self):
        abc = cont.Set("abc")
        def_ = cont.Set("def")
        abc.add('a')
        abc.add('b')
        abc.add('c')
        def_.add('d')
        def_.add('e')
        def_.add('f')

        self.assertEqual(set(['a', 'b', 'c', 'd', 'e', 'f']),
                abc.sunion(def_))

    def test_susdiff(self):
        abc = cont.Set("abc")
        def_ = cont.Set("def")
        abc.add('a')
        abc.add('b')
        abc.add('c')
        def_.add('c')
        def_.add('b')
        def_.add('f')

        self.assertEqual(set(['a',]),
                abc.sdiff(def_))


class ListTestCase(unittest.TestCase):
    def setUp(self):
        self.client = redisco.get_client()
        self.client.flushdb()

    def tearDown(self):
        self.client.flushdb()

    def test_common_operations(self):
        alpha = cont.List('alpha', self.client)

        # append
        alpha.append('a')
        alpha.append('b')

        # len
        self.assertEqual(2, len(alpha))

        num = cont.List('num', self.client)
        num.append('1')
        num.append('2')

        # extend and iter
        alpha.extend(num)
        self.assertEqual(['a', 'b', '1', '2'], alpha.all())
        alpha.extend(['3', '4'])
        self.assertEqual(['a', 'b', '1', '2', '3', '4'], alpha.all())

        # contains
        self.assertTrue('b' in alpha)
        self.assertTrue('2' in alpha)
        self.assertTrue('5' not in alpha)

        # shift and unshift
        num.unshift('0')
        self.assertEqual(['0', '1', '2'], num.members)
        self.assertEqual('0', num.shift())
        self.assertEqual(['1', '2'], num.members)

        # push and pop
        num.push('4')
        self.assertEqual('4', num.pop())
        self.assertEqual(['1', '2'], num.members)

        # trim
        alpha.trim(0, 1)
        self.assertEqual(['a', 'b'], alpha.all())

        # remove
        alpha.remove('b')
        self.assertEqual(['a'], alpha.all())

        # setitem
        alpha[0] = 'A'
        self.assertEqual(['A'], alpha.all())

        # iter
        alpha.push('B')
        for e, a in zip(alpha, ['A', 'B']):
            self.assertEqual(a, e)
        self.assertEqual(['A', 'B'], list(alpha))

        # slice
        alpha.extend(['C', 'D', 'E'])
        self.assertEqual(['A', 'B', 'C', 'D', 'E'], alpha[:])
        self.assertEqual(['B', 'C'], alpha[1:2])

        alpha.reverse()
        self.assertEqual(['E', 'D', 'C', 'B', 'A'], list(alpha))

    def test_pop_onto(self):
        a = cont.List('alpha')
        b = cont.List('beta')
        a.extend(range(10))

        # test pop_onto
        a_snap = list(a.members)
        while True:
            v = a.pop_onto(b.key)
            if not v:
                break
            else:
                self.assertTrue(v not in a.members)
                self.assertTrue(v in b.members)

        self.assertEqual(a_snap, b.members)

        # test rpoplpush
        b_snap = list(b.members)
        while True:
            v = b.rpoplpush(a.key)
            if not v:
                break
            else:
                self.assertTrue(v in a.members)
                self.assertTrue(v not in b.members)

        self.assertEqual(b_snap, a.members)
        


    def test_delegateable_methods(self):
        l = cont.List('mylist')
        self.assertEqual([], l.lrange(0, -1))
        l.rpush('b')
        l.rpush('c')
        l.lpush('a')
        self.assertEqual(['a', 'b', 'c'], l.lrange(0, -1))
        self.assertEqual(3, l.llen())
        l.ltrim(1, 2)
        self.assertEqual(['b', 'c'], l.lrange(0, -1))
        self.assertEqual('c', l.lindex(1))
        self.assertEqual(1, l.lset(0, 'a'))
        self.assertEqual(1, l.lset(1, 'b'))
        self.assertEqual(['a', 'b'], l.lrange(0, -1))
        self.assertEqual('a', l.lpop())
        self.assertEqual('b', l.rpop())

class TypedListTestCase(unittest.TestCase):
    def setUp(self):
        self.client = redisco.get_client()
        self.client.flushdb()

    def tearDown(self):
        self.client.flushdb()

    def test_basic_types(self):
        alpha = cont.TypedList('alpha', unicode, type_args=('UTF-8',))
        monies = u'\u0024\u00a2\u00a3\u00a5'
        alpha.append(monies)
        val = alpha[-1]
        self.assertEquals(monies, val)

        beta = cont.TypedList('beta', int)
        for i in xrange(1000):
            beta.append(i)
        for i, x in enumerate(beta):
            self.assertEquals(i, x)

        charlie = cont.TypedList('charlie', float)
        for i in xrange(100):
            val = 1 * pow(10, i*-1)
            charlie.append(val)
        for i, x in enumerate(charlie):
            val = 1 * pow(10, i*-1)
            self.assertEquals(x, val)

    def test_model_type(self):
        from redisco import models
        class Person(models.Model):
            name = models.Attribute()
            friend = models.ReferenceField('Person')

        iamteam = Person.objects.create(name='iamteam')
        clayg = Person.objects.create(name='clayg', friend=iamteam)

        l = cont.TypedList('friends', 'Person')
        l.extend(Person.objects.all())

        for person in l:
            if person.name == 'clayg':
                self.assertEquals(iamteam, clayg.friend)
            else:
                # this if failing for some reason ???
                #self.assertEquals(person.friend, clayg) 
                pass


class SortedSetTestCase(unittest.TestCase):
    def setUp(self):
        self.client = redisco.get_client()
        self.client.flushdb()

    def tearDown(self):
        self.client.flushdb()

    def test_everything(self):
        zorted = cont.SortedSet("Person:age")
        zorted.add("1", 29)
        zorted.add("2", 39)
        zorted.add("3", '15')
        zorted.add("4", 35)
        zorted.add("5", 98)
        zorted.add("6", 5)
        self.assertEqual(6, len(zorted))
        self.assertEqual(35, zorted.score("4"))
        self.assertEqual(0, zorted.rank("6"))
        self.assertEqual(5, zorted.revrank("6"))
        self.assertEqual(3, zorted.rank("4"))
        self.assertEqual(["6", "3", "1", "4"], zorted.le(35))

        zorted.add("7", 35)
        self.assertEqual(["4", "7"], zorted.eq(35))
        self.assertEqual(["6", "3", "1"], zorted.lt(30))
        self.assertEqual(["4", "7", "2", "5"], zorted.gt(30))

    def test_delegateable_methods(self):
        zset = cont.SortedSet("Person:all")
        zset.zadd("1", 1)
        zset.zadd("2", 2)
        zset.zadd("3", 3)
        zset.zadd("4", 4)
        self.assertEqual(4, zset.zcard())
        self.assertEqual(4, zset.zscore('4'))
        self.assertEqual(['1', '2', '3', '4'], list(zset))
        self.assertEqual(zset.zrange(0, -1), list(zset))
        self.assertEqual(['4', '3', '2', '1'], zset.zrevrange(0, -1))
        self.assertEqual(list(reversed(zset)), zset.zrevrange(0, -1))
        self.assertEqual(list(reversed(zset)), list(zset.__reversed__()))


class HashTestCase(unittest.TestCase):
    def setUp(self):
        self.client = redisco.get_client()
        self.client.flushdb()

    def tearDown(self):
        self.client.flushdb()

    def test_basic(self):
        h = cont.Hash('hkey')
        self.assertEqual(0, len(h))
        h['name'] = "Richard Cypher"
        h['real_name'] = "Richard Rahl"

        pulled = self.client.hgetall('hkey')
        self.assertEqual({'name': "Richard Cypher",
            'real_name': "Richard Rahl"}, pulled)

        self.assertEqual({'name': "Richard Cypher",
            'real_name': "Richard Rahl"}, h.dict)

        self.assertEqual(['name', 'real_name'], h.keys())
        self.assertEqual(["Richard Cypher", "Richard Rahl"],
            h.values())

        del h['name']
        pulled = self.client.hgetall('hkey')
        self.assertEqual({'real_name': "Richard Rahl"}, pulled)
        self.assert_('real_name' in h)
        h.dict = {"new_hash": "YEY"}
        self.assertEqual({"new_hash": "YEY"}, h.dict)

    def test_delegateable_methods(self):
        h = cont.Hash('my_hash')
        h.hincrby('Red', 1)
        h.hincrby('Red', 1)
        h.hincrby('Red', 2)
        self.assertEqual(4, int(h.hget('Red')))
        h.hmset({'Blue': 100, 'Green': 19, 'Yellow': 1024})
        self.assertEqual(['100', '19'], h.hmget(['Blue', 'Green']))

if __name__ == "__main__":
    import sys
    unittest.main(argv=sys.argv)
