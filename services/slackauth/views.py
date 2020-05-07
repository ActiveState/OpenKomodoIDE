import re
import os
import sys
import traceback
from os.path import join, dirname, abspath, exists

from django.http import HttpResponse, HttpRequest, HttpResponseServerError
from django.conf import settings
from django.template.loader import render_to_string, get_template


from urllib import request, parse
import json

client_id = settings.SLACK_CLIENT_ID
client_secret = settings.SLACK_CLIENT_SECRET

def auth(request):
    redirect_uri = "http://komodo.activestate.com/slack/auth"
    try:
        # I don't actually care what the version is, just that it exists.
        # If it exists and doesn't throw an exception (for now, can change what
        # this means later) then I know it's 11.1 and I need https.
        # Add an `if, elif` implementation if you care about the version at a
        # later date.
        re.search("-k(\d{2}\.\d{1})", request.GET["state"]).group(1)
        redirect_uri = "https://komodo.activestate.com/slack/auth"
    except AttributeError as e:
        # There is no version tagged onto the state.
        pass
    
    return authenticate(request, redirect_uri)

def authenticate(request, redirect_uri):
    print(redirect_uri)
    try:
        code = request.GET['code']
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri
        }
        # jsonData = json.dumps(data)
        baseURL = "https://slack.com/api/oauth.access"
        # urllib.urlencode(jsonData)
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
        }
        res = request.urlopen(baseURL, parse.urlencode(data))
        respJSON = json.loads(res.read()); 
        ### create template, send it back. Process it in Komodo
        respCont = render_to_string('slackauth.html', respJSON)
    except:
        try:
            error = request.GET['error']
            respCont = render_to_string('slackauth-error.html', {"error":error,"message":"It appears you cancelled the authentication process. If you change your mind simply try sharing through Slack again."})
        except:
            respCont = render_to_string('500.html', {})
            
    return HttpResponse(respCont)

def handle_500(req, *args, **argv):
    t = get_template('500.html')
    print(sys.exc_info())
    type, value, tb =sys.exc_info()
    return HttpResponseServerError(t.render({
        'exception_value': value,
        'value': type,
        'tb': traceback.format_exception(type, value, tb)
    }))

def handle_404(req, *args, **argv):
    t = get_template('404.html')
    return HttpResponseServerError(t.render())

