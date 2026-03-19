# Component Logic Discipline

UI components should remain focused on rendering and interaction logic.

Agents must avoid turning components into dumping grounds for helpers and utilities.

Default policy: keep simple logic local; extract only when complexity or reuse clearly demands it.

## Inline Logic Preference

If a transformation is simple and used once, keep it inline.

Example:

```
const fullName = `${user.firstName} ${user.lastName}`
```

Extracting this into a helper reduces readability.

Do not extract for aesthetics alone.

## Avoid Component Helper Sprawl

Bad pattern:

```
function formatName(user) { ... }
function normalizePrice(value) { ... }
function buildDisplayLabel(item) { ... }
```

Component files should not contain multiple small helpers.

If logic becomes complex or reusable, move it to a proper utility module.

If a component has more than one local helper, treat it as a refactor warning.

## Acceptable Component Logic

Components may contain:

* derived state calculations
* simple transformations
* conditional rendering logic
* UI event handlers

Examples:

```
const isOutOfStock = item.inventory === 0
const displayPrice = price ?? "N/A"
```

These do not require helpers.

## Extract Only When Needed

Move logic out of a component when:

* the logic becomes complex
* it is reused in multiple components
* it represents domain behavior rather than UI behavior

At that point it belongs in:

* a domain module
* a shared utility
* a service or business logic layer

## Extraction Gate

Extract component logic only if at least one is true:

* repeated across components
* difficult to understand inline
* requires dedicated tests outside the component
* represents domain behavior rather than presentation behavior

If none are true, keep logic inline.