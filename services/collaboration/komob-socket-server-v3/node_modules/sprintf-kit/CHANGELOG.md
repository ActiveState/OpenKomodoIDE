# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="2.0.0"></a>
# [2.0.0](https://github.com/medikoo/sprintf-kit/compare/v1.5.0...v2.0.0) (2018-10-02)


### Features

* for simplicity represent `flags` as string ([299ffa3](https://github.com/medikoo/sprintf-kit/commit/299ffa3))
* in parts expose substitutions values with meta data ([c06a929](https://github.com/medikoo/sprintf-kit/commit/c06a929))
* rename getResolver into getPartsResolver ([6270025](https://github.com/medikoo/sprintf-kit/commit/6270025))
* seclude formatParts util ([3b40e25](https://github.com/medikoo/sprintf-kit/commit/3b40e25))
* support literal modifier resolution within resolver ([8f5353e](https://github.com/medikoo/sprintf-kit/commit/8f5353e))


### BREAKING CHANGES

* parts.substitutions instead of array of
substitution values now exposes array of
meta data where substitutionMeta.value
 exposes substitution value, and substitutionMeta.placeholder exposes
placeholder meta data
* Parse exposes `flags` now as string and not array, so e.g. `["+", " "]`
is now exposed as "+ "
* get-resolver.js module is renamed to get-parts-resolver.js



<a name="1.5.0"></a>
# [1.5.0](https://github.com/medikoo/sprintf-kit/compare/v1.4.0...v1.5.0) (2018-09-28)


### Features

*  getResolver utility ([516656c](https://github.com/medikoo/sprintf-kit/commit/516656c))



<a name="1.4.0"></a>
# [1.4.0](https://github.com/medikoo/sprintf-kit/compare/v1.3.0...v1.4.0) (2018-08-03)


### Features

* support literal decorator ([305278c](https://github.com/medikoo/sprintf-kit/commit/305278c))



<a name="1.3.0"></a>
# [1.3.0](https://github.com/medikoo/sprintf-kit/compare/v1.2.1...v1.3.0) (2018-06-05)


### Bug Fixes

* fix handling of non JSON serializable values ([12543a4](https://github.com/medikoo/sprintf-kit/commit/12543a4))


### Features

* more consise invalid value tokens ([ad92ddd](https://github.com/medikoo/sprintf-kit/commit/ad92ddd))



<a name="1.2.1"></a>
## [1.2.1](https://github.com/medikoo/sprintf-kit/compare/v1.2.0...v1.2.1) (2018-06-01)


### Bug Fixes

* improve error messages readability ([af86a9a](https://github.com/medikoo/sprintf-kit/commit/af86a9a))



<a name="1.2.0"></a>
# [1.2.0](https://github.com/medikoo/sprintf-kit/compare/v1.1.0...v1.2.0) (2018-06-01)


### Features

* allow skipping format string argument ([adc537c](https://github.com/medikoo/sprintf-kit/commit/adc537c))



<a name="1.1.0"></a>
# [1.1.0](https://github.com/medikoo/sprintf-kit/compare/v1.0.0...v1.1.0) (2018-05-30)


### Bug Fixes

* signature ([a2d4e62](https://github.com/medikoo/sprintf-kit/commit/a2d4e62))


### Features

* improve patch message ([4294359](https://github.com/medikoo/sprintf-kit/commit/4294359))
* improve patch strings format ([d4c56e5](https://github.com/medikoo/sprintf-kit/commit/d4c56e5))



<a name="1.0.0"></a>
# 1.0.0 (2018-04-09)
