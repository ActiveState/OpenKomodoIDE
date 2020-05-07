
import sys
import os
from os.path import normpath, expanduser, join, dirname, abspath, exists
import posixpath


DEBUG = False

TEMPLATE_DEBUG = DEBUG

TIME_ZONE = 'America/Vancouver'
LANGUAGE_CODE = 'en-us'
SITE_ID = 1

ALLOWED_HOSTS=[
    "localhost"
]

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

TEMPLATE_DIRS = [
    posixpath.normpath(join(dirname(__file__), "templates"))
]

# List of callables that know how to import templates from various sources.
# TEMPLATE_LOADERS = (
#     'django.template.loaders.filesystem.load_template_source',
#     'django.template.loaders.app_directories.load_template_source',
# )

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [posixpath.normpath(join(dirname(__file__), "templates"))],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.contrib.auth.context_processor.auth',
                'django.template.context_processors.debug',
                'django.template.context_processors.i18n'
                'django.template.context_processors.media'
                'django.template.context_processors.static'
                'django.template.context_processors.tz'
            ]
        }
    },
]

ROOT_URLCONF = 'urls'

# Slack API integrations
# Might be able to move this to a settings file in the slack folder
# Just proof of concepting right now
SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET")
if SLACK_CLIENT_ID is None:
    raise Exception("Missing 'SLACK_CLIENT_ID' env var.")
if SLACK_CLIENT_SECRET is None:
    raise Exception("Missing 'SLACK_CLIENT_SECRET' env var.")
