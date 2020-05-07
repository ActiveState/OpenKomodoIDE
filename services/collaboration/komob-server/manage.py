import os
from datetime import timedelta
import multiprocessing
import time

from flaskext.script import Manager, Command, Option, Server, Shell


# Setup app
if not 'KOMOB_SETTINGS' in os.environ:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.environ['KOMOB_SETTINGS'] = os.path.join(current_dir, 'settings.py')
import komob
manager = Manager(komob.app)


# Setup commands
class KomobServer(Server):
    
    def __init__(self, **kwargs):
        self.cleanup_task = kwargs.pop('cleanup_task', True)
        kwargs['use_debugger'] = komob.app.debug
        super(KomobServer, self).__init__(**kwargs)
    
    def get_options(self):
        options = Server.get_options(self)
        if self.cleanup_task:
            options += (Option('-c', '--no-cleanup',
                               action='store_false',
                               dest='cleanup_task',
                               default=self.cleanup_task,
                               help="Start without periodic cleanup task"),)
        else:
            options += (Option('-c', '--cleanup',
                               action='store_true',
                               dest='cleanup_task',
                               default=self.cleanup_task,
                               help="Start with periodic cleanup task"),)
        return options
    
    def handle(self, *args, **kwargs):
        if kwargs.pop('cleanup_task'):
            multiprocessing.Process(target=cleanup_worker).start()
        super(KomobServer, self).handle(*args, **kwargs)

class Cleanup(Command):
    """Clean stale view objects from the DB."""
    
    DEFAULT_MAX_AGE = 60 * 5 # 5 minutes
    DEFAULT_LIMIT = 30
    
    def get_options(self):
        options = (
            Option('--max-age',
                   default=self.DEFAULT_MAX_AGE,
                   type=int,
                   help='Maximum age in seconds (default is %d)' % self.DEFAULT_MAX_AGE),
            Option('--limit',
                   default=self.DEFAULT_LIMIT,
                   type=int,
                   help='Upper limit of records to delete (default is %d)' % self.DEFAULT_LIMIT),)
        return options
    
    def run(self, max_age, limit):
        cleanup(max_age_seconds=max_age, limit=limit)

def cleanup(max_age_seconds=60, limit=30):
    """Removes old views from the datastore."""
    import komob.lib
    max_age = timedelta(seconds=max_age_seconds)
    count = komob.lib.cleanup_views(max_age=max_age, limit=limit)
    if count > 0:
        print("Deleted %d views" % count)
    else:
        print("Did not delete any views")

def cleanup_worker():
    while(True):
        time.sleep(60)
        cleanup()

manager.add_command("runserver", KomobServer(host="0.0.0.0", port=5000))
manager.add_command("shell", Shell())
manager.add_command("cleanup", Cleanup())


if __name__ == "__main__":
    manager.run()
