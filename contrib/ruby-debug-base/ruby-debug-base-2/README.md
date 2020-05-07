## Description
A fork of ruby-debug(19) that works on 1.9.2 and 1.9.3 and installs easily for rvm/rbenv rubies.

[![Build Status](https://travis-ci.org/cldwalker/debugger.png?branch=master)](https://travis-ci.org/cldwalker/debugger)

## Install

    $ gem install debugger

    # If install fails, try passing headers path
    $ gem install debugger -- --with-ruby-include=PATH_TO_HEADERS

For Windows install instructions, see OLD\_README.


## Supported Rubies
On install, debugger tries to find your ruby's headers. If it's unable to find them and your ruby is
a patch release, it will use headers included with
[debugger-ruby_core_source](https://github.com/cldwalker/debugger-ruby_core_source).  For the list
of rubies supported by debugger [see
here](https://github.com/cldwalker/debugger-ruby_core_source/tree/master/lib/debugger/ruby_core_source).
*If your ruby is not an official patch release i.e. head, dev or an rc, you are responsible for
having headers and setting them with --with-ruby-include.*

## Usage

Wherever you need a debugger, simply:

```ruby
require 'debugger'; debugger
```

To use with bundler, drop in your Gemfile:

    gem 'debugger'

### Configuration

At initialization time, debugger loads config files, executing their lines
as if they were actual commands a user has typed. config files are loaded
from two locations:

* ~/.rdebugrc (~/rdebug.ini for windows)
* $PWD/.rdebugrc ($PWD/rdebug.ini for windows)

Here's a common configuration (yeah, I should make this the default):

    set autolist
    set autoeval
    set autoreload

To see debugger's current settings, use the `set` command.

### Using Commands

For a list of commands:

    (rdb: 1) help

Most commands are described in rdebug's man page

    $ gem install gem-man
    $ man rdebug

### More documentation

Some thorough documentation of debugger is found with [this bashdb
tutorial](http://bashdb.sourceforge.net/ruby-debug.html). For emacs and debugger
usage, see [another bashdb
tutorial](http://bashdb.sourceforge.net/ruby-debug/rdebug-emacs.html)

## Reason for Fork

* ruby-debug19 maintainer isn't maintaining:
  * Despite patches from ruby core, no gem release in 2+ years! - 9/1/09.
  * Requests to release a known working 1.9.3 version have been ignored.
  * Doesn't respond to rubyforge issues and doesn't have github issues open.
* Current install is painful. Requires either [manually downloading gems from rubyforge](
  http://blog.wyeworks.com/2011/11/1/ruby-1-9-3-and-ruby-debug) and installing with compiler flags
  or [recompiling
  ruby](http://blog.sj26.com/post/12146951658/updated-using-ruby-debug-on-ruby-1-9-3-p0).
* We need a decent ruby debugger for future rubies!

## What's different from ruby-debug19

* Major
  * Works on 1.9.2 and 1.9.3
    * 1.9.2 points to ruby-debug-base19-0.11.25 headers
    * 1.9.3 points to ruby-debug-base19-0.11.26 headers
  * Install painlessly for rvm and rbenv rubies i.e. no compiler flags needed
  * No downloading ruby source during install - was behavior of old ruby_core_source dependency
  * Add output adapters, Printers, to support output besides plain text e.g. xml
  * A new and improved test suite
  * Passing tests are up on travis-ci
  * Fix several bugs
    * Fix LocalJumpError caused by using proc in extconf.rb
    * Fix where command failing at top level
    * See changelog for more
* Minor
  * The gem name matches the module namespace, Debugger, and main required file, debugger.
  * ruby-debug-base19 and ruby-debug19 are released as one gem
  * Rake tasks have been updated
  * No more $LOAD_PATH manipulation or runtime code outside of lib
  * man page available via gem-man
  * Test helpers for third-party debugger libraries can be accessed from debugger/test. See debugger-xml for an example

## Issues
Please report them [on github](http://github.com/cldwalker/debugger/issues).

## Known Issues
* 2.0.0 support is only partially working and the test suite dies before it can finish.
* If you place a debugger call at the end of a block, debugging will start at the next step and
  outside of your block. A simple work-around is to place a meaningless step (i.e. puts "STAY")
  at the end of your block and before debugger.

## Contributing
[See here](http://tagaholic.me/contributing.html) for contribution policies.
Let's keep this working for the ruby community!

## Related projects

* [debugger-completion](https://github.com/cldwalker/debugger-completion) - autocompletion for
  debugger commands and more
* [debugger-xml](https://github.com/astashov/debugger-xml) - XML interface for debugger, compatible
  with ruby-debug-ide
* [vim-ruby-debugger] - Vim plugin that uses debugger
* [debugger-pry](https://github.com/pry/debugger-pry) - using pry within debugger
* [pry-debugger](https://github.com/nixme/pry-debugger) - using debugger within pry
* [ruby-debug-passenger](https://github.com/davejamesmiller/ruby-debug-passenger) - rake task to
  restart Passenger with debugger connected
* [jruby-debug](https://github.com/jruby/jruby-debug)
* [rb-trepanning](https://github.com/rocky/rb-trepanning) - rewrite of ruby-debug that requires a
  patched ruby

## Credits

* Thanks to the original authors: Kent Sibilev and Mark Moseley
* Thanks to astashov for bringing in a new and improved test suite, adding printers support and various bug fixes.
* Thanks to windwiny for porting to 2.0.0
* Contributors: ericpromislow, jnimety, adammck, hipe, FooBarWidget, aghull
* Fork started on awesome @relevance fridays!

## TODO

* Fix test/test-*.rb
* Port some of bashdb's docs
* Use ~/.debuggerrc and bin/debugger and gracefully deprecate rdebug*
* Work with others willing to tackle jruby, rubinius or windows support
