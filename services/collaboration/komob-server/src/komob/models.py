import datetime
import logging
import json
import re
import thread
import time
import urllib
from uuid import uuid4

from flask import abort, current_app, g
from komob.db import account_api
from redisco import models

from komob import notifications


MAX_CHARS = 1000000
TIMEOUT_VIEW = datetime.timedelta(minutes=5)
TIMEOUT_TEXT = datetime.timedelta(hours=1)

class BaseModel(models.Model):
    """Wrapper around redisco's model base class."""

    def _write(self, new=False):
        # Hook into `_write()` to incr a redis counter whenever a *new* model
        # instance is saved. Useful for keeping our stats.
        val = super(BaseModel, self)._write(new)
        if new:
            self._incr_daily_model_counter()
        return val

    @classmethod
    def _model_counter_key(self, date):
        if not isinstance(date, datetime.date):
            raise TypeError("date must be a `datetime.date` instance")
        return '_komob_model_counter_%s_%s' % (self.__name__,
            datetime.date.strftime(date, '%Y%m%d'))

    def _incr_daily_model_counter(self):
        """Increments the redis counter for daily created instances for this
        model class. Automatically called whenever """
        key_name = self.__class__._model_counter_key(datetime.date.today())
        try:
            self.db.incr(key_name)
        except e:
            current_app.logger.error(e)
            current_app.logger.warn("Unable to increment model counter %s. "
                                    "Trying to reset that counter.")
            self.db.delete(key_name)

    def _destroy_associated(self):
        # To be implemented by the subclasses.
        pass

    def destroy(self):
        """Deletes all dependent model objects before deleting this object."""

        self._destroy_associated()
        self.delete()

    def get_notifications(self):
        """Must be implemented by subclasses that use the
        notifications.send_notifications() decorator. Returns a list of type,
        recipient, message tuples to be passed to notifications.notify()."""

        raise NotImplementedError


class Privilege(BaseModel):
    """An access control entry for a session."""

    # A warning: The `READ` privilege is not really in use atm. I.e., the client
    # automatically assumes `WRITE` access if it is not `OWNER` (or `NONE`). If
    # we ever introduce less privileged users than `WRITE`, we have to add a 
    # few extra checks to the client.
    NONE  = 0
    READ  = 1
    WRITE = 2
    OWNER = 3
    _all_privileges = [READ, WRITE, OWNER]

    session = models.ReferenceField('Session', required=True)
    user = models.ReferenceField('User', required=True)
    level = models.IntegerField(required=True, indexed=False)

    def validate(self):
        if self.level not in self._all_privileges:
            self._errors.append(('privilege', 'invalid value'))

    def change_level(self, level):
        if level in [self.NONE, None]:
            self.delete()
        elif level in self._all_privileges:
            self.update_attributes(level=level)
            self.save()
        else:
            return False
        return True


class User(BaseModel):
    """Model class for an ActiveState SSO user. Instances get created during
    authentication or can be fetched from the Account API on demand."""

    # The account.as.com `User` model instance `id` attribute.
    account_id = models.IntegerField(required=True, unique=True)

    @classmethod
    def fetch_from_api(cls, account_id):
        """Fetches account data for the given user id from the AS.com Account
        API. If the user id exists and there is no User model with the same
        user id already in the database, a new User is created."""

        account = None
        try:
            account = account_api.account_from_user_id(account_id)
        except account_api.NotFoundError:
            return None
        if account:
            user = User.objects.get_or_create(account_id=account.user_id)
            return user
        else:
            return None

    def _fetch_fullname_from_api(self):
        account = account_api.account_from_user_id(self.account_id)
        if not account:
            self.destroy()
            return "Deleted user"
        fullname = (getattr(account, 'fullname', None) or
                    getattr(account, 'email', '(Unknown User)'))
        return fullname


    @property
    def fullname(self):
        if not getattr(self, '_fullname', None):
            self._fullname = self._fetch_fullname_from_api()
        return self._fullname

    @property
    def id_name_tuple(self):
        return (self.account_id, self.fullname)

    @property
    def sessions(self):
        """Returns a list of all Sessions that this user can access"""

        return [privilege.session for privilege in self.privilege_set]

    def sessions_dict(self):
        sessions = [(s.id, s.to_dict()) for s in self.sessions]
        return dict(sessions)

    @property
    def session_ids(self):
        return [privilege.session_id for privilege in self.privilege_set]

    def create_session(self, session_name=None):
        """Creates a new Session and grants this user an owner Privilege"""

        session = Session.objects.create(name=session_name)
        if session is None:
            abort(500, 'Failed to create session')
        session.update_privileges({self: Privilege.OWNER})
        return session

    def get_session_or_abort(self, session_id, required_access=Privilege.READ):
        """Returns the Session with the given id. If such a session does not
        exist or if this user does not have the required access right, the
        current request is aborted with an HTTP 400 code."""

        privilege = self.privilege_set.filter(session_id=session_id).first()
        if privilege is None or privilege.level < required_access:
            abort(404)
        if privilege.session is None:
            current_app.logger.error("No session for privilege with id" %
                                     privilege.id)
            abort(500)
        return privilege.session

    def get_text_or_abort(self, text_id, required_access=Privilege.READ):
        """Returns the TextObj with the given id. If such a TextObj does not
        exist or if this user does not have the required access right, the
        current request is aborted with an HTTP 400 code."""

        text = TextObj.objects.get_by_id(text_id)
        if text is None or \
           text.privilege_level_for_user(self) < required_access:
            abort(404, 'unknown text')
        return text

    def find_relation_with(self, other_user):
        """Returns the UserRelation between both users if one exists,
        None otherwise."""

        if not isinstance(other_user, User):
            raise ValueError
        relation = UserRelation.objects.filter(left_user_id=self.id,
                                               right_user_id=other_user.id)\
                                       .first()
        if relation is None:
            relation = UserRelation.objects.filter(left_user_id=other_user.id,
                                                   right_user_id=self.id)\
                                           .first()
        return relation

    def is_friends_with(self, other_user):
        """Returns True, iff other_user is this User or a UserRelation exists
        between both users and this relation has been confirmed."""

        if self == other_user:
            return True
        relation = self.find_relation_with(other_user)
        if relation is None:
            return False
        return relation.confirmed

    def _all_relations(self):
        relations = []
        relations.extend(UserRelation.objects.filter(left_user_id=self.id))
        relations.extend(UserRelation.objects.filter(right_user_id=self.id))
        return relations

    def friends_dict(self):
        # TODO This could really take a while, since we do a GET for each user...
        lrelations = UserRelation.objects.filter(left_user_id=self.id)
        rrelations = UserRelation.objects.filter(right_user_id=self.id)
        friends = []
        for rel in lrelations:
            if rel.confirmed: friends.append(rel.right_user.id_name_tuple)
        for rel in rrelations:
            if rel.confirmed: friends.append(rel.left_user.id_name_tuple)
        return dict(friends)

    def friend_requests_dict(self):
        """Returns a dict of this user's UserRelations which are unconfirmed
        and have been initiated by other users."""

        requests = [rel.left_user.id_name_tuple for rel in
                    UserRelation.objects.filter(right_user_id=self.id)
                    if not rel.confirmed]
        return dict(requests)

    def pending_requests_dict(self):
        """Returns a dict of unconfirmed UserRelations that have been initiated
        by this user (i.e. pending requests)."""

        requests = [rel.right_user.id_name_tuple for rel in
                    UserRelation.objects.filter(left_user_id=self.id)
                    if not rel.confirmed]
        return dict(requests)

    def delete_friend(self, account_id):
        """Deletes the UserRelation object between this user and the user with
        the given account id and returns True. Returns False if no relation
        exists."""

        other_user = User.objects.filter(account_id=account_id).first()
        if other_user is None:
            return False
        relation = self.find_relation_with(other_user)
        if relation is None:
            return False
        relation.destroy()
        return True

    def add_friend_request(self, email):
        """Creates an unconfirmed UserRelation object if none exists between
        this user and the user with the given account id. Returns True if the
        relation has been created or existed previously. Returns False if there
        is no user with the supplied account id."""

        other_user = User.fetch_from_api(email)
        if other_user is None or other_user.id == self.id:
            return False
        relation = self.find_relation_with(other_user)
        if relation is not None:
            # There is already a UserRelation. Not really an error, but don't
            # create a second one.
            return True
        UserRelation.objects.create(left_user=self, right_user=other_user,
                                    confirmed=False)
        return True

    def update_friend_request(self, account_id, confirmed):
        """Confirms or deletes the UserRelation object between this user and the
        user with the given account id."""

        other_user = User.objects.filter(account_id=account_id).first()
        if other_user is None:
            return False
        relation = self.find_relation_with(other_user)
        if relation is None:
            return False
        # Don't allow the initiating user to confirm the request:
        if not relation.right_user_id == self.id:
            False
        if confirmed:
            relation.confirmed = True
            relation.save()
        else:
            relation.destroy()
        return True

    def to_dict(self):
        dct = {}
        dct['id'] = self.id
        dct['account_id'] = self.account_id
        dct['fullname'] = self.fullname
        dct['relations'] = [r.to_dict() for r in self._all_relations()]
        return dct

    def _destroy_associated(self):
        for relation in self._all_relations():
            relation.destroy()


class UserRelation(BaseModel):
    """A relationship between two users that indicates that both users may
    add each other to a Session. While this is a symmetric relationship, by
    convention left_user is the one that initiated the connection. Thus, if the
    connection is not confirmed, right_user has to provide confirmation."""

    left_user = models.ReferenceField(User, required=True)
    right_user = models.ReferenceField(User, required=True)
    confirmed = models.BooleanField(required=True, default=False,
                                    indexed=False)

    def validate(self):
        if self.left_user_id == self.right_user_id:
            self._errors.append(('right_user_id', 'same as left_user_id'))

    def to_dict(self):
        dct = {}
        dct['left_user'] = self.left_user.id_name_tuple
        dct['right_user'] = self.right_user.id_name_tuple
        dct['confirmed'] = self.confirmed
        return dct

    @property
    def account_ids(self):
        return [self.left_user.account_id, self.right_user.account_id]

    @notifications.send_notifications(get_before=True)
    def destroy(self):
        return super(UserRelation, self).destroy()

    @notifications.send_notifications()
    def save(self):
        return super(UserRelation, self).save()

    def get_notifications(self):
        notifications = []
        for account_id in self.account_ids:
            notifications.append(('friends', account_id, None))
        return notifications


class Session(BaseModel):
    """A session is a collection of TextObj instances that can be shared with
    other users."""

    name = models.CharField(max_length=255, default="Unnamed session",
                            indexed=False)

    def privileges_dict(self):
        """Returns a account_id to fullname, privilege_level mapping  for each
        user with access to this session."""

        privilege_list = [(p.user.account_id, (p.user.fullname, p.level))
                          for p in self.privilege_set]
        return dict(privilege_list)

    @notifications.send_notifications()
    def update_privileges(self, privileges):
        """Updates Privileges for this session. The privileges parameter must
        be a dict mapping account_ids or user instances to privilege levels."""

        if not isinstance(privileges, dict):
            raise TypeError()
        for user, level in privileges.iteritems():
            if not isinstance(user, User):
                user = User.objects.filter(account_id=user).first()
            if user is None:
                continue
            privilege = Privilege.objects.filter(user_id=user.id,
                                                 session_id=self.id).first()
            if privilege is not None:
                privilege.change_level(level)
            else:
                if g.sso_user.is_friends_with(user):
                    Privilege.objects.create(user=user, session=self,
                                             level=level)
                else:
                    current_app.logger.warn("User %s failed to grant %s "
                        "access to session %s - no UserRelation." %
                        (g.sso_user.account_id, user.account_id, self.id))

    def privilege_level_for_user(self, user):
        privilege = self.privilege_set.filter(user_id=user.id).first()
        if privilege is None:
            return Privilege.NONE
        return privilege.level

    def update_name(self, name):
        self.name = name
        self.save()

    @property
    def text_ids(self):
        return [t.id for t in self.textobj_set]

    def texts_dict(self):
        texts = [(t.id, t.title) for t in self.textobj_set]
        return dict(texts)

    @notifications.send_notifications()
    def create_text(self, title=None, language=None):
        return TextObj.objects.create(title=title, language=language,
                                      session=self)

    def get_text_or_abort(self, text_id):
        """Returns the text with the given id if it exists in this session.
        Aborts the current request otherwise."""

        text = self.textobj_set.get_by_id(text_id)
        if text is None:
            abort(404, "Text does not exist")
        return text

    def _destroy_associated(self):
        for t in self.textobj_set: t.destroy()
        for p in self.privilege_set: p.delete()

    def to_dict(self):
        dct = {}
        dct["id"] = self.id
        dct["name"] = self.name
        dct["privileges"] = self.privileges_dict()
        dct["texts"] = self.texts_dict()
        return dct

    @notifications.send_notifications()
    def save(self):
        return super(Session, self).save()

    @notifications.send_notifications(get_before=True)
    def destroy(self):
        return super(Session, self).destroy()

    def get_notifications(self):
        notifications = []
        for privilege in self.privilege_set:
            notifications.append(('sessions', privilege.user.account_id, self.id))
        return notifications


class TextObj(BaseModel):
    """A TextObj is the server copy of a shared file. The interface is mostly
    copied from mobwrite. In the context of komob it always belongs to a
    Session"""

    session = models.ReferenceField(Session, required=True)
    _text = models.CharField(max_length=MAX_CHARS, indexed=False)
    title = models.CharField(max_length=255, indexed=False)
    language = models.CharField(max_length=255, indexed=False)
    timestamp = models.DateTimeField(auto_now=True, indexed=False)

    # True if mobwrite explicitly locked this TextObj. Redisco implicitly locks
    # the object when Model.save is called.
    _locked = False

    def _initialize_id(self):
        self.id = str(uuid4()).replace('-', '')

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, newtext):
        # Scrub the text before setting it.
        if newtext != None:
            # Normalize linebreaks to LF.
            newtext = re.sub(r"(\r\n|\r|\n)", "\n", newtext)
            # Keep the text within the length limit.
            if MAX_CHARS != 0 and len(newtext) > MAX_CHARS:
                newtext = newtext[-MAX_CHARS:]
                current_app.logger.warn("Truncated text to %d characters." % MAX_CHARS)
        if self._text != newtext:
            self._text = newtext

    @property
    def privileges(self):
        return self.session.privilege_set.all()

    def privilege_level_for_user(self, user):
        return self.session.privilege_level_for_user(user)

    @notifications.send_notifications(get_before=True)
    def update_title(self, title):
        self.title = title
        self.save()

    def lock(self):
        return Mutex(self)

    # Don't add a notification to save. Otherwise each mobwrite packet will
    # trigger a "sessions" notification for all pariticipants.
    def save(self):
        """Checks if this instance already holds a lock on the model entity.
        If this is the case, just go ahead and save without waiting for a lock."""
        if self._locked:
            if not self.is_valid():
                return self._errors
            _new = self.is_new()
            if _new:
                self._initialize_id()
            self._write(_new)
            return True
        else:
            # Call superclass save which acquires a Mutex for this instance.
            return super(TextObj, self).save()

    def to_dict(self):
        dct = {}
        dct['filename'] = self.id
        dct['title'] = self.title
        dct['language'] = self.language
        return dct

    @notifications.send_notifications(get_before=True)
    def destroy(self):
        return super(TextObj, self).destroy()

    def _destroy_associated(self):
        for v in self.viewobj_set: v.destroy()

    def get_notifications(self):
        return self.session.get_notifications()




class ViewObj(BaseModel):
    # An object which contains one user's view of one text.

    # Object properties:
    # .username - The name for the user, e.g 'fraser'-- ***NOTE: This is _NOT_
    # the ActiveState SSO username from the User model but just a string
    # identifier for the mobwrite client instance.
    # .filename - The name for the file, e.g 'proposal'
    # .shadow - The last version of the text sent to client.
    # .backup_shadow - The previous version of the text sent to client.
    # .shadow_client_version - The client's version for the shadow (n).
    # .shadow_server_version - The server's version for the shadow (m).
    # .backup_shadow_server_version - the server's version for the backup
    #     shadow (m).
    # .edit_stack - List of unacknowledged edits sent to the client.
    # .changed - Has the view changed since the last time it was saved.
    # .delta_ok - Did the previous delta match the text length.

    username = models.Attribute(required=True)
    sso_user = models.ReferenceField(User, required=True)
    text = models.ReferenceField(TextObj, required=True)
    shadow_client_version = models.IntegerField(required=True, default=0,
                                                indexed=False)
    shadow_server_version = models.IntegerField(required=True, default=0,
                                                indexed=False)
    backup_shadow_server_version = models.IntegerField(required=True, default=0,
                                                       indexed=False)
    shadow = models.CharField(max_length=MAX_CHARS, indexed=False)
    backup_shadow = models.CharField(max_length=MAX_CHARS, indexed=False)
    edit_stack_json = models.Attribute(indexed=False)
    metadata_json = models.Attribute(indexed=False)
    timestamp = models.DateTimeField(auto_now=True)

    _edit_stack = None
    _metadata = None
    delta_ok = True

    def nullify(self):
        self.shadow = None

    @property
    def edit_stack(self):
        if self._edit_stack is None:
            if self.edit_stack_json is not None:
                self._edit_stack = json.loads(self.edit_stack_json)
            else:
                self._edit_stack = []
        return self._edit_stack

    @edit_stack.setter
    def edit_stack(self, value):
        if isinstance(value, list):
            self.edit_stack_json = json.dumps(value)
            self._edit_stack = None
            return value

    @property
    def metadata(self):
        if self._metadata is None:
            if self.metadata_json is not None:
                self._metadata = json.loads(self.metadata_json)
            else:
                self._metadata = {}
        return self._metadata

    @metadata.setter
    def metadata(self, value):
        if isinstance(value, dict):
            value['user_id'] = self.sso_user.account_id
            self.metadata_json = json.dumps(value)
            self._metadata = None
            return value

    def save(self):
        # Pickle unpickled attributes before saving
        self.edit_stack = self._edit_stack
        self.metadata = self._metadata
        return super(ViewObj, self).save()

    def can_read(self):
        privilege_level = self.text.privilege_level_for_user(self.sso_user)
        return  privilege_level >= Privilege.READ

    def can_write(self):
        privilege_level = self.text.privilege_level_for_user(self.sso_user)
        return  privilege_level >= Privilege.WRITE


class Mutex(models.base.Mutex):
    """A subclass of redisco's (private) Mutex implementation that allows us to
    lock access to a model entity for a fixed interval of time."""

    def __init__(self, *args, **kwargs):
        timeout = kwargs.pop('timeout', 10.0)
        if timeout:
            self._timeout = float(timeout)
        super(Mutex, self).__init__(*args, **kwargs)

    def __enter__(self):
        models.base.Mutex.__enter__(self)
        self.instance._locked = True
        return self

    def __exit__(self, *args, **kwargs):
        self.instance._locked = False
        models.base.Mutex.__exit__(self, *args, **kwargs)

    @property
    def lock_timeout(self):
        # The locking timeout is 10 seconds.
        # TODO Test if this is enough :)
        # TODO Implement a lock expiration check?
        return "%f" % (time.time() + self._timeout)
