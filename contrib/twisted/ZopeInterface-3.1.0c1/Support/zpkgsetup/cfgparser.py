##############################################################################
#
# Copyright (c) 2004 Zope Corporation and Contributors.
# All Rights Reserved.
#
# This software is subject to the provisions of the Zope Public License,
# Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
# WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
# FOR A PARTICULAR PURPOSE.
#
##############################################################################
"""Configuration parsing based on ZConfig instead of the bastard parser.

"""
__docformat__ = "reStructuredText"

import os
import sys

import ZConfig.cfgparser
import ZConfig.cmdline
import ZConfig.datatypes
import ZConfig.loader

from ZConfig import ConfigurationError


# This is new:

def cachedSchemaLoader(filename="schema.xml", package=None,
                       loader_factory=None):
    if package is None:
        frame = sys._getframe(1)
        __path__ = _get_path_from_frame(frame)
    elif package == "":
        __path__ = sys.path
    else:
        __import__(package)
        __path__ = sys.modules[package].__path__

    if loader_factory is None:
        loader_factory = SchemaLoader
    cache = []
    def loadSchemaCache():
        if cache:
            return cache[0]
        for p in __path__:
            path = os.path.join(p, filename)
            if os.path.isfile(path):
                schema = loader_factory().loadURL(path)
                cache.append(schema)
                return schema
        raise ValueError("could not locate schema %r for package %r (path=%r)"
                         % (filename, package, __path__))

    return loadSchemaCache

def _get_path_from_frame(frame):
    globs = frame.f_globals
    if "__path__" in globs:
        return globs["__path__"]
    path = globs.get("__file__")
    module = globs.get("__name__")
    if (path and module):
        dir, fn = os.path.split(path)
        fnbase, ext = os.path.splitext(fn)
        if "." in module and fnbase == "__init__":
            package = module[:module.rindex(".")]
            return sys.modules[package].__path__
    if "." in module:
        # the module is likely still being imported for the first
        # time; just drop the module name and check the package
        package = module[:module.rindex(".")]
        return sys.modules[package].__path__
    return sys.path




def loadConfig(schema, url, overrides=()):
    return _get_config_loader(schema, overrides).loadURL(url)

def loadConfigFile(schema, file, url=None, overrides=()):
    return _get_config_loader(schema, overrides).loadFile(file, url)


def _get_config_loader(schema, overrides):
    if overrides:
        loader = ExtendedConfigLoader(schema)
        for opt in overrides:
            loader.addOption(opt)
    else:
        loader = ConfigLoader(schema)
    return loader


# These classes override enough to get case-sensitive behavior by default; 

class Parser(ZConfig.cfgparser.ZConfigParser):
    """ZConfig-parser that doesn't lower-case section types and names."""

    def _normalize_case(self, string):
        return string


class BasicKeyConversion(ZConfig.datatypes.BasicKeyConversion):
    """Alternate basic-key type that does no case-normalizing."""

    def __call__(self, value):
        value = str(value)
        return ZConfig.datatypes.RegularExpressionConversion.__call__(
            self, value)


def SchemaLoader(registry=None):
    if registry is None:
        registry = ZConfig.datatypes.Registry()
        registry._stock["basic-key"] = BasicKeyConversion()
    return ZConfig.loader.SchemaLoader(registry)


class ConfigLoaderMixin:

    def _parse_resource(self, matcher, resource, defines=None):
        parser = Parser(resource, self, defines)
        parser.parse(matcher)


class ConfigLoader(ConfigLoaderMixin, ZConfig.loader.ConfigLoader):
    pass


class ExtendedConfigLoader(ConfigLoaderMixin,
                           ZConfig.cmdline.ExtendedConfigLoader):

    def cook(self):
        if self.clopts:
            return OptionBag(self.schema, self.schema, self.clopts)
        else:
            return None


class OptionBag(ZConfig.cmdline.OptionBag):

    def _normalize_case(self, string):
        return string
