
import os, sys, re
from os.path import isfile, isdir, exists, dirname, abspath, splitext, join
import logging
#import optparse
import traceback
#from pprint import pprint
#import random
#from glob import glob
#import cStringIO

pylib_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                             "pylib")
sys.path.insert(0, pylib_dir)
import dbx_sqlite3

__revision__ = "$Id$"
__version_info__ = (1, 0, 0)
__version__ = '.'.join(map(str, __version_info__))

d = dirname(dirname(dirname(dirname(abspath(__file__)))))
sys.path.insert(0, join(d, "codeintel", "support"))
try:
    import cmdln
finally:
    del sys.path[0]
    
log = logging.getLogger("dbx_sqlite3_driver")
log.setLevel(logging.DEBUG)

# These functions pulled as is from codeintel/ci2.py

# Recipe: pretty_logging (0.1) in C:\trentm\tm\recipes\cookbook
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
    infoFmt = "%(name)s: %(message)s"
    fmtr = _PerLevelFormatter(fmt=defaultFmt,
                              fmtFromLevel={logging.INFO: infoFmt})
    hdlr.setFormatter(fmtr)
    logging.root.addHandler(hdlr)

_v_count = 0
def _set_verbosity(option, opt_str, value, parser):
    global _v_count, log
    _v_count += 1
    if _v_count == 1:
        log.setLevel(logging.INFO)
        logging.getLogger("codeintel").setLevel(logging.INFO)
    elif _v_count > 1:
        log.setLevel(logging.DEBUG)
        logging.getLogger("codeintel").setLevel(logging.DEBUG)

def _set_logger_level(option, opt_str, value, parser):
    # Optarg is of the form '<logname>:<levelname>', e.g.
    # "codeintel:DEBUG", "codeintel.db:INFO".
    if ":" in value:
        lname, llevelname = value.split(':', 1)
    else:
        lname = "dbx_sqlite3_driver"
        llevelname = value
    llevel = getattr(logging, llevelname)
    logging.getLogger(lname).setLevel(llevel)

class Shell(cmdln.Cmdln):
    r"""drive the sqlite tester.

    usage:
        ${name} SUBCOMMAND [ARGS...]
        ${name} help SUBCOMMAND

    ${option_list}
    ${command_list}
    ${help_list}
    """
    name = "dbx_sqlite3_driver"
    version = __version__

    #XXX There is a bug in cmdln.py alignment when using this. Leave it off
    #    until that is fixed. -- I think this may be fixed now.
    #helpindent = ' '*4

    def get_optparser(self):
        optparser = cmdln.Cmdln.get_optparser(self)
        optparser.add_option("-v", "--verbose", 
            action="callback", callback=_set_verbosity,
            help="More verbose output. Repeat for more and more output.")
        optparser.add_option("-L", "--log-level",
            action="callback", callback=_set_logger_level, nargs=1, type="str",
            help="Specify a logger level via '<logname>:<levelname>'.")
        return optparser
    
    def do_test(self, argv):
        """Run my current play/dev code.

        ${cmd_usage}
        ${cmd_option_list}
        """
        path = argv[1]
        db = dbx_sqlite3.Database(path)
        table_names = db.listAllTableNames()
        for name in table_names:
            print "Get info on table %s" % (name,)
            count = db.getNumRows(name)
            print "# rows: %d" % (count,)
            offset = 0
            limit = min(count, 5)
            rows = db.getRows(name, offset, limit)
            print rows
            print "\n"
        print "Args: %r" % (argv,)
        
    # display_rows_by_num C:\Users\ericp\places.sqlite moz_favicons describe 0
    def do_display_rows_by_num(self, argv):
        dbpath, t = argv[1:3]
        rows = argv[3:]
        if len(rows) == 0:
            print "No rows requested"
            return
        if rows[0] == "describe":
            describe_rows = True
            del rows[0]
        else:
            describe_rows = False
        db = dbx_sqlite3.Database(dbpath)
        if describe_rows:
            col_info = db.getColumnInfo(t)
            print [ci.name for ci in col_info]
        for r in rows:
            rowData = db.getRows(t, r, 1)[0]
            print rowData            
        
    # python dbx_sqlite3_driver delete_row_by_key
    # ... C:\Users\ericp\places.sqlite moz_favicons 5
    def do_delete_row_by_key(self, argv):
        dbpath, t, rowNum = argv[1:4]
        db = dbx_sqlite3.Database(dbpath)
        count = db.getNumRows(t)
        print "Before: table %s has %d rows" % (t, count)
        row = db.getRows(t, rowNum, 1)[0]
        print "Here's the row we got:\n%s" % ("\n".join(row),)
        col_info = db.getColumnInfo(t)
        print "And here's the col info:\n%s" % ("\n".join([repr(c) for c in col_info]))
        key_names = []
        key_values = []
        idx = 0
        for ci in col_info:
            if ci.is_primary_key:
                key_names.append(ci.name)
                key_values.append(row[idx])
            idx += 1
        print "Keys: %s, values: %s" % (key_names, key_values)
        if key_names:
            res = db.deleteRowByKey(t, key_names, key_values)
            try:
                print "Delete by key: %r" % (res,)
            except:
                print sys.exc_info()[1]
            
    #Obsolete
    def do_delete_row_by_posn(self, argv):
        dbpath, t, rowNum = argv[1:4]
        db = dbx_sqlite3.Database(dbpath)
        count = db.getNumRows(t)
        row = db.getRows(t, rowNum, 1)[0]
        print "Here's the row we got:\n%s" % ("\n".join(row),)
        try:
            res = db.deleteRowByRowNumber(t, rowNum)
            if res:
                # refresh
                row = db.getRows(t, rowNum, 1)[0]
                print "Here's the new row at row %r :\n%s" % (rowNum, "\n".join(row),)
            else:
                print "Deleting failed"
        except:
            print sys.exc_info()[1]
            
    # update_cell_by_name C:\Users\ericp\places.sqlite moz_favicons  0 expiration 6
    def do_update_cell_by_name(self, argv):
        dbpath, t, rowNum, columnName, newValue = argv[1:]
        db = dbx_sqlite3.Database(dbpath)
        row = db.getRows(t, rowNum, 1)[0]
        try:
            res = db.updateCellInRowByColumnName(t, row, columnName, newValue)
            print "Update result: " + ['failed', 'passed'][res and 1 or 0]
        except:
            print sys.exc_info()[1]
        
    # update_cell_by_column_no C:\Users\ericp\places.sqlite moz_favicons  0 4 14
    def do_update_cell_by_column_no(self, argv):
        dbpath, t, rowNum, columnNo, newValue = argv[1:]
        columnNo = int(columnNo)
        db = dbx_sqlite3.Database(dbpath)
        row = db.getRows(t, rowNum, 1)[0]
        try:
            res = db.updateCellInRowByCellNo(t, row, columnNo, newValue)
            print "Update result: " + ['failed', 'passed'][res and 1 or 0]
        except:
            print sys.exc_info()[1]
        
    # python dbx_sqlite3_driver insert_row C:\Users\ericp\places.sqlite moz_favicons 5 'http://nowhere' '' 'text/plain' 55

    # insert_row C:\Users\ericp\places.sqlite moz_favicons 600 'http://nowhere' '' 'text/plain' 55
    def do_insert_row(self, argv):
        dbpath, t = argv[1:3]
        values = argv[3:]
        db = dbx_sqlite3.Database(dbpath)
        try:
            res = db.insertRow(t, values)
            print "Insert result: " + ['failed', 'passed'][res and 1 or 0]
        except:
            print sys.exc_info()[1]
        

def _do_main(argv):
    shell = Shell()
    res = shell.main(sys.argv)

def main(argv=sys.argv):
    _setup_logging() # defined in recipe:pretty_logging
    try:
        retval = _do_main(argv)
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
                tb_path, tb_lineno, tb_func = traceback.extract_tb(tb)[-1][:3]
                log.error("%s (%s:%s in %s)", exc_info[1], tb_path,
                          tb_lineno, tb_func)
        else:  # string exception
            log.error(exc_info[0])
        if not skip_it:
            if True or log.isEnabledFor(logging.DEBUG):
                print
                traceback.print_exception(*exc_info)
            sys.exit(1)
    else:
        sys.exit(retval)

if __name__ == "__main__":
    main(sys.argv)

