# Komodo Collaboration Server (Komob Server)

This is the main server part for Komodo Collaboration. It handles sessions,
documents and friends, and does all the multi-user editing work.


## Requirements

`svn`, `hg` and `git` to pull other requirements. Also, `make`
ActivePython 2.6, `virtualenv`.


## Installation

    make

This creates a virtualenv in the source root directory and installs the
application and all requirements in there. Note that the `redisco` requirement
comes from my (private fork of the project)[https://github.com/kreichgauer/redisco]
since some of my patches have not yet been integrated.

To run the server type

    bin/python manage.py runserver

The `manage.py` file also has a shell command. For WSGI deployment there is a
`komob.wsgi` that ensures that the correct virtualenv is used to run the
application.


## Settings

The application reads configuration values from a `settings.py` file. The path
of that file must be stored in the `KOMOB_SETTINGS` environment variable.
`manage.py` and `komob.wsgi` automatically set this to `./settings.py` for you,
if you didn't set it yourself. There are two sample config files in this
directory. Copy one of them to `settings.py` and edit to your needs.


## View Cleanup Task

Every open collaboration document in a Komodo instance creates a ViewObj model
instance on the server. Komodo is supposed to "clean up" when it closes the
document, so the ViewObj can be deleted again. However, if Komodo crashes this
model instance lies in the database forever, so we have to clean old instances
periodically.

`manage.py` has a `cleanup` command that does exactly that, and if you execute
`runserver`, a subprocess takes care of this from time to time. However, if you
run the server as WSGI application behind apache, you will have to schedule a
cronjob or similar yourself to invoke the command from time to time. There is 
a `crontab.example` is (`crontab -e` as the application user and paste the 
example file content). The example job deletes up to 100 Views every hour. This
limit might have to be increased eventually (or dropped completely).
