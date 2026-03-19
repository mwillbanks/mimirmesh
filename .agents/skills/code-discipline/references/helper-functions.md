# Helper Function Discipline

Helper functions are a frequent source of lazy over-abstraction. Most helper additions should be rejected unless they demonstrably reduce complexity or enforce correctness.

When in doubt, do not create the helper.

## When NOT to Create a Helper

Do not create helpers when the logic:

* is used once
* is trivial
* wraps a platform primitive
* duplicates an existing utility
* only renames existing functionality

Reject helpers that are introduced only to "clean up" one line of code.

Examples of bad helpers:

```
toString(value)
toNumber(value)
toBoolean(value)

formatName(first, last)
normalizeArray(value)
safeParse(value)
```

These helpers create noise and unnecessary indirection.

## Mandatory Helper Admission Gate

Create a new helper only when at least one is true:

* reused in multiple call sites
* encapsulates non-trivial logic
* enforces domain rules or invariants
* centralizes validation, security, or correctness behavior
* prevents repeated bug-prone implementation details

If none are true, helper creation is non-compliant.

## When a Helper IS Appropriate

Create a helper only when:

* logic appears in multiple locations
* logic is domain-specific
* logic enforces validation or safety
* logic centralizes behavior that must remain consistent
* logic significantly reduces repeated complexity

Examples of valid helpers:

```
calculatePortfolioValue()
buildTenantScopedQuery()
validateEquityGrant()
normalizeShareQuantity()
```

These represent domain behavior, not generic transformations.

## Placement Rules

Helpers must live in the correct layer.

Rules:

* domain helpers → domain modules
* shared utilities → shared utility package
* component helpers → only if truly component-specific
* avoid placing helpers directly inside component files

If logic is reused across packages, promote it to a shared utility package.

Do not place helpers in arbitrary folders for convenience.

## Helper Naming

Names must represent domain intent, not generic transformations.

Bad naming:

```
formatData
normalizeValue
processInput
handleValue
```

Preferred naming:

```
calculateGrantBalance
buildTradingPlanSummary
parseTenantConfig
validateShareTransfer
```

The name should communicate **business meaning**, not implementation details.

## Review Checklist

Before accepting a helper, verify:

* helper admission gate is satisfied
* no existing utility already solves the same problem
* helper name represents domain intent
* helper location matches architecture boundaries
* helper reduces real complexity instead of adding indirection