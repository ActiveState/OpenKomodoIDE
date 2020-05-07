[![*nix build status][nix-build-image]][nix-build-url]
[![Windows build status][win-build-image]][win-build-url]
[![Tests coverage][cov-image]][cov-url]
![Transpilation status][transpilation-image]
[![npm version][npm-image]][npm-url]

# sprintf-kit

## sprintf parser and basic formatter

- Full [printf format parser](#parser)
- Basic (ECMAScript level) modifier [resolvers](#preconfigured-modifiers)
- Format function [generator](#format-function-generator).

### Installation

```bash
npm install sprintf-kit
```

### Utilities

#### Parser

Parses format string into data map with respect to [printf syntax](https://en.wikipedia.org/wiki/Printf_format_string)

```javascript
const parse = require("sprintf-kit/parse");

const data = parse("Some %s with %d count");

// `data` resolves with following content:
{
  literals: ["Some ", " with ", " count"],
  placeholders: [
    { type: "s", content: "%s" },
    { type: "d", content: "%d" }
  ],
  isParameterIndexingValid: true
}
```

`data` spec:

- `literals` - Surrounding string literals
- `placeholders` - Meta data of parsed placholders.
  Placeholder properties map (refer to [spec](https://en.wikipedia.org/wiki/Printf_format_string) for explanation of each property)
  - `parameter` - (optional) parameter setting (e.g. `1`)
  - `flags` - (optional) array of flags (e.g. `["0", "-"]`)
  - `width` - (optional) width (e.g. `4` or `"*"` if dynamic)
  - `precision` - (optional) precision (e.g. `4` or `"*"` if dynamic)
  - `length` - (optional) length (e.g. `"z"`)
  - `type` - Modifier type (e.g. `"s"` or `"d"`)
  - `content` - Full string representation of placeholder (e.g. `"%s"`)
- `isParameterIndexingValid` - Whether parameter indexing is valid across all placeholders.
  e.g. if no placeholders come with parameters it'll be true. If some but not all of them will come with parameters, it'll be false (if used, then all placeholders should use them).

#### Format function generator

```javascript
// Configure format function that resolves 's' and 'd' modifiers
let format = require("sprintf-kit")({
  d: require("sprintf-kit/modifiers/d"),
  s: require("sprintf-kit/modifiers/s")
});

format("Some %s with %d count %x boo", "foo", 12, "ignored"); // Some foo with 12 count %x boo

// Special `rest` formater can be used to handle leftover arguments

format = require("sprintf-kit")({
  d: require("sprintf-kit/modifiers/d"),
  s: require("sprintf-kit/modifiers/s"),
  rest: args => " " + args.join(" ")
});

format("Some %s with %d count", "foo", 12, "rest", "args"); // Some foo with 12 count rest args

// Message string literals (all but placeholders text) can be additionally decorated
// Useful when we want to apply some specific color to message without affecting format of special arguments

const clc = require("cli-color");

format = require("sprintf-kit")({
  d: require("sprintf-kit/modifiers/d"),
  s: require("sprintf-kit/modifiers/s"),
  literal: literal => clc.red(literal)
});
```

#### Parts resolver generator

Resolver returns resolved data in form of object parts, which maybe helpful if additional programmatical processing is needed

```javascript
// Configure format function that resolves 's' and 'd' modifiers
let resolve = require("sprintf-kit/get-resolver")({
  d: require("sprintf-kit/modifiers/d"),
  s: require("sprintf-kit/modifiers/s")
});

resolve("Some %s with %d count %x boo", "foo", 12, "ignored");
// {
//   literals: ["Some ", " with ", " count ", " boo"],
//   substitutions: [
//     { value: "foo", placeholder: { type: "s", content: "%s" } },
//     { value: "12", placeholder:  { type: "d", content: "%d" } },
//     { value: "%x", placeholder: { type: "x", content: "%x" }
//   ],
//   rest: null
// }

resolve = require("sprintf-kit/get-resolver")({
  d: require("sprintf-kit/modifiers/d"),
  s: require("sprintf-kit/modifiers/s"),
  rest: args => " " + args.join(" ")
});

resolve("Some %s with %d count", "foo", 12, "rest", "args");
// {
//   literals: ["Some ", " with ", " count"],
//   substitutions: [
//     { value: "foo", placeholder: { type: "s", content: "%s" } },
//     { value: "12", placeholder:  { type: "d", content: "%d" } }
//   ],
//   rest: " rest args"
// }
```

#### Preconfigured modifiers

Currently just basic modifiers are configured in (PR's welcome to extend this support).

Modifiers can be found at `sprintf-kit/modifiers` folder.

Preconfigured modifiers

- `d` - Number
- `f` - Floating point value
- `i` - Integer
- `j` - JSON
- `s` - String

Every modifier is exception safe, in case of approaching invalid value, adequate error message token is displayed in place of placeholder

### Tests

```bash
npm test
```

Project cross-browser compatibility supported by:

<a href="https://browserstack.com"><img src="https://bstacksupport.zendesk.com/attachments/token/Pj5uf2x5GU9BvWErqAr51Jh2R/?name=browserstack-logo-600x315.png" height="150" /></a>

[nix-build-image]: https://semaphoreci.com/api/v1/medikoo-org/sprintf-kit/branches/master/shields_badge.svg
[nix-build-url]: https://semaphoreci.com/medikoo-org/sprintf-kit
[win-build-image]: https://ci.appveyor.com/api/projects/status/o3dnowm0ftn21u61?svg=true
[win-build-url]: https://ci.appveyor.com/api/projects/status/o3dnowm0ftn21u61
[cov-image]: https://img.shields.io/codecov/c/github/medikoo/sprintf-kit.svg
[cov-url]: https://codecov.io/gh/medikoo/sprintf-kit
[transpilation-image]: https://img.shields.io/badge/transpilation-free-brightgreen.svg
[npm-image]: https://img.shields.io/npm/v/sprintf-kit.svg
[npm-url]: https://www.npmjs.com/package/sprintf-kit
