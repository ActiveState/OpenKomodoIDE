# Copyright (c) 2005 ActiveState Corp.
# Author:
#   Trent Mick (TrentM@ActiveState.com)

"""The core package for "make.py".

Most of the "make" functionality it in this package. "make.py" just acts
as a front end for the command line and Makefile.py files.

This division exists so running `make` via all of the following works:

    python path/to/make.py ...   # a local Makefile.py is used
    python -m make ...           # a local Makefile.py is used
    python Makefile.py           # provided Makefile.py calls "make.main()"

If core items were defined in 'make.py' then one gets *duplicate* core
objects for the last invocation method.
"""

__revision__ = "$IdS"
__version_info__ = (0, 5, 0)
__version__ = '.'.join(map(str, __version_info__))

__all__ = [
    # Exceptions.
    "MakeError", "MakeTargetError", "IllegalMakefileError",
    # Base class for target-as-class targets.
    "Target",
    # Target-as-function decorators
    "dep", "output", "default",
]


import os
import sys
import re
from pprint import pprint
import glob
import logging
import time
import traceback
import types

from makelib.path import path as Path



log = logging.getLogger("make")



#---- exceptions

class MakeError(Exception):
    pass

class MakeTargetError(MakeError):
    """Indicates an error running a target body.

    The "target" attribute is the name of the target in which the error
    occured.
    """
    def __init__(self, err, target=None):
        self.err = err
        self.target = target
    def __str__(self):
        if self.target is not None:
            return "[%s] %s" % (self.target, self.err)
        else:
            return str(self.err)

class IllegalMakefileError(MakeError):
    """Semantic error in makefile.
    
    'path' is the path to the makefile.
    """
    def __init__(self, err, path=None):
        self.err = err
        self.path = path
    def __str__(self):
        if self.path is not None:
            return "%s: %s" % (self.path, self.err)
        else:
            return str(self.err)


#---- decorators for targets-as-functions

def default(func):
    """Decorator to mark a make_*() target as the default.
    
    Example:
        @make.default
        def make_foo(maker, log):
            #...
    """
    func.default = True
    return func

def output(*outputs):
    """Decorator to specify output for a make_*() target.
    
    Example:
        @make.output("foo.txt", "bar.txt")
        def make_foo(maker, log):
            #...
    """
    def decorate(f):
        if not hasattr(f, "outputs"):
            f.outputs = []
        f.outputs += [Path(output) for output in outputs]
        return f
    return decorate

def dep(*deps):
    """Decorator to specify dependencies for a make_*() target.
    
    Example:
        @make.dep("eggs.txt", "bacon.txt")
        def make_breakfast(maker, logs):
            #...
    """
    def decorate(f):
        if not hasattr(f, "deps"):
            f.deps = []
        f.deps += deps
        return f
    return decorate



#---- Core objects and routines

class Target(object):
    """Base class for a Makefile target.
    Typically a specific target is a subclass of Target. For example:

        from make import Target
        class install(Target):
            deps = ["build"]
            def outputs(self):
                yield os.path.join(config.prefix, "bin", "foo")
            def make(self, maker, log):
                ...

    #XXX Document how to use this.
    #       name, doc(), deps(), outputs(), make()
    """
    default = False  # set to true to make a subclass the default target

    def __init__(self):
        self.name = self.__class__.__name__

    def __repr__(self):
        return "<target '%s'>" % self.name

    def doc(self):
        """Return documentation for this target, if any."""
        return self.__doc__

    def deps(self):
        """Return a list of target names upon which this target depends."""
        return []

    def outputs(self):
        """Return a list of file paths that this target creates."""
        return []

    # The presence of a 'make()' implementation on a Target class
    # indicates if there is anything to run to make this target. For
    # example, typically an "all" target will not have a "make" method.
    # Instead it will just have a number of dependencies.
    #def make(self, maker, log):
    #    ...


class FuncTarget(Target):
    """A target defined as a "def make_FOO" function in a Makefile."""
    def __init__(self, func):
        self.func = func
        self.name = func.__name__[len("make_"):]
        if hasattr(func, "default"):
            self.default = func.default

    def doc(self):
        return self.func.__doc__ 

    def deps(self):
        if hasattr(self.func, "deps"):
            return self.func.deps
        else:
            return []

    def outputs(self):
        if hasattr(self.func, "outputs"):
            return self.func.outputs
        else:
            return []

    def make(self, maker, log):
        return self.func(maker, log)


class Makefile(object):
    def __init__(self, makefile_path):
        self.path = makefile_path
        self.targets = {} # <target-name> -> <target>
        self._load()

    def _load(self):
        log.debug("reading `%s'", self.path)
        module = _module_from_makefile_path(self.path)
        for name, attr in module.__dict__.items():
            if (isinstance(attr, type)
                and issubclass(attr, Target)
                and not name.startswith("_")  # skip internal target classes
                and attr is not Target        # skip the base Target class
               ):
                if name in self.targets:
                    raise IllegalMakefileError("conflicting target definitions: XXX")
                self.targets[name] = attr()
            elif isinstance(attr, types.FunctionType) \
                 and name.startswith('make_'):
                target = FuncTarget(attr)
                if name in self.targets:
                    raise IllegalMakefileError("conflicting target definitions: XXX")
                self.targets[ name[len("make_"):] ] = target
        #pprint(self.targets)

        default_targets = [t for t in self.targets.values() if t.default]
        if not default_targets:
            self.default_target = None
        elif len(default_targets) == 1:
            self.default_target = default_targets[0]
        else:
            raise IllegalMakefileError("more than one default target: %s"
                                       % ', '.join(map(str, default_targets)))




class Maker(object):
    def __init__(self, options, makefile_path):
        self.makefile = Makefile(makefile_path)
        self.options = options
        self._depth = 0     # log.debug indentation depth
        self.num_targets_made = 0

    def list_targets(self):
        WIDTH = 78
        name_width = max([len(name) for name in self.makefile.targets])
        for target_name, target in sorted(self.makefile.targets.items()):
            doc = target.doc()
            if not doc:
                print target_name
            else:
                summary_width = WIDTH - name_width - 2
                summary = _first_paragraph(doc, True)
                if len(summary) > summary_width:
                    summary = summary[:summary_width-3] + "..."
                template = "%%-%ds  %%s" % name_width
                print template % (target_name, summary)

    def _debug(self, msg, *args):
        log.debug(' '*self._depth + msg, *args)

    def outputs_from_target_name(self, target_name):
        target = self.makefile.targets[target_name]
        if callable(target.outputs):
            outputs = target.outputs()
            #if isinstance(outputs, types.GeneratorType):
            #    outputs = list(outputs)
        else:
            outputs = target.outputs
        return [Path(o) for o in outputs]

    def deps_from_target_name(self, target_name):
        target = self.makefile.targets[target_name]
        if callable(target.deps):
            deps = target.deps()
            if isinstance(deps, types.GeneratorType):
                deps = list(deps)
        else:
            deps = target.deps
        return deps

    def make(self, *target_names):
        """Make the given targets.

        Returns:
            ([those-successfully-made...],     
             [those-skipped...],            # b/c didn't need remaking
             [those-failed...])
        """
        if not target_names: # Use the default target.
            if self.makefile.default_target:
                target_names = [self.makefile.default_target.name]
            else:
                raise MakeError("no target given and no default target in '%s'"
                                % self.makefile.path)

        targets_made = []
        targets_skipped = []
        targets_failed = []
        for target_name in target_names:
            self._debug("Considering target `%s'.", target_name)
            try:
                target = self.makefile.targets[target_name]
            except KeyError:
                raise MakeError("no such target: '%s'" % target_name)
            self._depth += 1

            # If any of this target's outputs do not exist, then we know
            # for sure that we need to remake it.
            outputs = self.outputs_from_target_name(target_name)
            nonexistant_outputs = [o for o in outputs if not o.exists()]
            for output in nonexistant_outputs:
                self._debug("Output `%s' of target `%s' does not exist.",
                            output, target_name)

            # Re-make any of this target's dependencies if necessary.
            deps = self.deps_from_target_name(target_name)
            if deps:
                self._depth += 1
                deps_made, deps_skipped, deps_failed = self.make(*deps)
                self._depth -= 1
            self._debug("Finished dependencies of target `%s'.", target_name)
            if deps and deps_failed:
                self._depth -= 1
                self._debug("Giving up on target `%s'", target)
                log.info("Target `%s' not remade because of errors.",
                         target_name)
                targets_failed.append(target)
                continue

            # We need to remake this target if any of the following is true:
            # 1. It has no outputs (i.e. it is virtual).
            # 2. At least one of its outputs does not exist.
            # 3. Any of its dependencies were remade.
            # 4. It is older than any of its dependencies.
            #    Because a target can have multiple outputs (or none) this
            #    isn't so straightforward: if any of the outputs of this
            #    target is older than any of the outputs of any dependency.
            if not outputs:                                     # 1.
                need_to_remake = True
            elif nonexistant_outputs:                           # 2.
                need_to_remake = True
            elif deps and deps_made:                            # 3.
                need_to_remake = True
            else:
                need_to_remake = False
                oldest_output_mtime = min([o.mtime for o in outputs])
                for dep in deps:
                    yougest_dep_mtime = max(
                        [o.mtime for o in self.outputs_from_target_name(dep)])
                    if yougest_dep_mtime > oldest_output_mtime: # 4.
                        word = "newer"
                        need_to_remake = True
                        # Optmization: We can stop processing here because
                        # we already know that we need_to_remake.  GNU make
                        # keeps going through (if debugging with '-d', at
                        # least).
                        if not log.isEnabledFor(logging.DEBUG):
                            break
                    else:
                        word = "older"
                    self._debug("Dependency `%s' is %s than target `%s'.",
                                dep, word, target_name)

            self._depth -= 1
            if need_to_remake:
                if not hasattr(target, "make"):
                    self._debug("Nothing more to do for target `%s'.",
                                target_name)
                else:
                    self._debug("Must remake target `%s'.", target_name)
                    err_str = self._do_make(target)
                    if err_str:
                        log.error("[%s] %s", target_name, err_str)
                        self._debug("Failed to remake target `%s'.",
                                    target_name)
                        targets_failed.append(target)
                    else:
                        self._debug("Successfully remade target `%s'.",
                                    target_name)
                        targets_made.append(target)
            else:
                targets_skipped.append(target)
                self._debug("No need to remake target `%s'.", target_name)

        return (targets_made, targets_skipped, targets_failed)

    def _do_make(self, target):
        """Run the function body for this target.

        A make target indicates an error by raising an exception
        The return value is ignored.

        How this method returns:
        - If the target function raises an exception and keep_going is
          false (i.e. '-k' was NOT used) then the exception is passed
          through.  If keep_going is true then a (string) summary of the
          error is returned.
        - Otherwise (the target was successfully run), None is returned.

        Callers should work with the return value rather than trapping
        any exceptions so that this function can properly deal with
        error handling as per the "-k" option.
        """
        if self.options.dry_run:
            log.debug("make target `%s' (dry-run)", target.name)
            return
        log.target = target.name
        try:
            try:
                target.make(self, log)
            finally:
                log.target = None
        except (SystemExit, KeyboardInterrupt):
            raise
        except:
            exc_class, exc, tb = sys.exc_info()
            if self.options.keep_going:
                tb_path, tb_lineno, tb_func = traceback.extract_tb(tb)[-1][:3]
                return "%s (%s:%s in %s)" % (exc, tb_path, tb_lineno, tb_func)
            elif exc is None: # string exception
                raise
            else:
                exc.make_target = target # stash this away for error reporting
                raise


def find_makefile_path(makefile_opt):
    #XXX Eventually might do the Cons-thang: walk up dir tree looking
    #    for Makefile.py.
    makefile_path = Path(makefile_opt or "Makefile.py")
    if not makefile_path.exists():
        raise MakeError("could not file makefile: '%s'" % makefile_path)
    return makefile_path


def _module_from_makefile_path(makefile_path):
    # If this make was started by executing the Makefile itself, then
    # the Makefile module is already loaded as "__main__".
    if "__main__" in sys.modules \
       and _samefile(sys.modules["__main__"].__file__, makefile_path):
        return sys.modules["__main__"]

    sys.path.insert(0, makefile_path.parent)
    try:
        return _module_from_path(makefile_path)
    finally:
        del sys.path[0]



#---- internal support stuff

def _samefile(a, b):
    from os.path import normpath, abspath
    return normpath(abspath(a)) == normpath(abspath(b))

# Recipe: first_paragraph (1.0.1) in /home/trentm/tm/recipes/cookbook
def _first_paragraph(text, join_lines=False):
    """Return the first paragraph of the given text."""
    para = text.lstrip().split('\n\n', 1)[0]
    if join_lines:
        lines = [line.strip() for line in  para.splitlines(0)]
        para = ' '.join(lines)
    return para

# Recipe: module_from_path (1.0) in /Users/trentm/tm/recipes/cookbook
def _module_from_path(path):
    from os.path import dirname, basename, splitext
    import imp
    dir  = dirname(path) or os.curdir
    name = splitext(basename(path))[0]
    iinfo = imp.find_module(name, [dir])
    return imp.load_module(name, *iinfo)


