import json
from flask import abort, current_app, jsonify, make_response, Module, request
from komob import auth, models


module = Module(__name__)


#--- sessions resource

@module.route('/sessions', methods=['GET'])
@auth.auth_required
def get_sessions():
    sessions = auth.current_user().sessions_dict()
    return jsonify(sessions)

@module.route('/sessions', methods=['POST'])
@auth.auth_required
def post_sessions():
    post_data = get_json_request_data()
    session_name = post_data.get('session_name', 'Unnamed session')
    session = auth.current_user().create_session(session_name=session_name)
    return jsonify(session.to_dict())


#--- session resource

@module.route('/sessions/<int:session_id>', methods=['GET'])
@auth.auth_required
def get_session(session_id):
    session = auth.current_user().get_session_or_abort(session_id)
    return jsonify(session.to_dict())

@module.route('/sessions/<int:session_id>', methods=['PUT'])
@auth.auth_required
def put_session(session_id):
    session = auth.current_user().get_session_or_abort(session_id,
                                    required_access=models.Privilege.OWNER)
    put_data = get_json_request_data()
    if 'privileges' in put_data:
        session.update_privileges(put_data['privileges'])
    if 'name' in put_data:
        session.update_name(put_data['name'])
    return jsonify(session.to_dict())

@module.route('/sessions/<int:session_id>', methods=['DELETE'])
@auth.auth_required
def delete_session(session_id):
    session = auth.current_user().get_session_or_abort(session_id,
                                        required_access=models.Privilege.OWNER)
    session.destroy()
    return make_response(None, 200)

@module.route('/sessions/<int:session_id>/privilege', methods=['DELETE'])
@auth.auth_required
def delete_own_session_privilege(session_id):
    """Delete the current user's privilege for a given session ("leaving" a
    session). Aborts with 403 if they are the OWNER of the session."""

    user = auth.current_user()
    session = user.get_session_or_abort(session_id)
    privilege = session.privilege_set.filter(user_id=user.id).first()
    if not privilege:
        # You shouldn't really get here.
        return make_response(None, 404)
    # Raise 403 if the OWNER tries to leave their own session.
    if privilege.level == models.Privilege.OWNER:
        current_app.logger.warn("""Can't remove privilege %s, has OWNER
                                level.""" % privilege.id)
        return make_response(None, 403)
    # Destroy the Privilege in a way that triggers push notifications.
    session.update_privileges({user: models.Privilege.NONE})
    return make_response(None, 200)


#--- texts resource

@module.route('/sessions/<int:session_id>/texts', methods=['POST'])
@auth.auth_required
def post_texts(session_id):
    session = auth.current_user().get_session_or_abort(session_id,
                                        required_access=models.Privilege.WRITE)
    post_data = get_json_request_data()
    title = post_data.get('title')
    language = post_data.get('language')
    text = session.create_text(title=title, language=language)
    return jsonify(text.to_dict())


#--- text resource

@module.route('/texts/<text_id>', methods=['GET'])
@auth.auth_required
def get_text(text_id):
    text = auth.current_user().get_text_or_abort(text_id,
                                        required_access=models.Privilege.READ)
    return jsonify(text.to_dict())

@module.route('/texts/<text_id>', methods=['PUT'])
@auth.auth_required
def put_text(text_id):
    text = auth.current_user().get_text_or_abort(text_id,
                                        required_access=models.Privilege.WRITE)
    put_data = get_json_request_data()
    if 'title' in put_data:
        text.update_title(put_data['title'])
    return jsonify(text.to_dict())

@module.route('/texts/<text_id>', methods=['DELETE'])
@auth.auth_required
def delete_text(text_id):
    text = auth.current_user().get_text_or_abort(text_id,
                                        required_access=models.Privilege.WRITE)
    text.destroy()
    return make_response(None, 200)


#---user relation resource

# The UserRelation model does not quite correspond with the API architecture
# here (the left_user/right_user part is not exposed to the client;
# unconfirmed relations are "requests", and not visible to the user that has
# created them; etc.).

@module.route('/user/friends', methods=['GET'])
@auth.auth_required
def get_friends():
    # TODO Communication with account.as.com could slow things down here.
    user = auth.current_user()
    return jsonify({'friends': user.friends_dict()})

@module.route('/user/friends/<user_email>', methods=['PUT'])
@auth.auth_required
def put_friend(user_email):
    user = auth.current_user()
    if not user.add_friend_request(user_email):
        return make_response(None, 404)
    return get_friends()

@module.route('/user/friends/<int:user_id>', methods=['DELETE'])
@auth.auth_required
def delete_friend(user_id):
    user = auth.current_user()
    if not user.delete_friend(user_id):
        return make_response(None, 404)
    return get_friends()

@module.route('/user/requests', methods=['GET'])
@auth.auth_required
def get_requests():
    user = auth.current_user()
    return jsonify({'requests': user.friend_requests_dict()})
    
@module.route('/user/requests/<int:user_id>', methods=['PUT'])
@auth.auth_required
def put_request(user_id):
    user = auth.current_user()
    data = get_json_request_data()
    if not user.update_friend_request(user_id, data.get('confirmed', False)):
        return make_response(None, 404)
    return get_requests()

@module.route('/user/pending_requests', methods=['GET'])
@auth.auth_required
def get_pending_requests():
    user = auth.current_user()
    return jsonify({'pending_requests': user.pending_requests_dict()})

@module.route('/user/pending_requests/<int:user_id>', methods=['DELETE'])
@auth.auth_required
def delete_pending_request(user_id):
    user = auth.current_user()
    if not user.delete_friend(user_id):
        return make_response(None, 404)
    return get_pending_requests()


#--- helpers

def get_json_request_data():
    try:
        post_data = request.json or {}
    except:
        current_app.logger.warn("Could not deserialize post data: %s" % request.data)
        abort(400, "Invalid request data.")
    return post_data
