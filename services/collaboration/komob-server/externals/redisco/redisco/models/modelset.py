"""
Handles the queries.
"""
from attributes import IntegerField, DateTimeField
import redisco
from redisco.containers import SortedSet, Set, List, NonPersistentList
from exceptions import AttributeNotIndexed
from utils import _encode_key
from attributes import ZINDEXABLE

# Model Set
class ModelSet(Set):
    def __init__(self, model_class):
        self.model_class = model_class
        self.key = model_class._key['all']
        self._db = redisco.get_client()
        self._filters = {}
        self._exclusions = {}
        self._zfilters = []
        self._ordering = []
        self._limit = None
        self._offset = None

    #################
    # MAGIC METHODS #
    #################


    def __getitem__(self, index):
        if isinstance(index, slice):
            return map(lambda id: self._get_item_with_id(id), self._set[index])
        else:
            id = self._set[index]
            if id:
                return self._get_item_with_id(id)
            else:
                raise IndexError

    def __repr__(self):
        if len(self._set) > 30:
            m = self._set[:30]
        else:
            m = self._set
        s = map(lambda id: self._get_item_with_id(id), m)
        return "%s" % s

    def __iter__(self):
        for id in self._set:
            yield self._get_item_with_id(id)

    def __len__(self):
        return len(self._set)

    def __contains__(self, val):
        return val.id in self._set

    ##########################################
    # METHODS THAT RETURN A SET OF INSTANCES #
    ##########################################

    def get_by_id(self, id):
        if self.model_class.exists(id):
            return self._get_item_with_id(id)

    def first(self):
        try:
            return self.limit(1).__getitem__(0)
        except IndexError:
            return None


    #####################################
    # METHODS THAT MODIFY THE MODEL SET #
    #####################################

    def filter(self, **kwargs):
        clone = self._clone()
        if not clone._filters:
            clone._filters = {}
        clone._filters.update(kwargs)
        return clone

    def exclude(self, **kwargs):
        clone = self._clone()
        if not clone._exclusions:
            clone._exclusions = {}
        clone._exclusions.update(kwargs)
        return clone

    def zfilter(self, **kwargs):
        clone = self._clone()
        if not clone._zfilters:
            clone._zfilters = []
        clone._zfilters.append(kwargs)
        return clone

    # this should only be called once
    def order(self, field):
        fname = field.lstrip('-')
        if fname not in self.model_class._indices:
            raise ValueError("Order parameter should be an indexed attribute.")
        alpha = True
        if fname in self.model_class._attributes:
            v = self.model_class._attributes[fname]
            alpha = not isinstance(v, ZINDEXABLE)
        clone = self._clone()
        if not clone._ordering:
            clone._ordering = []
        clone._ordering.append((field, alpha,))
        return clone

    def limit(self, n, offset=0):
        clone = self._clone()
        clone._limit = n
        clone._offset = offset
        return clone

    def create(self, **kwargs):
        instance = self.model_class(**kwargs)
        if instance.save():
            return instance
        else:
            return None

    def all(self):
        return self._clone()

    def get_or_create(self, **kwargs):
        opts = {}
        for k, v in kwargs.iteritems():
            if k in self.model_class._indices:
                opts[k] = v
        o = self.filter(**opts).first()
        if o:
            return o
        else:
            return self.create(**kwargs)

    #

    @property
    def db(self):
        return self._db

    ###################
    # PRIVATE METHODS #
    ###################

    @property
    def _set(self):
        # For performance reasons, only one zfilter is allowed.
        if hasattr(self, '_cached_set'):
            return self._cached_set
        if self._zfilters:
            self._cached_set = self._add_zfilters()
            return self._cached_set
        s = Set(self.key)
        self._expire_or_delete = []
        if self._filters:
            s = self._add_set_filter(s)
        if self._exclusions:
            s = self._add_set_exclusions(s)
        n = self._order(s.key)
        self._cached_set = list(self._order(s.key))
        for key in filter(lambda key: key != self.key, self._expire_or_delete):
            del self.db[key]
        return self._cached_set

    def _add_set_filter(self, s):
        indices = []
        for k, v in self._filters.iteritems():
            index = self._build_key_from_filter_item(k, v)
            if k not in self.model_class._indices:
                raise AttributeNotIndexed(
                        "Attribute %s is not indexed in %s class." %
                        (k, self.model_class.__name__))
            indices.append(index)
        new_set_key = "~%s.%s" % ("+".join([self.key] + indices), id(self))
        s.intersection(new_set_key, *[Set(n) for n in indices])
        self._expire_or_delete.append(new_set_key)
        return Set(new_set_key)

    def _add_set_exclusions(self, s):
        indices = []
        for k, v in self._exclusions.iteritems():
            index = self._build_key_from_filter_item(k, v)
            if k not in self.model_class._indices:
                raise AttributeNotIndexed(
                        "Attribute %s is not indexed in %s class." %
                        (k, self.model_class.__name__))
            indices.append(index)
        new_set_key = "~%s.%s" % ("-".join([self.key] + indices), id(self))
        s.difference(new_set_key, *[Set(n) for n in indices])
        self._expire_or_delete.append(new_set_key)
        return Set(new_set_key)

    def _add_zfilters(self):
        k, v = self._zfilters[0].items()[0]
        try:
            att, op = k.split('__')
        except ValueError:
            raise ValueError("zfilter should have an operator.")
        index = self.model_class._key[att]
        desc = self.model_class._attributes[att]
        zset = SortedSet(index)
        limit, offset = self._get_limit_and_offset()
        if isinstance(v, (tuple, list,)):
            min, max = v
            min = float(desc.typecast_for_storage(min))
            max = float(desc.typecast_for_storage(max))
        else:
            v = float(desc.typecast_for_storage(v))
        if op == 'lt':
            return zset.lt(v, limit, offset)
        elif op == 'gt':
            return zset.gt(v, limit, offset)
        elif op == 'gte':
            return zset.ge(v, limit, offset)
        elif op == 'lte':
            return zset.le(v, limit, offset)
        elif op == 'in':
            return zset.between(min, max, limit, offset)

    def _order(self, skey):
        if self._ordering:
            return self._set_with_ordering(skey)
        else:
            return self._set_without_ordering(skey)

    def _set_with_ordering(self, skey):
        num, start = self._get_limit_and_offset()
        old_set_key = skey
        for ordering, alpha in self._ordering:
            if ordering.startswith('-'):
                desc = True
                ordering = ordering.lstrip('-')
            else:
                desc = False
            new_set_key = "%s#%s.%s" % (old_set_key, ordering, id(self))
            by = "%s->%s" % (self.model_class._key['*'], ordering)
            self.db.sort(old_set_key,
                         by=by,
                         store=new_set_key,
                         alpha=alpha,
                         start=start,
                         num=num,
                         desc=desc)
            self._expire_or_delete.append(old_set_key)
            self._expire_or_delete.append(new_set_key)
            return List(new_set_key)

    def _set_without_ordering(self, skey):
        # sort by id
        num, start = self._get_limit_and_offset()
        old_set_key = skey
        new_set_key = "%s#.%s" % (old_set_key, id(self))
        self.db.sort(old_set_key,
                     store=new_set_key,
                     start=start,
                     num=num)
        self._expire_or_delete.append(old_set_key)
        self._expire_or_delete.append(new_set_key)
        return List(new_set_key)

    def _get_limit_and_offset(self):
        if (self._limit is not None and self._offset is None) or \
                (self._limit is None and self._offset is not None):
                    raise "Limit and offset must be specified"

        if self._limit is None:
            return (None, None)
        else:
            return (self._limit, self._offset)

    def _get_item_with_id(self, id):
        instance = self.model_class()
        instance._id = str(id)
        return instance

    def _build_key_from_filter_item(self, index, value):
        desc = self.model_class._attributes.get(index)
        if desc:
            value = desc.typecast_for_storage(value)
        return self.model_class._key[index][_encode_key(value)]

    def _clone(self):
        klass = self.__class__
        c = klass(self.model_class)
        if self._filters:
            c._filters = self._filters
        if self._exclusions:
            c._exclusions = self._exclusions
        if self._zfilters:
            c._zfilters = self._zfilters
        if self._ordering:
            c._ordering = self._ordering
        c._limit = self._limit
        c._offset = self._offset
        return c

