#!/usr/bin/env python

r"""Command-line dev/test front end for Komodo's Tasks backend."""

import os
from os.path import join, dirname, basename, expanduser
import sys
from pprint import pprint
import re
import logging
import traceback
import getpass
import optparse

# Source tree sys.path setup.
sys.path.insert(0, join(dirname(dirname(__file__)), "externals", "lib"))
sys.path.insert(0, join(dirname(dirname(__file__)), "pylib"))

import cmdln
from cmdln import option, alias
import httplib2

import taskslib
from taskslib import manager



#---- globals

log = logging.getLogger("tsk")

_g_db_dir = expanduser("~/.tsk")
_g_cache_dir = expanduser("~/tmp/.tsk-cache")  #TODO: better dir here



#---- exceptions

class TskError(Exception):
    pass



#---- main module functionality

class TskShell(cmdln.Cmdln):
    """${name} -- command-line interface to Komodo's Tasks backend

    Usage:
        ${name} SUBCOMMAND [ARGS...]
        ${name} help SUBCOMMAND       # help on a specific command

    ${option_list}
    This is a for-testing/development command-line interface to Komodo 5.2's
    new Tasks feature backend.

    ${command_list}
    ${help_list}
    """
    name = 'tsk'
    version = taskslib.__version__
    helpindent = '  '

    def get_optparser(self):
        parser = cmdln.Cmdln.get_optparser(self)
        parser.add_option("-v", "--verbose", dest="log_level",
                          action="store_const", const=logging.DEBUG,
                          help="more verbose output")
        parser.add_option("-q", "--quiet", dest="log_level",
                          action="store_const", const=logging.WARNING,
                          help="quieter output")
        parser.set_defaults(log_level=logging.INFO)
        return parser

    def postoptparse(self):
        global log
        log.setLevel(self.options.log_level)

    
    @option("-n", "--nickname", help="A unique nickname for the repo.")
    @option("-u", "--username",
            help="username used to login to task repository")
    @option("-f", "--force", action="store_true", default=False,
            help="Force addition of the repository even if connecting to it fails.")
    def do_addrepo(self, subcmd, opts, repo_type, repo_url):
        """${cmd_name}: add a new task repository

        ${cmd_usage}
        ${cmd_option_list}
        Repository Types:
            trac        A Trac (http://trac.edgewall.org/) installation with
                        the XML-RPC plugin (http://trac-hacks.org/wiki/XmlRpcPlugin)
        
        Examples:
            tsk addrepo -n foo trac http://trac.example.com/foo
        """
        mgr = _get_mgr()
        known_repo_types = list(mgr.repo_types())
        if repo_type not in known_repo_types:
            raise TskError("unknown repository type, %r: known types are %r"
                           % (repo_type, ', '.join(known_repo_types)))

        if opts.nickname:
            print "  Nickname: %s" % opts.nickname
        print "  Repository type: %s" % repo_type
        print "  Base URL: %s" % repo_url
        
        # Username/password and authentication.
        # Note: currently we are presuming Basic HTTP auth.
        username = opts.username
        if not username:
            default_username = getpass.getuser()
            username = _query("  Username", getpass.getuser())
        else:
            print "  Username: %s" % username
        password = getpass.getpass("  Password (for '%s' %s user): " % (
            username, repo_type.capitalize()))
        
        repo = mgr.add_repo(repo_type, repo_url, username=username,
            password=password, nickname=opts.nickname,
            skip_verify=opts.force)
        log.info("%s added", repo)

    def do_repos(self, subcmd, opts):
        """${cmd_name}: list task repositories

        ${cmd_usage}
        ${cmd_option_list}
        """
        mgr = _get_mgr()
        for i, repo in enumerate(mgr.gen_repos()):
            if i != 0:
                print
            nickname_str = (" (%s)" % repo.nickname) if repo.nickname else ""
            print "repository: %d%s" % (repo.id, nickname_str)
            print "base_url: %s" % repo.base_url
            print "username: %s" % repo.username
            for q in repo.gen_queries():
                print
                nickname_str = (" (%s)" % q.nickname) if q.nickname else ""
                print "  query: %d%s" % (q.id, nickname_str)
                print "  title: %s" % q.title
                print "  conds: %s" % ', '.join(q.conds)

    def do_rmrepo(self, subcmd, opts, repo_id):
        """${cmd_name}: Remove a repository.

        ${cmd_usage}
        ${cmd_option_list}
        """
        mgr = _get_mgr()
        try:
            repo_id = int(repo_id)
        except ValueError:
            raise TskError("invalid repo id: %r (must be an integer)", repo_id)
        mgr.remove_repo(repo_id)
        print "repository %d removed" % repo_id

    @option("-t", "--title", help="A display title for the query.")
    @option("-n", "--nickname", help="A unique nickname for the query.")
    @option("-T", "--test", action="store_true", default=False,
            help="Don't actually add the query, just test it by listing "
                 "all the matching tasks.")
    @option("--non-interactive", dest="interactive", action="store_const",
        const=False, help="do no interactive prompting")
    @alias("addq")
    def do_addquery(self, subcmd, opts, repo_id, *conds):
        """${cmd_name}: Add a query.

        A query is a stored search on a repository. A query results in a list
        of tasks -- which is what this tool is meant to help you work with.
        The behaviour of a query with no conditions is repo-dependent (for
        Trac it returns all tasks).

        ${cmd_usage}
        ${cmd_option_list}
        Examples (currently using Trac condition syntax):
            tsk addq -T foo 'status=!closed'      # test query for open tickets
            tsk addq -n mine -t 'All Mine' 1 'status=!closed' 'owner=$USER'
        """
        try:
            repo_id = int(repo_id)
        except ValueError:
            pass
        mgr = _get_mgr()
        repo = mgr.repo_from_id(repo_id)
        nickname = opts.nickname
        title = opts.title
        conds = list(conds)
        
        # Print given information.
        if not opts.test:
            print "  Repository: %s" % repo
            if nickname:
                print "  Nickname: %s" % nickname
            if title:
                print "  Title: %s" % title
            for cond in conds:
                print "  Condition: %s" % cond
        
        # If no conds given, interactively ask for some data.
        if not conds and opts.interactive is not False:
            if not opts.test:
                if not nickname:
                    nickname = _query("  Nickname")
                if not title:
                    title = _query("  Title")
            print "Enter some query conditions ('?' for query help)."
            is_done = False
            while not is_done:
                answer, is_done = _query_field_in_set("Condition",
                    prompt_indent="  ", disallow_empty=True)
                if answer == "?":
                    print "* * *"
                    print repo.hook_query_help_text()
                    print "* * *"
                    continue
                if is_done:
                    break
                else:
                    conds.append(answer)
        
        q = repo.create_query(conds, nickname=nickname, title=title)
        if opts.test:
            for task in repo.tasks_from_query(q):
                print task
        else:
            repo.add_query(q)
            log.info("%s added to %s", q, repo)
    
    @alias("rmq")
    def do_rmquery(self, subcmd, opts, qid):
        """${cmd_name}: Remove a query.

        ${cmd_usage}
        ${cmd_option_list}
        See `tsk help qid'.
        """
        #TODO: dry-run? confirmation?
        mgr = _get_mgr()
        q = mgr.query_from_qid(qid)
        q.repo.remove_query(q.id)
        print "%s removed from %s" % (q, q.repo)

    @alias("add")
    @option("-i", "--interactive", dest="interactive", action="store_const",
        const=True, help="interactively prompt for all fields")
    @option("--non-interactive", dest="interactive", action="store_const",
        const=False, help="do no interactive prompting")
    def do_addtask(self, subcmd, opts, repo_id, *data):
        """${cmd_name}: Add a task/bug/issue/ticket.

        Add a task on the given repository. The task data is given as
        "key=value" pairs. Some repo-dependant fields are required. This
        will interactively query for fields, if necessary.

        ${cmd_usage}
        ${cmd_option_list}
        Examples:
            tsk add myrepo   # interactively asks for fields
            tsk add myrepo summary=foo milestone=milestone1
        """
        try:
            repo_id = int(repo_id)
        except ValueError:
            pass
        mgr = _get_mgr()
        repo = mgr.repo_from_id(repo_id)
        
        data2 = {}
        for datum in data:
            try:
                key, value = datum.split('=', 1)
            except ValueError:
                raise TskError("invalid argument: %s (must be of the "
                    "form 'key=value')" % datum)
            data2[key] = value
        #pprint(data2)
        
        fields = repo.task_fields()
        fields.sort(key=lambda f: (f.is_required, f.default is None),
            reverse=True)
        #pprint(fields)
        
        # Show all the current data fields.
        print "  Repository: %s" % repo
        for field in fields:
            if field.name in data2:
                print "  %s: %s" % (field.label, data2[field.name])
        
        # Query for extra data, if necessary.
        have_queried = False
        if opts.interactive is not False:
            for field in fields:
                if field.name in data2:
                    continue
                if (have_queried or opts.interactive is True
                    or (field.is_required and field.default is None)):
                    have_queried = True  # query from now on
                    value, is_done = _query_field_in_set(field.label,
                        field.default, field.is_required, field.options,
                        prompt_indent="  ")
                    if value is not None:
                        data2[field.name] = value
                    if is_done:
                        break
        
        # Confirm.
        if opts.interactive is not False:
            answer = _query_yes_no("Add this new task?")
            if answer != "yes":
                return

        # Create the task.
        #pprint(data2)
        task = repo.add_task(data2)
        log.info("tsk %d added to %s", task.id, repo)

    def do_lsfields(self, subcmd, opts, repo_id):
        """${cmd_name}: List fields for a task/bug/issue/ticket on the given repo.

        ${cmd_usage}
        ${cmd_option_list}
        """
        try:
            repo_id = int(repo_id)
        except ValueError:
            pass
        mgr = _get_mgr()
        repo = mgr.repo_from_id(repo_id)
        print repo
        for field in repo.task_fields():
            print '   ', field
    
    def help_ids(self):
        """Help on specifying repository, query and task ids."""
        return """# Repository IDs
    
        A 'rid' is a repository identifier. It is either the id of a repo
        or a repo nickname (if it has one).
        Examples: 1, myproject
        
        # Query IDs
        
        A 'qid' identifies a query on a particular repo. It is of
        of the form:
            <rid>:<query-nickname-or-id>
        Examples: 1:1, myproject:mine, myproject:2
        
        # Task IDs
        
        A 'tid' is an id identifying a task (aka bug, issue, ticket). It
        is of the form:
            <rid>#<task-id>
        Examples: 1#123, myproject#42
        """

    @alias("q")
    def do_query(self, subcmd, opts, qid):
        """${cmd_name}: Run the given query.

        ${cmd_usage}
        ${cmd_option_list}
        See `tsk help ids'.
        """
        mgr = _get_mgr()
        q = mgr.query_from_qid(qid)
        for task in q.tasks:
            print task

    @alias("up")
    def do_update(self, subcmd, opts, *ids):
        """${cmd_name}: Update the given repository, query or task.

        ${cmd_usage}
        ${cmd_option_list}
        See `tsk help ids'.
        """
        mgr = _get_mgr()
        if not ids:
            mgr.update_repos()
        else:
            for id in ids:
                if ":" in id:
                    mgr.update_query(id)
                elif "#" in id:
                    mgr.update_task(id)
                else:
                    mgr.update_repo(id)


#---- internal support stuff

def _get_mgr():
    return manager.Manager(_g_db_dir, _g_cache_dir)

def _query(question, default=None):
    s = question
    if default:
        s += " [%s]" % default
    s += ": "
    answer = raw_input(s)
    answer = answer.strip()
    if not answer:
        return default
    return answer

def _query_field_in_set(label, default=None, is_required=False, options=None,
        disallow_done=False, disallow_empty=False, prompt_indent=None):
    """Query the user for a field (one in a set). This looks something
    like so:
    
        Foo [empty for default (bar), '.' for done]: _
    
    I.e. the user is being prompted for the value of field "Foo". It
    has a default value of "bar". If the user enters '.', that indicates
    that he is done entering values, in a set of queries.
    
    @param label {str} The field label with which to prompt the user.
    @param default {str} A default value (or None if there isn't one).
    @param is_required {bool} Whether a value for this field is required.
        Only used if `default is None`.
    @param options {list} If the value must be one of a specific set of
        values, this is it.
    @param disallow_done {bool} Don't offer the "'.' for done" option.
    @param disallow_empty {bool}
    @param prompt_indent {str}
    @return (value, is_done) The value entered by the user, if any, and
        a boolean indicating if done (i.e. if '.' was entered).
    
    TODO: allow multiline values
    """
    instructions = []
    if default:
        instructions.append("empty for default (%s)" % default)
    elif default is not None:
        instructions.append("empty for default")
    if not is_required and not disallow_done:
        instructions.append("'.' for done")
    instructions = (instructions and " [%s]" % ', '.join(instructions) or "")
    prompt = "%s%s%s: " % (prompt_indent or '', label, instructions)
    
    while True:
        sys.stdout.write(prompt)
        sys.stdout.flush()
        answer = raw_input().lower()
        is_done = False
        if answer == '.':
            answer = None
            is_done = True
        elif answer == '':
            answer = default
        if is_required:
            if options and answer not in options:
                sys.stdout.write("***'%s' must be one of '%s'.***\n"
                    % (label, "', '".join(options)))
                continue
            elif answer is None:
                sys.stdout.write("***A value is required for '%s'.***\n"
                    % label)
                continue
        if answer is not None and options and answer not in options:
            sys.stdout.write("***'%s' must be one of '%s'.***\n"
                % (label, "', '".join(options)))
            continue
        if not is_done and answer is None and disallow_empty:
            sys.stdout.write("***'%s' cannot be empty.***\n" % label)
            continue
        if is_done:
            return (None, True)
        else:
            return (answer, False)

# Recipe: query_yes_no (1.0)
def _query_yes_no(question, default="yes"):
    """Ask a yes/no question via raw_input() and return their answer.
    
    "question" is a string that is presented to the user.
    "default" is the presumed answer if the user just hits <Enter>.
        It must be "yes" (the default), "no" or None (meaning
        an answer is required of the user).

    The "answer" return value is one of "yes" or "no".
    """
    valid = {"yes":"yes",   "y":"yes",  "ye":"yes",
             "no":"no",     "n":"no"}
    if default == None:
        prompt = " [y/n] "
    elif default == "yes":
        prompt = " [Y/n] "
    elif default == "no":
        prompt = " [y/N] "
    else:
        raise ValueError("invalid default answer: '%s'" % default)

    while 1:
        sys.stdout.write(question + prompt)
        choice = raw_input().lower()
        if default is not None and choice == '':
            return default
        elif choice in valid.keys():
            return valid[choice]
        else:
            sys.stdout.write("Please respond with 'yes' or 'no' "\
                             "(or 'y' or 'n').\n")



#---- mainline

class _NoReflowFormatter(optparse.IndentedHelpFormatter):
    """An optparse formatter that does NOT reflow the description."""
    def format_description(self, description):
        return description or ""

# Recipe: pretty_logging (0.1+)
class _PerLevelFormatter(logging.Formatter):
    """Allow multiple format string -- depending on the log level.
    
    A "fmtFromLevel" optional arg is added to the constructor. It can be
    a dictionary mapping a log record level to a format string. The
    usual "fmt" argument acts as the default.
    """
    def __init__(self, fmt=None, datefmt=None, fmtFromLevel=None):
        logging.Formatter.__init__(self, fmt, datefmt)
        if fmtFromLevel is None:
            self.fmtFromLevel = {}
        else:
            self.fmtFromLevel = fmtFromLevel
    def format(self, record):
        record.levelname = record.levelname.lower()
        if record.levelno in self.fmtFromLevel:
            #XXX This is a non-threadsafe HACK. Really the base Formatter
            #    class should provide a hook accessor for the _fmt
            #    attribute. *Could* add a lock guard here (overkill?).
            _saved_fmt = self._fmt
            self._fmt = self.fmtFromLevel[record.levelno]
            try:
                return logging.Formatter.format(self, record)
            finally:
                self._fmt = _saved_fmt
        else:
            return logging.Formatter.format(self, record)

def _setup_logging():
    hdlr = logging.StreamHandler()
    defaultFmt = "%(name)s: %(levelname)s: %(message)s"
    infoFmt = "%(message)s"
    fmtFromLevel={logging.INFO: "%(name)s: %(message)s"}
    fmtr = _PerLevelFormatter(defaultFmt, fmtFromLevel=fmtFromLevel)
    hdlr.setFormatter(fmtr)
    logging.root.addHandler(hdlr)

def main(argv=None):
    if argv is None:
        argv = sys.argv
    if not logging.root.handlers:
        _setup_logging()

    try:
        shell = TskShell()
        retval = shell.main(argv)
    except KeyboardInterrupt:
        sys.exit(1)
    except SystemExit:
        raise
    except:
        skip_it = False
        exc_info = sys.exc_info()
        if hasattr(exc_info[0], "__name__"):
            exc_class, exc, tb = exc_info
            if isinstance(exc, IOError) and exc.args[0] == 32:
                # Skip 'IOError: [Errno 32] Broken pipe'.
                skip_it = True
            if not skip_it:
                exc_str = str(exc_info[1])
                sep = ('\n' in exc_str and '\n' or ' ')
                where_str = ""
                tb_path, tb_lineno, tb_func = traceback.extract_tb(tb)[-1][:3]
                in_str = (tb_func != "<module>"
                          and " in %s" % tb_func
                          or "")
                where_str = "%s(%s#%s%s)" % (sep, tb_path, tb_lineno, in_str)
                log.error("%s%s", exc_str, where_str)
        else:  # string exception
            log.error(exc_info[0])
        if not skip_it:
            if log.isEnabledFor(logging.DEBUG):
                print
                traceback.print_exception(*exc_info)
            sys.exit(1)
    else:
        sys.exit(retval)

if __name__ == "__main__":
    main(sys.argv)

