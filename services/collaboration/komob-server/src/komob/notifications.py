"""This provides an interface to the Redis pub/sub mechanism for model classes
and mobwrite. It is used to implement the socket/push communication in Komodo
Collaboration."""

import redisco

redis = redisco.get_client() # Reuse the model db connection for pubsub.
_channel_base = "komob-push"

def send_notifications(get_before=False):
    """Decorate func on a model instance to send a notification to redis
    subscribers when func returns. The model instance must implement the
    BaseModel.get_notifications to return a list of notification tuples.
    
    Arguments:
        get_before - Set to True if get_notifications should be called before
            the decorated function func, e.g. if func is a delete() call."""
    
    def send_notifications_decorator(func):
        def wrapper_func(model_instance, *args, **kwargs):
            if not hasattr(model_instance, 'get_notifications'):
                raise ValueError('model_instance must implement get_notifications')
            notifications = None
            if get_before:
                notifications = model_instance.get_notifications()
                v = func(model_instance, *args, **kwargs)
            else:
                v = func(model_instance, *args, **kwargs)
                notifications = model_instance.get_notifications()
            for type, recipient, message in notifications:
                notify(type, recipient, message)
            return v
        return wrapper_func
    return send_notifications_decorator

def notify(type, recipient, message):
    # Beware of colons when using this
    channel = '%s:%s:%s' % (_channel_base, type, recipient)
    redis.publish(channel, message)

# This one is triggered by mobwrite logic, not a direct model modification
# FIXME why is this not in mobwrite?
def on_mobwrite_update(view):
    for other_view in view.text.viewobj_set:
        if other_view.id != view.id:
            notify('mobwrite', other_view.sso_user.account_id, other_view.username)