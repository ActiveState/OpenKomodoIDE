# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

# [6.0.0](https://github.com/medikoo/log/compare/v5.1.0...v6.0.0) (2019-04-10)

### Features

-   rename lib/writer to lib/abstract-writer ([60388cb](https://github.com/medikoo/log/commit/60388cb))
-   replace registerMaster with getMasterWriter ([432b73e](https://github.com/medikoo/log/commit/432b73e))

### BREAKING CHANGES

-   lib/register-master was removed in favor of
    lib/get-master-writer
    Writer should be registered using 'register' function
    as returned by get-master-writer
-   Writer base class was moved from lib/writer to lib/abstract-writer

# [5.1.0](https://github.com/medikoo/log/compare/v5.0.0...v5.1.0) (2019-04-08)

### Features

-   lib/writer ([7cd4bf1](https://github.com/medikoo/log/commit/7cd4bf1))

# [5.0.0](https://github.com/medikoo/log/compare/v4.0.1...v5.0.0) (2019-03-19)

### Features

-   reverse levels order ([d13c91e](https://github.com/medikoo/log/commit/d13c91e)), closes [#12](https://github.com/medikoo/log/issues/12)

### BREAKING CHANGES

-   Level indexes were reversed to match RFC 5424.
    Now `error` level has `0` index , and `debug` `4`

## [4.0.1](https://github.com/medikoo/log/compare/v4.0.0...v4.0.1) (2019-03-18)

# [4.0.0](https://github.com/medikoo/log/compare/v3.2.0...v4.0.0) (2019-03-18)

### Code Refactoring

-   move writer-utils to lib ([429aec5](https://github.com/medikoo/log/commit/429aec5))

### Features

-   LOG_TIME recommendation and utils ([6af9400](https://github.com/medikoo/log/commit/6af9400)), closes [#9](https://github.com/medikoo/log/issues/9)
-   make 'info' level default ([4a1fa53](https://github.com/medikoo/log/commit/4a1fa53))
-   not applicable syslog levels ([57c879a](https://github.com/medikoo/log/commit/57c879a))
-   upgrade linter ([eba6bb4](https://github.com/medikoo/log/commit/eba6bb4))

### BREAKING CHANGES

-   'critical', 'alert' and 'emergency' levels were dropped as seem to
    not serve a use case in context of JS apps
-   Default level was changed from 'debug' to 'info'
-   Or writer-utils were moved to lib

<a name="3.2.0"></a>

# [3.2.0](https://github.com/medikoo/log/compare/v3.1.0...v3.2.0) (2018-11-29)

### Features

-   rename log4 to log ([84cd31a](https://github.com/medikoo/log/commit/84cd31a))

<a name="3.1.0"></a>

# [3.1.0](https://github.com/medikoo/log4/compare/v3.0.1...v3.1.0) (2018-09-21)

### Features

-   support default namespace concept ([3c99624](https://github.com/medikoo/log4/commit/3c99624))
-   validate namespace token when setting as default ([62862c1](https://github.com/medikoo/log4/commit/62862c1))

<a name="3.0.1"></a>

## [3.0.1](https://github.com/medikoo/log4/compare/v3.0.0...v3.0.1) (2018-06-01)

### Bug Fixes

-   put default level threshold to notice ([e994285](https://github.com/medikoo/log4/commit/e994285))

<a name="3.0.0"></a>

# [3.0.0](https://github.com/medikoo/log4/compare/v2.0.0...v3.0.0) (2018-06-01)

### BREAKING CHANGES

-   Predefined levels are no longer accessible at `logger.predefinedLevels` property.
    Instead they should be required from `log4/levels`
-   For simplicity and to avoid compliance issues,
    only predefined levels are allowed (it's no
    longer possible to create custom named levels)
-   `enable()` and `disable()` methods no logger return own logger.
    Instead they return plain object with `restore` function, that allows to restore to previous state
-   `getNs` method has been renamed to
    `get`
-   `ns` property has been renamed to
    `namespace`
-   `nsTokens` property has been renamed to
    `namespaceTokens`
-   Emitter is not longer accessible at logger.emiter
    Instead it should be required from `log4/emitter`
-   `getAllLevels` method has been renamed to
    `getAllInitializedLevels`
-   `hasLevel` method has been renamed to
    `isLevelInitialized`
-   `hasNs` method has been renamed to
    `isNamespaceInitialized`
-   New setupVisibility accepts:

    -   `levelThreshold` - on its basis it's decided logs for which levels are
        enabled by default

    -   `debugNamespaceToken` - List of namespaces to be exposed for
        levels below threshold

-   `getLevel` method was removed. Use direct property names:
    `log.error` instead of `log.getLevel("error")`
-   `getAllNs` method has been renamed to
    `getAllInitializedNamespaces`

### Features

-   Default symbols to represent levels ([dc2487b](https://github.com/medikoo/log4/commit/dc2487b))
-   Expose levelIndex on level ([aa480ee](https://github.com/medikoo/log4/commit/aa480ee))
-   Introduce `logger.levelRoot` property ([d1b61c1](https://github.com/medikoo/log4/commit/d1b61c1))
-   `isLogger` and `ensureLogger` utils ([30d7ab6](https://github.com/medikoo/log4/commit/30d7ab6))
-   `registerMaster` log writer util ([7a36ad8](https://github.com/medikoo/log4/commit/7a36ad8))

<a name="2.0.0"></a>

# [2.0.0](https://github.com/medikoo/log4/compare/v1.2.0...v2.0.0) (2018-03-22)

### Features

-   remove date from log event ([7f2903a](https://github.com/medikoo/log4/commit/7f2903a))
-   remove node env handler ([20450ad](https://github.com/medikoo/log4/commit/20450ad))
-   remove obsolete event emit ([9499b37](https://github.com/medikoo/log4/commit/9499b37))

*   feat: emit events also if logger disabled ([6eb338d](https://github.com/medikoo/log4/commit/6eb338d))

### BREAKING CHANGES

-   logs for disabled loggers will also be emitted.
    Handler should check `logger.enabled` to confirm on whether
    intetion is to have log visible
-   remove 'event.date` property
-   log:before event was removed
-   Node env handler was moved to outer package,
    it'll have to be initialized as:

require('log4-node')

<a name="1.2.0"></a>

# [1.2.0](https://github.com/medikoo/log4/compare/v1.1.0...v1.2.0) (2017-09-22)

### Features

-   allow direct setting of isEnabled ([1245e21](https://github.com/medikoo/log4/commit/1245e21))
-   **filter:** support nested catch all ([93f390c](https://github.com/medikoo/log4/commit/93f390c))

<a name="1.1.0"></a>

# [1.1.0](https://github.com/medikoo/log4/compare/v1.0.0...v1.1.0) (2017-09-07)

### Features

-   expose 'warn' alias as predefined property ([e8bf927](https://github.com/medikoo/log4/commit/e8bf927))

<a name="1.0.0"></a>

# 1.0.0 (2017-09-07)

### Bug Fixes

-   take back exposure of nsChildren ([1784c1a](https://github.com/medikoo/log4/commit/1784c1a))

### Features

-   do not force sort on getAllLevels ([8489362](https://github.com/medikoo/log4/commit/8489362))
-   ensure emitted messageTokens are array ([28bea04](https://github.com/medikoo/log4/commit/28bea04))
-   ensure enable/disable return target logger ([76228c0](https://github.com/medikoo/log4/commit/76228c0))
-   expose array of predefined levels ([354db58](https://github.com/medikoo/log4/commit/354db58))
-   expose levels at named properties ([91ab1c4](https://github.com/medikoo/log4/commit/91ab1c4))
-   getLevels method ([8f36cfe](https://github.com/medikoo/log4/commit/8f36cfe))
-   introduce getAllNs method ([e7eabee](https://github.com/medikoo/log4/commit/e7eabee))
-   introduce hasLevel and hasNs ([2887a80](https://github.com/medikoo/log4/commit/2887a80))
-   make \_children public as nsChildren ([0729be7](https://github.com/medikoo/log4/commit/0729be7))
-   node.js env logger ([2582afe](https://github.com/medikoo/log4/commit/2582afe))
-   predefined log levels ([ad23c30](https://github.com/medikoo/log4/commit/ad23c30))
-   replace getLevels with getAllLevels ([03478fc](https://github.com/medikoo/log4/commit/03478fc))
-   setupEnv functionality ([a873045](https://github.com/medikoo/log4/commit/a873045))
-   tolerate whitespace noise in visibility conf ([14953be](https://github.com/medikoo/log4/commit/14953be))
