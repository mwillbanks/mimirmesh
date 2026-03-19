# Library Preference

Agents must prefer battle-tested libraries and platform primitives over handwritten implementations.

Reimplementing solved problems increases bugs and maintenance cost.

Default policy: reuse existing capabilities before writing new utility code.

## Prefer Platform APIs

Examples:

Currency formatting

```
Intl.NumberFormat
```

Date formatting

```
Intl.DateTimeFormat
```

URL handling

```
URL
URLSearchParams
```

Array operations

```
Array.prototype.map
Array.prototype.filter
Array.prototype.reduce
```

Avoid reimplementing behavior that the platform already provides.

## Mandatory Reuse Search Order

Before implementing utility behavior, check in this order:

* platform API
* framework capability
* existing repository utility
* already-installed dependency
* new code only if all prior options fail

Skipping this order is non-compliant.

## Prefer Existing Project Libraries

Before adding new logic, search the repository for:

* shared utilities
* validation libraries
* formatting helpers
* query utilities
* framework extensions

Reuse these instead of creating new ones.

## Avoid Reinventing Algorithms

Do not reimplement well-known algorithms or utilities such as:

* sorting
* searching
* parsing
* validation
* serialization
* formatting

Use proven implementations instead.

Do not add custom implementations simply to avoid reading existing docs.

## Library Selection Guidance

When introducing a dependency:

* prefer well-maintained libraries
* avoid extremely small single-purpose dependencies
* prefer libraries already used within the repository
* ensure the library solves a real problem not easily solved by the platform

## Dependency Admission Rules

A new dependency is allowed only if all are true:

* no existing dependency already provides the capability
* platform/framework options are insufficient
* maintenance and security risk are acceptable
* dependency adds meaningful value beyond a small local implementation

If these are not true, do not add the dependency.