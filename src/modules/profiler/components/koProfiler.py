#!/usr/bin/env python

# Copyright (c) 2000-2009 ActiveState Software Inc.
# See the file LICENSE.txt for licensing information.

from os.path import basename
import re
import string
import logging
import operator
import threading

try:
    from xpcom import components
    _has_xpcom_ = True
except ImportError:
    _has_xpcom_ = False
    class koFileEx(object):
        def __init__(self):
            self.URI = None
            self.file = None
        def open(self, mode):
            self.file = file(self.URI, mode)
        def read(self, amount):
            return self.file.read(amount)
        def close(self):
            return self.file.close()
        @property
        def baseName(self):
            return basename(self.URI)
    class xpcomstub(object):
        def __init__(self, clsname=None):
            self.clsname = clsname
        def createInstance(self, interface):
            if self.clsname == "@activestate.com/koPythonProfilerItem;1":
                return koPythonProfilerItem()
            elif self.clsname == "@activestate.com/koCallgrindProfilerItem;1":
                return koCallgrindProfilerItem()
            elif self.clsname == "@activestate.com/koPythonProfiler;1":
                return koPythonProfiler()
            elif self.clsname == "@activestate.com/koCallgrindProfiler;1":
                return koCallgrindProfiler()
            elif self.clsname == "@activestate.com/koFileEx;1":
                return koFileEx()
    components = xpcomstub()
    components.interfaces = xpcomstub()
    components.interfaces.koIProfilerInstance = xpcomstub()
    components.interfaces.koIProfilerItem = xpcomstub()
    components.interfaces.koIProfilerService = xpcomstub()
    components.interfaces.koIFileEx = xpcomstub()
    components.classes = {
        "@activestate.com/koPythonProfilerItem;1": xpcomstub("@activestate.com/koPythonProfilerItem;1"),
        "@activestate.com/koCallgrindProfilerItem;1": xpcomstub("@activestate.com/koCallgrindProfilerItem;1"),
        "@activestate.com/koPythonProfiler;1": xpcomstub("@activestate.com/koPythonProfiler;1"),
        "@activestate.com/koCallgrindProfiler;1": xpcomstub("@activestate.com/koCallgrindProfiler;1"),
        "@activestate.com/koFileEx;1": xpcomstub("@activestate.com/koFileEx;1"),
    }
    del xpcomstub


# Globals
log = logging.getLogger('koProfiler')

class InvalidProfileData(Exception):
    pass


class koPythonProfilerItem(object):
    _reg_clsid_ = "{2096937e-a797-46fd-9eb6-f5e1727b5880}"
    _com_interfaces_ = [components.interfaces.koIProfilerItem]
    _reg_contractid_ = "@activestate.com/koPythonProfilerItem;1"
    _reg_desc_ = "A python profiler item"

    call_factor = 1
    _allCallers = None
    _allCallees = None

    def __init__(self, profdata, func, parent=None, forCallee=None):
        self.prof = profdata
        self.func = func
        self.path = func[0]
        self.line = func[1]
        #self.name = "%s (%s:%d)" % (func[2], basename(func[0]), func[1])
        self.name = func[2]

        numcalls, totalcalls, totaltime, cumultime, callers = profdata.stats[func]
        if parent is None and forCallee is None:
            self.callers = None
        elif forCallee is not None:
            self.callers = None
            # We don't want the numbers for the function itself, we want
            # the numbers for calling into the child function "forCallee".
            # Some of these calls may have been made to differing child
            # functions, check that now.
            callees = profdata.all_callees[func]
            try:
                numcalls, totalcalls, totaltime, cumultime = callees[forCallee.func]
            except:
                log.exception("Missing callee information in func %r, forCallee %r", func, forCallee.func)
        else:
            # Some of these calls may have been made by a differing parent
            # function, check that now - we only want results for the given
            # parent.
            nc, tc, tt, ct = callers[parent.func]
            factor = parent.call_factor * (numcalls / nc)
            if factor > 1:
                numcalls /= factor
                totaltime /= factor
                cumultime /= factor
            self.call_factor = factor

        self.num_calls = numcalls
        self.total_num_calls = totalcalls
        self.own_cpu_time = totaltime
        self.own_cpu_percentage = int((totaltime / profdata.total_tt) * 100)
        self.cumulative_cpu_time = cumultime
        self.cumulative_cpu_percentage = int((cumultime / profdata.total_tt) * 100)
        self.callers = callers
        self.callees = profdata.all_callees[func]
        self.hasChildren = len(self.callees) > 0
        self.children = None

    def getChildren(self):
        if self.children is None:
            # Load them up...
            prof = self.prof
            self.children = [koPythonProfilerItem(prof, x, self) for x in self.callees]
        return self.children

    def getAllCallers(self):
        """Return all items that called into our item."""
        if self._allCallers is None:
            prof = self.prof
            self._allCallers = [koPythonProfilerItem(prof, x, forCallee=self) for x in self.callers]
            self._allCallers.sort(key=operator.attrgetter('cumulative_cpu_time'))
        return self._allCallers

    def getAllCallees(self):
        """Return all items that our item has called."""
        if self._allCallees is None:
            prof = self.prof
            self._allCallees = [koPythonProfilerItem(prof, x, self) for x in self.callees]
            self._allCallees.sort(key=operator.attrgetter('cumulative_cpu_time'))
        return self._allCallees

class koPythonProfiler(object):
    _reg_clsid_ = "{ba6a3989-686a-4856-a3d4-9c48403c3e43}"
    _com_interfaces_ = [components.interfaces.koIProfilerInstance]
    _reg_contractid_ = "@activestate.com/koProfiler?type=python_pstats;1"
    _reg_desc_ = "Komodo Python pstats profiler data"

    type_name = "python pstats"
    language = "Python"
    rawdata = None

    def __init__(self):
        self.prof = None
        self.top_funcs = None

    def create_stats(self):
        """This method gets called by Stats() in the load method below."""
        try:
            # Komodo uses cPickle for storing profiling stats, but the Python
            # stdlib will use marshal - marshal is considered insecure. We try
            # pickle first and if that fails, then we fallback to marshal.
            import cPickle
            self.stats = cPickle.loads(self.rawdata)
        except cPickle.UnpicklingError:
            import marshal
            self.stats = marshal.loads(self.rawdata)

    def load(self, name, data):
        self.name = name
        from pstats import Stats

        if isinstance(data, unicode):
            # We need bytes - not unicode.
            data = data.encode("utf-8")

        self.rawdata = data
        self.prof = Stats(self)
        self.stats = None

        self.prof.sort_stats("cumulative")
        self.prof.calc_callees()
        stats = self.prof.stats
        self.top_funcs = []
        #for func in (self.prof.fcn_list or stats):
        for func, callees in self.prof.all_callees.items():
            #path, line, name = func_tuple
            callers = stats[func][-1]
            if not callers and callees:
                self.top_funcs.append(func)

        if len(self.top_funcs) == 1:
            func = self.top_funcs[0]
            filename, line, name = func
            callees = self.prof.all_callees[func]
            if filename == '<string>' and line == 1 and name == '<module>' and \
               len(callees) == 1:
                cfunc = callees.keys()[0]
                cfilename, cline, cname = cfunc
                ccallees = self.prof.all_callees[cfunc]
                if cfilename == '~' and cline == 0 and cname == '<execfile>':
                    self.top_funcs = ccallees

    def save(self, filepath):
        file(filepath, "wb").write(self.rawdata)

    def get_total_cpu_time(self):
        if self.prof is None:
            raise RuntimeError("No profile data is loaded")
        return self.prof.total_tt

    def getHierachicalItems(self):
        if self.prof is None:
            raise RuntimeError("No profile data is loaded")
        return [koPythonProfilerItem(self.prof, x) for x in self.top_funcs]

    def getAllItems(self):
        if self.prof is None:
            raise RuntimeError("No profile data is loaded")
        return sorted([koPythonProfilerItem(self.prof, x) for x in self.prof.fcn_list],
                      key=operator.attrgetter('own_cpu_time'), reverse=True)

    def _walk(self, func, already_walked, depth=0, parent_func=None, factor=1):
        filename, line, name = func
        data = self.prof.stats[func]
        callers = data[4]
        if parent_func and parent_func in callers:
            numcalls, totalcalls, totaltime, cumultime = callers[parent_func]
            factor *= (data[0] / numcalls)
            cumultime /= factor
            totaltime /= factor
        else:
            numcalls, totalcalls, totaltime, cumultime, callers = self.prof.stats[func]
        spacer = " " * depth
        print "%s %8.3f %s (%s:%d): %r" % (spacer, cumultime, name, filename, line, data[:4])
        print "%s      factor: %r" % (spacer, factor, )
        #print "%s callers: %r" % (spacer, callers.items(), )
        #print "%s      callees: %r" % (spacer, self.prof.all_callees[func].items(), )
        print
        already_walked[func] = 1
        for callee in self.prof.all_callees[func]:
            if callee not in already_walked:
                self._walk(callee, already_walked, depth+1, func)

    def walk(self):
        already_walked = {}
        for func in self.top_funcs:
            self._walk(func, already_walked)

    def dump(self):
        from pstats import func_std_string, func_strip_path
        print "Profile info"

        print 'top_level: %r' % (self.prof.top_level, )
        print 'total_calls: %r' % (self.prof.total_calls, )
        print 'prim_calls: %r' % (self.prof.prim_calls, )
        print "total_tt: %.3f CPU seconds" % (self.prof.total_tt, )

        #stats = self.prof.stats
        #for func in (self.prof.fcn_list or stats):
        #    cc, nc, tt, ct, callers = stats[func]
        #    c = str(nc)
        #    if nc != cc:
        #        c = c + '/' + str(cc)
        #    # num calls
        #    print c.rjust(9),
        #    # total time for call
        #    print "%8.3f" % (tt),
        #    # time per call
        #    if nc == 0:
        #        print ' '*8,
        #    else:
        #        print "%8.3f" % (tt/nc),
        #    # cumulative time for call
        #    print "%8.3f" % (ct),
        #    if cc == 0:
        #        print ' '*8,
        #    else:
        #        print "%8.3f" % (ct/cc),
        #    print func_std_string(func)
        #    for caller in callers:
        #        print "        %s" % (caller, )
        #    print



class CallgrindFunction(object):
    """A unique function that was profiled."""

    own_cpu_time = 0
    total_calls = 0
    _cachekey = None

    @classmethod
    def generate_cachekey(cls, path, name):
        if path is None:
            return name
        return "%s:%s" % (path, name)

    def __init__(self, path, name, lineno=-1, primary_defn=True):
        self.path = path
        self.name = name
        self.line = lineno
        self.primary_defn = primary_defn
        self._callee_cache = {}

    def __repr__(self):
        return "%s#%d: called: %d, cpu time: %d" % (self.name, self.line, self.total_calls, self.own_cpu_time)

    def _addOwnCosts(self, lineno, costs):
        if self.line == -1:
            self.line = lineno
        # We don't actually know what the costs refer to, we assume the first
        # cost item is the important one (i.e. the timing).
        self.own_cpu_time += costs[0]

    def _addCallee(self, fn, caller_lineno, num_calls, cost_entries):
        key = fn.cachekey
        data = self._callee_cache.get(key)
        if data is None:
            self._callee_cache[key] = [fn, caller_lineno, num_calls, cost_entries]
        else:
            data[2] += num_calls
            costs = data[3]
            for i in range(len(cost_entries)):
                costs[i] += cost_entries[i]
        fn.incrementCallCount(num_calls)

    def incrementCallCount(self, count=1):
        self.total_calls += count

    @property
    def isPrimaryDefition(self):
        return self.primary_defn

    def setAsPrimaryDefinition(self):
        self.primary_defn = True

    @property
    def cachekey(self):
        if self._cachekey is None:
            self._cachekey = self.generate_cachekey(self.path, self.name)
        return self._cachekey

    @property
    def callees(self):
        return self._callee_cache.values()

class koCallgrindProfilerItem(object):
    _reg_clsid_ = "{1ec846a8-621c-4862-8142-0d85755cd3e1}"
    _com_interfaces_ = [components.interfaces.koIProfilerItem]
    _reg_contractid_ = "@activestate.com/koCallgrindProfilerItem;1"
    _reg_desc_ = "A callgrind profiler item"

    _allCallers = None
    NS_IN_A_SECOND = 1000000.0

    def __init__(self, prof, cg_func, num_calls, costs=None):
        self.prof = prof
        self.cg_func = cg_func
        self.num_calls = num_calls
        self.own_cpu_time_ns = cg_func.own_cpu_time
        if cg_func.total_calls > 1:
            self.own_cpu_time_ns = int(self.own_cpu_time_ns * (float(num_calls) / cg_func.total_calls))
        self.own_cpu_percentage = int((float(self.own_cpu_time_ns) / prof._total_cost) * 100)
        if costs is None:
            # Need to iterate over the callees and sum up their values.
            self.cumulative_cpu_time_ns = sum([x[3][0] for x in cg_func.callees])
        else:
            self.cumulative_cpu_time_ns = costs[0]  # XXX - which cost item?
        self.cumulative_cpu_percentage = int((float(self.cumulative_cpu_time_ns) / prof._total_cost) * 100)
        self.hasChildren = len(cg_func.callees) != 0
        self.children = None
    
    @property
    def path(self):
        return self.cg_func.path

    @property
    def name(self):
        return self.cg_func.name

    @property
    def line(self):
        return self.cg_func.line

    @property
    def own_cpu_time(self):
        # Convert time to seconds
        return self.own_cpu_time_ns / self.NS_IN_A_SECOND

    @property
    def cumulative_cpu_time(self):
        # Convert time to seconds
        return self.cumulative_cpu_time_ns / self.NS_IN_A_SECOND

    @property
    def total_num_calls(self):
        return max(self.num_calls, self.cg_func.total_calls)

    def getChildren(self):
        if self.children is None:
            # Load them up...
            prof = self.prof
            self.children = [koCallgrindProfilerItem(prof, x[0], x[2], x[3]) for x in self.cg_func.callees]
        return self.children

    def getAllCallers(self):
        """Return all items that called into our item."""
        if self._allCallers is None:
            prof = self.prof
            callers = prof.all_callers.get(self.cg_func.cachekey)
            if callers:
                self._allCallers = sorted([koCallgrindProfilerItem(prof, cgfunc, cgfunc.total_calls) for cgfunc in callers],
                                          key=operator.attrgetter('cumulative_cpu_time'), reverse=True)
            else:
                self._allCallers = []
        return self._allCallers

    def getAllCallees(self):
        """Return all items that our item has called."""
        return self.getChildren()

class koCallgrindProfiler(object):
    _reg_clsid_ = "{528e3289-a272-4b32-9e38-ba734481452a}"
    _com_interfaces_ = [components.interfaces.koIProfilerInstance]
    _reg_contractid_ = "@activestate.com/koProfiler?type=callgrind;1"
    _reg_desc_ = "Komodo Callgrind profiler data"

    type_name = "callgrind"
    # We won't know the language until we parse the data.
    language = ""
    top_funcs = None
    all_funcs = None
    all_callers = None
    rawdata = None

    def _clear_working_variables(self):
        self._num_language_guess = 0
        self._headers = []
        self._cost_names = []
        self._filename_refs = {}       # Used to store filename references.
        self._function_refs = {}       # Used to store function references.
        self._fn_from_cache_key = {}   # Cache of all function objects.
        self._current_filename = None  # Store the current file name.
        self._current_fn = None        # Store the current function object.
        self._current_fn_name = None    # Store the current function name.
        self._current_callee_filename = None  # Store the current callee file name.
        self._current_callee_fn = None        # Store the current callee function object.
        self._current_callee_fn_name = None   # Store the current callee function name.
        self._callee_call_count = None        # Number of times callee was called.

    def _parse_headers(self, lines, lineno):
        found_events_header = False
        while lineno < len(lines):
            line = lines[lineno]
            lineno += 1
            if not line:
                continue
            sp = line.split(":", 1)
            if len(sp) == 2:
                if "=" in sp[0]:
                    # This is actual data - return now.
                    lineno -= 1
                    break
                sp[1] = sp[1].strip()
                self._headers.append(sp)
                if sp[0] == "events":
                    found_events_header = True
                    self._cost_names = sp[1].split()
                elif sp[0] == "cmd":
                    # Try to determine the language name from the executed
                    # command.
                    cmd_parts = sp[1].lower().split()
                    if any([x.endswith(".py") for x in cmd_parts]):
                        self.language = "Python"
                    elif any([x.endswith(".php") or x.endswith(".mod") for x in cmd_parts]):
                        self.language = "PHP"
                    elif any([x.endswith(".pl") or x.endswith(".pm") for x in cmd_parts]):
                        self.language = "Perl"
                    elif any([x.endswith(".js") for x in cmd_parts]):
                        self.language = "JavaScript"
                    elif any([x.endswith(".c") or x.endswith(".cc") for x in cmd_parts]):
                        self.language = "C++"
            elif found_events_header:
                lineno -= 1
                break
        if not found_events_header:
            raise InvalidProfileData("Could not locate an 'events:' section")
        return lineno

    def _parse_footers(self, lines, lineno):
        while lineno < len(lines):
            line = lines[lineno]
            lineno += 1
            if not line:
                continue
            sp = line.split(":", 1)
            if len(sp) == 2:
                self._headers.append(sp)
            else:
                lineno -= 1
                break
        return lineno

    _re_reference = re.compile(r"(\(\d+\))(\s+(.*))?")
    def _get_referenced_name(self, lookup_dict, name):
        """Deal with the compressed name format."""
        if name.startswith("("):
            # It's a reference.
            match = self._re_reference.match(name)
            if match:
                g = match.groups()
                if g[2] is not None:
                    name = g[2]
                    lookup_dict[g[0]] = g[2]
                else:
                    name = lookup_dict.get(g[0], None)
        return name

    def _parse_function_costs(self, lines, lineno):
        """There has to be at least one cost line, though there may be more.

        Examples:
            0 200 100
            0  8
            108 164
        """
        while lineno < len(lines):
            line = lines[lineno].strip()
            lineno += 1
            if not line:
                continue
            if line[0] not in string.digits:
                lineno -= 1
                break
            # Else, it's the data for cost line.
            cost_items = map(int, line.split())
            # Pad any missing cost items with 0
            cost_diff = len(self._cost_names) - len(cost_items)
            if cost_diff >= 0:
                cost_items += [0] * (cost_diff + 1)
            fn_line = cost_items[0]
            fn_costs = cost_items[1:]
            self._current_fn._addOwnCosts(fn_line, fn_costs)
        return lineno

    def _parse_callee_function_costs(self, line):
        """There has to be at least one cost line, though there may be more.

        Examples:
            0 200 100
            0  8
            108 164
        """
        # Else, it's the data for cost line.
        cost_items = map(int, line.split())
        # Pad any missing cost items with 0
        cost_diff = len(self._cost_names) - len(cost_items)
        if cost_diff >= 0:
            cost_items += [0] * (cost_diff + 1)
        fn_line = cost_items[0]
        fn_costs = cost_items[1:]
        self._current_fn._addCallee(self._current_callee_fn, fn_line, self._callee_call_count, fn_costs)

    def _get_function_object(self, filename, function_name, caller=None):
        cachekey = CallgrindFunction.generate_cachekey(filename, function_name)
        fn = self._fn_from_cache_key.get(cachekey)
        if fn is None:
            fn = CallgrindFunction(filename, function_name,
                                   primary_defn=caller is None)
            self._fn_from_cache_key[cachekey] = fn
        elif caller is None:
            # This is the primary definition of th function (not a call to it).
            fn.setAsPrimaryDefinition()
        return fn

    def _parse_data(self, lines, lineno):
        file_name = None
        while lineno < len(lines):
            line = lines[lineno].strip()
            lineno += 1
            if not line:
                continue
            sp = line.split("=", 1)
            if len(sp) == 2:
                item_type, item_data = [x.strip() for x in sp]

                if item_type == "fl":
                    # The name of the file where the cost of next cost lines
                    # happens.
                    self._current_callee_fn = None
                    self._current_filename = self._get_referenced_name(self._filename_refs, item_data)

                    if self._current_filename and not self.language and \
                       self._num_language_guess < 10:
                        # Guess the language from the filename.
                        self._num_language_guess += 1
                        langRegistrySvc = components.classes['@activestate.com/koLanguageRegistryService;1'].\
                                          getService(components.interfaces.koILanguageRegistryService)
                        self.language = langRegistrySvc.suggestLanguageForFile(self._current_filename)

                elif item_type == "fn":
                    # The name of the function where the cost of next cost lines
                    # happens.
                    self._current_callee_fn = None
                    self._current_fn_name = self._get_referenced_name(self._function_refs, item_data)

                elif item_type == "cfl":
                    # The source file including the code of the target of the
                    # next call cost lines.
                    assert(self._current_fn)
                    self._current_callee_filename = self._get_referenced_name(self._filename_refs, item_data)

                elif item_type == "cfn":
                    # The name of the target function of the next call cost
                    # lines.
                    assert(self._current_fn)
                    self._current_callee_fn_name = self._get_referenced_name(self._function_refs, item_data)

                elif item_type == "calls":
                    # The number of nonrecursive calls which are responsible for
                    # the cost specified by the next call cost line. This is the
                    # cost spent inside of the called function.
                    #
                    # After "calls=" there MUST be a cost line. This is the cost
                    # spent in the called function. The first number is the
                    # source line from where the call happened.
                    fn = self._get_function_object(self._current_callee_filename or self._current_filename,
                                                   self._current_callee_fn_name,
                                                   self._current_fn)
                    self._current_callee_fn = fn
                    #caller_line = None
                    try:
                        sp = map(int, item_data.split())
                        self._callee_call_count = sp[0]
                        #if len(sp) >= 2:
                        #    caller_line = sp[1]
                    except ValueError:
                        log.warn("Could not parse line: %r, %s#%d",
                                 line, self.name, lineno)

                # Ignoring these items.
                #elif item_type == "fe":
                #    # The source file including the code which is responsible
                #    # for the cost of next cost lines. "fi="/"fe=" is used when
                #    # the source file changes inside of a function, i.e. for
                #    # inlined code.
                #    pass
                #elif item_type == "fi":
                #    pass
                #elif item_type == "ob":
                #    # Elf object where next cost lines happened.
                #    pass
                #elif item_type == "cob":
                #    # Elf object where next call cost lines happened.
                #    pass
                #elif item_type == "jump":
                #    # jump=count target position [Callgrind]
                #    pass
                #elif item_type == "jcnd":
                #    # jcnd=exe.count jumpcount target position [Callgrind]
                #    pass

            elif line[0] in string.digits:
                # It's a cost line, either the function cost, or the callee
                # cost.
                if self._current_callee_fn is None:
                    fn = self._get_function_object(self._current_filename,
                                                   self._current_fn_name)
                    self._current_fn = fn
                    lineno = self._parse_function_costs(lines, lineno-1)
                else:
                    assert(self._current_callee_fn)
                    self._parse_callee_function_costs(line)

            elif ":" in line:
                lineno = self._parse_footers(lines, lineno)
        return lineno
                

    def _parse(self, data):
        """Parse the callgrind information."""

        lines = data.splitlines(0)
        i = self._parse_headers(lines, 0)
        i = self._parse_data(lines, i)

    def _process_values(self):
        """We have all the callgrind information, summarize it."""

        self.all_funcs = self._fn_from_cache_key.copy()

        import collections
        all_callers = collections.defaultdict(list)
        secondary_fns = []
        cgfunc_from_name = {}
        for cachekey, cgfunc in self._fn_from_cache_key.items():
            if not cgfunc.isPrimaryDefition:
                secondary_fns.append(cgfunc)
            else:
                cgfunc_from_name[cgfunc.name] = cgfunc
            for callee_data in cgfunc.callees:
                callee_cgfunc = callee_data[0]
                callers = all_callers[callee_cgfunc.cachekey]
                callers.append(cgfunc)
        
        for cachekey, cgfunc in self._fn_from_cache_key.items():
            callers_of_cgfunc = all_callers.get(cachekey)
            if not callers_of_cgfunc:
                self.top_funcs.append(cgfunc)

        # We've now got a list of who calls who, and also who got called by who.
        # Time to sum up the cost values.
        self._total_cost = 0
        for cgfunc in self.top_funcs:
            self._total_cost += cgfunc.own_cpu_time
            for callee_data in cgfunc.callees:
                self._total_cost += callee_data[3][0]

        self.all_callers = all_callers

    def load(self, name, data):
        self.name = name
        self.rawdata = data
        self.language = "" # Unknown yet.
        self.top_funcs = []
        self.all_funcs = {}
        self._clear_working_variables()
        self._parse(data)
        self._process_values()
        self._clear_working_variables()
        # We now have a list of all top-level functions and the total cost.

    def save(self, filepath):
        file(filepath, "wb").write(self.rawdata)

    def get_total_cpu_time(self):
        if not self.top_funcs:
            raise RuntimeError("No profile data is loaded")
        # Convert time to seconds
        return self._total_cost / koCallgrindProfilerItem.NS_IN_A_SECOND

    def getHierachicalItems(self):
        if not self.top_funcs:
            raise RuntimeError("No profile data is loaded")
        return [koCallgrindProfilerItem(self, x, 1, None) for x in self.top_funcs]

    def getAllItems(self):
        if not self.top_funcs:
            raise RuntimeError("No profile data is loaded")
        return sorted([koCallgrindProfilerItem(self, cgfunc, cgfunc.total_calls) for cgfunc in self.all_funcs.values()],
                      key=operator.attrgetter('own_cpu_time_ns'), reverse=True)

    def _walk(self, cgfunc, already_walked, depth=0, parent_cgfunc=None, factor=1, callee_data=None):
        spacer = " " * depth
        if callee_data is None:
            print "%s %8.3f %2d %s (%s:%d)" % (spacer, cgfunc.own_cpu_time, 1, cgfunc.name, cgfunc.path, cgfunc.line)
        else:
            print "%s %8.3f %2d %s (%s:%d)" % (spacer, callee_data[3][0], callee_data[2], cgfunc.name, cgfunc.path, cgfunc.line)
        already_walked[cgfunc] = 1
        for callee_data in sorted(cgfunc.callees, key=operator.itemgetter(0)):
            if callee_data[0] not in already_walked:
                self._walk(callee_data[0], already_walked, depth+1, cgfunc, callee_data=callee_data)

    def walk(self):
        already_walked = {}
        for func in sorted(self.top_funcs, key=operator.attrgetter("name")):
            self._walk(func, already_walked)

    def dump(self):
        print "Profile info"
        print "total_tt: %.3f CPU seconds" % (self._total_cost, )
        print 'len(self.getHierachicalItems()): %r' % (len(self.getHierachicalItems()), )



class koProfilerService:
    _reg_clsid_ = "{d9e4c237-0751-4b2c-aea5-13859845f4a5}"
    _com_interfaces_ = [components.interfaces.koIProfilerService]
    _reg_contractid_ = "@activestate.com/koProfilerService;1"
    _reg_desc_ = "Komodo profiler service"

    def loadFromFile(self, fileuri):
        # Load from the given filepath.
        koFileEx = components.classes["@activestate.com/koFileEx;1"] \
                    .createInstance(components.interfaces.koIFileEx)
        koFileEx.URI = fileuri
        koFileEx.open('rb')
        try:
            contents = koFileEx.read(-1)
            return self.loadFromString(koFileEx.baseName, contents)
        finally:
            koFileEx.close()
        raise InvalidProfileData("Could not load profile data at: %r", fileuri)

    def loadFromString(self, name, data):
        # Determine the file format and assign to the correct profile data
        # class.
        profdata = None
        first_line = data[:20].strip()
        first_block = data[:2000].strip()
        if ":" in first_line and first_line[0].lower() in string.ascii_lowercase or \
           "version:" in first_block:
            # Looks kinda like a callgrind format.
            profdata = koCallgrindProfiler()
            profdata.load(name, data)
        else:
            # Try the Python format.
            profdata = koPythonProfiler()
            profdata.load(name, data)
        return profdata

    def loadFromBase64String(self, name, b64data):
        import base64
        data = base64.b64decode(b64data)
        return self.loadFromString(name, data)

    def _load_asynchronously(self, fn, args, callback):
        # Remeber the thread who called us.
        threadMgr = components.classes["@mozilla.org/thread-manager;1"]\
                        .getService(components.interfaces.nsIThreadManager)
        starting_thread = threadMgr.currentThread

        # The function run by the thread, passing results to the callback.
        def LoadProfileDataThread():
            prof = None
            result = components.interfaces.koIAsyncCallback.RESULT_ERROR
            try:
                prof = fn(*args)
                result = components.interfaces.koIAsyncCallback.RESULT_SUCCESSFUL
            except Exception, ex:
                log.warn("LoadProfileDataThread fn %r failed: %r", fn, str(ex))

            class CallbackRunnable(object):
                """Used to fire callback on the original thread."""
                _com_interfaces_ = [components.interfaces.nsIRunnable]
                def __init__(self, handler, args):
                    self.handler = handler
                    self.args = args
                def run(self, *args):
                    self.handler.callback(*self.args)
                    # Null out values.
                    self.handler = None
                    self.args = None
            runnable = CallbackRunnable(callback, (result, prof))
            try:
                starting_thread.dispatch(runnable, components.interfaces.nsIThread.DISPATCH_SYNC)
            except Exception, e:
                log.warn("LoadProfileDataThread: callback failed: %s", str(e))

        # Start the thread.
        t = threading.Thread(target=LoadProfileDataThread,
                             name="koProfiler data loader")
        t.setDaemon(True)
        t.start()

    def loadFromFileAsync(self, fileuri, callback):
        self._load_asynchronously(self.loadFromFile, (fileuri, ), callback)
    def loadFromStringAsync(self, name, data, callback):
        self._load_asynchronously(self.loadFromString, (name, data), callback)
    def loadFromBase64StringAsync(self, name, b64data, callback):
        self._load_asynchronously(self.loadFromBase64String, (name, b64data), callback)

if __name__ == '__main__':
    import sys
    svc = koProfilerService()
    if len(sys.argv) >= 2:
        p = svc.loadFromFile(sys.argv[1])
    else:
        #p = svc.loadFromFile("/home/toddw/tmp/python/profiling/koprofile.dump")
        #p = svc.loadFromFile("/srv/xdebug/profiles/cachegrind.out.23089")
        #p = svc.loadFromFile("/home/toddw/as/komodo-devel/src/profiler/cachegrind_simple.out")
        p = svc.loadFromFile("/home/toddw/as/komodo-devel/src/profiler/cachegrind.out")
        #p = svc.loadFromFile("/srv/xdebug/profiles/cachegrind.out.23089")
    p.dump()
    p.walk()
