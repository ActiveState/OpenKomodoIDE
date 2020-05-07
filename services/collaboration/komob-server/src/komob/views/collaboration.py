import json

from flask import Module, request, jsonify, make_response

from komob import auth
import mobwrite.core

module = Module(__name__)

@module.route('/', methods=['GET', 'POST'], strict_slashes=False)
@auth.auth_required
def get():
    data = request.form.get('q', '')
    actions = mobwrite.core.parseRequest(data)
    message = '' + mobwrite.core.doActions(actions) + '\n'
    return make_response(message, 200)