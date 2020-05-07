from functools import wraps
from flask import abort, current_app as app, request
from cleanup import cleanup_views

def filter_internal_ips():
    remote_ip = request.environ.get('REMOTE_ADDR')
    for internal_ip in app.config['INTERNAL_IPS']:
        if remote_ip.startswith(internal_ip):
            return
    abort(403)
