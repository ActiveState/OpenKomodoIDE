import time
from datetime import datetime, date
import redisco
from redisco.containers import Set, List, SortedSet, NonPersistentList
from attributes import *
from key import Key
from managers import ManagerDescriptor, Manager
from utils import _encode_key
from exceptions import FieldValidationError, MissingID, BadKeyError

__all__ = ['Model', 'from_key']

ZINDEXABLE = (IntegerField, DateTimeField, DateField, FloatField)

##############################
# Model Class Initialization #
##############################

def _initialize_attributes(model_class, name, bases, attrs):
    """Initialize the attributes of the model."""
    model_class._attributes = {}
    for k, v in attrs.iteritems():
        if isinstance(v, Attribute):
            model_class._attributes[k] = v
            v.name = v.name or k

def _initialize_referenced(model_class, attribute):
    """Adds a property to the target of a reference field that
    returns the list of associated objects.
    """
    # this should be a descriptor
    def _related_objects(self):
        return (model_class.objects
                .filter(**{attribute.attname: self.id}))

    klass = attribute._target_type
    if isinstance(klass, basestring):
        return (klass, model_class, attribute)
    else:
        related_name = (attribute.related_name or
                model_class.__name__.lower() + '_set')
        setattr(klass, related_name,
                property(_related_objects))

def _initialize_lists(model_class, name, bases, attrs):
    """Stores the list fields descriptors of a model."""
    model_class._lists = {}
    for k, v in attrs.iteritems():
        if isinstance(v, ListField):
            model_class._lists[k] = v
            v.name = v.name or k

def _initialize_references(model_class, name, bases, attrs):
    """Stores the list of reference field descriptors of a model."""
    model_class._references = {}
    h = {}
    deferred = []
    for k, v in attrs.iteritems():
        if isinstance(v, ReferenceField):
            model_class._references[k] = v
            v.name = v.name or k
            att = Attribute(name=v.attname)
            h[v.attname] = att
            setattr(model_class, v.attname, att)
            refd = _initialize_referenced(model_class, v)
            if refd:
                deferred.append(refd)
    attrs.update(h)
    return deferred

def _initialize_indices(model_class, name, bases, attrs):
    """Stores the list of indexed attributes."""
    model_class._indices = []
    for k, v in attrs.iteritems():
        if isinstance(v, (Attribute, ListField)) and v.indexed:
            model_class._indices.append(k)
    if model_class._meta['indices']:
        model_class._indices.extend(model_class._meta['indices'])

def _initialize_counters(model_class, name, bases, attrs):
    """Stores the list of counter fields."""
    model_class._counters = []
    for k, v in attrs.iteritems():
        if isinstance(v, Counter):
            model_class._counters.append(k)

def _initialize_key(model_class, name):
    """Initializes the key of the model."""
    model_class._key = Key(model_class._meta['key'] or name)


def _initialize_manager(model_class):
    """Initializes the objects manager attribute of the model."""
    model_class.objects = ManagerDescriptor(Manager(model_class))


class ModelOptions(object):
    """Handles options defined in Meta class of the model.

    Example:

        class Person(models.Model):
            name = models.Attribute()

            class Meta:
                indices = ('full_name',)
                db = redis.Redis(host='localhost', port=29909)

    """
    def __init__(self, meta):
        self.meta = meta

    def get_field(self, field_name):
        if self.meta is None:
            return None
        try:
            return self.meta.__dict__[field_name]
        except KeyError:
            return None
    __getitem__ = get_field


_deferred_refs = []

class ModelBase(type):
    """Metaclass of the Model."""

    def __init__(cls, name, bases, attrs):
        super(ModelBase, cls).__init__(name, bases, attrs)
        global _deferred_refs
        cls._meta = ModelOptions(attrs.pop('Meta', None))
        deferred = _initialize_references(cls, name, bases, attrs)
        _deferred_refs.extend(deferred)
        _initialize_attributes(cls, name, bases, attrs)
        _initialize_counters(cls, name, bases, attrs)
        _initialize_lists(cls, name, bases, attrs)
        _initialize_indices(cls, name, bases, attrs)
        _initialize_key(cls, name)
        _initialize_manager(cls)
        # if targeted by a reference field using a string,
        # override for next try
        for target, model_class, att in _deferred_refs:
            if name == target:
                att._target_type = cls
                _initialize_referenced(model_class, att)


class Model(object):
    __metaclass__ = ModelBase

    def __init__(self, **kwargs):
        self.update_attributes(**kwargs)

    def is_valid(self):
        """Returns True if all the fields are valid.

        It first validates the fields (required, unique, etc.)
        and then calls the validate method.
        """
        self._errors = []
        for field in self.fields:
            try:
                field.validate(self)
            except FieldValidationError, e:
                self._errors.extend(e.errors)
        self.validate()
        return not bool(self._errors)

    def validate(self):
        """Overriden in the model class.

        Do custom validation here. Add tuples to self._errors.

        Example:

            class Person(Model):
                name = Attribute(required=True)

                def validate(self):
                    if name == 'Nemo':
                        self._errors.append(('name', 'cannot be Nemo'))

        """
        pass

    def update_attributes(self, **kwargs):
        """Updates the attributes of the model."""
        attrs = self.attributes.values() + self.lists.values() \
                + self.references.values()
        for att in attrs:
            if att.name in kwargs:
                att.__set__(self, kwargs[att.name])

    def save(self):
        """Saves the instance to the datastore."""
        if not self.is_valid():
            return self._errors
        _new = self.is_new()
        if _new:
            self._initialize_id()
        with Mutex(self):
            self._write(_new)
        return True

    def key(self, att=None):
        """Returns the Redis key where the values are stored."""
        if att is not None:
            return self._key[self.id][att]
        else:
            return self._key[self.id]

    def delete(self):
        """Deletes the object from the datastore."""
        pipeline = self.db.pipeline()
        self._delete_from_indices(pipeline)
        self._delete_membership(pipeline)
        pipeline.delete(self.key())
        pipeline.execute()

    def is_new(self):
        """Returns True if the instance is new.

        Newness is based on the presence of the _id attribute.
        """
        return not hasattr(self, '_id')

    def incr(self, att, val=1):
        """Increments a counter."""
        if att not in self.counters:
            raise ValueError("%s is not a counter.")
        self.db.hincrby(self.key(), att, val)

    def decr(self, att, val=1):
        """Decrements a counter."""
        self.incr(att, -1 * val)


    @property
    def attributes_dict(self):
        """Returns the mapping of the model attributes and their
        values.
        """
        h = {}
        for k in self.attributes.keys():
            h[k] = getattr(self, k)
        for k in self.lists.keys():
            h[k] = getattr(self, k)
        for k in self.references.keys():
            h[k] = getattr(self, k)
        return h


    @property
    def id(self):
        """Returns the id of the instance.

        Raises MissingID if the instance is new.
        """
        if not hasattr(self, '_id'):
            raise MissingID
        return self._id

    @id.setter
    def id(self, val):
        """Returns the id of the instance as a string."""
        self._id = str(val)

    @property
    def attributes(cls):
        """Return the attributes of the model.

        Returns a dict with models attribute name as keys
        and attribute descriptors as values.
        """
        return dict(cls._attributes)

    @property
    def lists(cls):
        """Returns the lists of the model.

        Returns a dict with models attribute name as keys
        and ListField descriptors as values.
        """
        return dict(cls._lists)

    @property
    def indices(cls):
        """Return a list of the indices of the model."""
        return cls._indices

    @property
    def references(cls):
        """Returns the mapping of reference fields of the model."""
        return cls._references

    @property
    def db(cls):
        """Returns the Redis client used by the model."""
        return redisco.get_client()

    @property
    def errors(self):
        """Returns the list of errors after validation."""
        if not hasattr(self, '_errors'):
            self.is_valid()
        return self._errors

    @property
    def fields(self):
        """Returns the list of field names of the model."""
        return (self.attributes.values() + self.lists.values()
                + self.references.values())

    @property
    def counters(cls):
        """Returns the mapping of the counters."""
        return cls._counters

    #################
    # Class Methods #
    #################

    @classmethod
    def exists(cls, id):
        """Checks if the model with id exists."""
        return bool(redisco.get_client().exists(cls._key[str(id)]) or
                    redisco.get_client().sismember(cls._key['all'], str(id)))

    ###################
    # Private methods #
    ###################

    def _initialize_id(self):
        """Initializes the id of the instance."""
        self.id = str(self.db.incr(self._key['id']))

    def _write(self, _new=False):
        """Writes the values of the attributes to the datastore.

        This method also creates the indices and saves the lists
        associated to the object.
        """
        pipeline = self.db.pipeline()
        self._create_membership(pipeline)
        self._update_indices(pipeline)
        h = {}
        # attributes
        for k, v in self.attributes.iteritems():
            if isinstance(v, DateTimeField):
                if v.auto_now:
                    setattr(self, k, datetime.now())
                if v.auto_now_add and _new:
                    setattr(self, k, datetime.now())
            elif isinstance(v, DateField):
                if v.auto_now:
                    setattr(self, k, date.today())
                if v.auto_now_add and _new:
                    setattr(self, k, date.today())
            for_storage = getattr(self, k)
            if for_storage is not None:
                h[k] = v.typecast_for_storage(for_storage)
        # indices
        for index in self.indices:
            if index not in self.lists and index not in self.attributes:
                v = getattr(self, index)
                if callable(v):
                    v = v()
                if v:
                    try:
                        h[index] = unicode(v)
                    except UnicodeError:
                        h[index] = unicode(v.decode('utf-8'))
        pipeline.delete(self.key())
        if h:
            pipeline.hmset(self.key(), h)

        # lists
        for k, v in self.lists.iteritems():
            l = List(self.key()[k], pipeline=pipeline)
            l.clear()
            values = getattr(self, k)
            if values:
                if v._redisco_model:
                    l.extend([item.id for item in values])
                else:
                    l.extend(values)
        pipeline.execute()

    ##############
    # Membership #
    ##############

    def _create_membership(self, pipeline=None):
        """Adds the id of the object to the set of all objects of the same
        class.
        """
        Set(self._key['all'], pipeline=pipeline).add(self.id)

    def _delete_membership(self, pipeline=None):
        """Removes the id of the object to the set of all objects of the
        same class.
        """
        Set(self._key['all'], pipeline=pipeline).remove(self.id)


    ############
    # INDICES! #
    ############

    def _update_indices(self, pipeline=None):
        """Updates the indices of the object."""
        self._delete_from_indices(pipeline)
        self._add_to_indices(pipeline)

    def _add_to_indices(self, pipeline):
        """Adds the base64 encoded values of the indices."""
        for att in self.indices:
            self._add_to_index(att, pipeline=pipeline)

    def _add_to_index(self, att, val=None, pipeline=None):
        """
        Adds the id to the index.

        This also adds to the _indices set of the object.
        """
        index = self._index_key_for(att)
        if index is None:
            return
        t, index = index
        if t == 'attribute':
            pipeline.sadd(index, self.id)
            pipeline.sadd(self.key()['_indices'], index)
        elif t == 'list':
            for i in index:
                pipeline.sadd(i, self.id)
                pipeline.sadd(self.key()['_indices'], i)
        elif t == 'sortedset':
            zindex, index = index
            pipeline.sadd(index, self.id)
            pipeline.sadd(self.key()['_indices'], index)
            descriptor = self.attributes[att]
            score = descriptor.typecast_for_storage(getattr(self, att))
            pipeline.zadd(zindex, self.id, score)
            pipeline.sadd(self.key()['_zindices'], zindex)


    def _delete_from_indices(self, pipeline):
        """Deletes the object's id from the sets(indices) it has been added
        to and removes its list of indices (used for housekeeping).
        """
        s = Set(self.key()['_indices'])
        z = Set(self.key()['_zindices'])
        for index in s.members:
            pipeline.srem(index, self.id)
        for index in z.members:
            pipeline.zrem(index, self.id)
        pipeline.delete(s.key)
        pipeline.delete(z.key)

    def _index_key_for(self, att, value=None):
        """Returns a key based on the attribute and its value.

        The key is used for indexing.
        """
        if value is None:
            value = getattr(self, att)
            if callable(value):
                value = value()
        if value is None:
            return None
        if att not in self.lists:
            return self._get_index_key_for_non_list_attr(att, value)
        else:
            return self._tuple_for_index_key_attr_list(att, value)

    def _get_index_key_for_non_list_attr(self, att, value):
        descriptor = self.attributes.get(att)
        if descriptor and isinstance(descriptor, ZINDEXABLE):
            sval = descriptor.typecast_for_storage(value)
            return self._tuple_for_index_key_attr_zset(att, value, sval)
        elif descriptor:
            val = descriptor.typecast_for_storage(value)
            return self._tuple_for_index_key_attr_val(att, val)
        else:
            # this is non-attribute index defined in Meta
            return self._tuple_for_index_key_attr_val(att, value)

    def _tuple_for_index_key_attr_val(self, att, val):
        return ('attribute', self._index_key_for_attr_val(att, val))

    def _tuple_for_index_key_attr_list(self, att, val):
        return ('list', [self._index_key_for_attr_val(att, e) for e in val])

    def _tuple_for_index_key_attr_zset(self, att, val, sval):
        return ('sortedset',
                (self._key[att], self._index_key_for_attr_val(att, sval)))

    def _index_key_for_attr_val(self, att, val):
        return self._key[att][_encode_key(val)]

    ##################
    # Python methods #
    ##################

    def __hash__(self):
        return hash(self.key())

    def __eq__(self, other):
        return isinstance(other, self.__class__) and self.key() == other.key()

    def __ne__(self, other):
        return not self.__eq__(other)

    def __repr__(self):
        if not self.is_new():
            return "<%s %s>" % (self.key(), self.attributes_dict)
        return "<%s %s>" % (self.__class__.__name__, self.attributes_dict)



def get_model_from_key(key):
    """Gets the model from a given key."""
    _known_models = {}
    model_name = key.split(':', 2)[0]
    # populate
    for klass in Model.__subclasses__():
        _known_models[klass.__name__] = klass
    return _known_models.get(model_name, None)


def from_key(key):
    """Returns the model instance based on the key.

    Raises BadKeyError if the key is not recognized by
    redisco or no defined model can be found.
    Returns None if the key could not be found.
    """
    model = get_model_from_key(key)
    if model is None:
        raise BadKeyError
    try:
        _, id = key.split(':', 2)
        id = int(id)
    except ValueError, TypeError:
        raise BadKeyError
    return model.objects.get_by_id(id)


class Mutex(object):
    """Implements locking so that other instances may not modify it.

    Code ported from Ohm.
    """
    def __init__(self, instance):
        self.instance = instance

    def __enter__(self):
        self.lock()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.unlock()

    def lock(self):
        o = self.instance
        while not o.db.setnx(o.key('_lock'), self.lock_timeout):
            lock = o.db.get(o.key('_lock'))
            if not lock:
                continue
            if not self.lock_has_expired(lock):
                time.sleep(0.5)
                continue
            lock = o.db.getset(o.key('_lock'), self.lock_timeout)
            if not lock:
                break
            if self.lock_has_expired(lock):
                break

    def lock_has_expired(self, lock):
        return float(lock) < time.time()

    def unlock(self):
        self.instance.db.delete(self.instance.key('_lock'))

    @property
    def lock_timeout(self):
        return "%f" % (time.time() + 1.0)
