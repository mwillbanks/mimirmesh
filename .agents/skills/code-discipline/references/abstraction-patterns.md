# Abstraction Discipline

Abstractions are useful when they encapsulate complexity or enforce architectural boundaries. They are harmful when they only add indirection.

Agents must not introduce abstraction layers without clear architectural purpose.

Default policy: reject new abstraction unless it passes an explicit value test.

## Bad Abstractions

The following patterns are commonly unnecessary.

### Thin Service Layers

```
class UserService {
  getUser(id) {
    return userRepository.getUser(id)
  }
}
```

This adds no value and only increases indirection.

### Wrapper Classes

```
class StripeClient {
  constructor(client) {
    this.client = client
  }

  createPayment(data) {
    return this.client.createPayment(data)
  }
}
```

If the wrapper does not enforce policy or simplify usage, it should not exist.

### Adapter Chains

Avoid structures like:

```
controller → service → adapter → wrapper → client
```

If layers do nothing but forward calls, they should be removed.

### Proxy Hooks

```
function useUserData() {
  return useQuery(...)
}
```

Hooks that simply proxy existing hooks without adding behavior should not exist.

### Rename-Only Utilities

Utilities that only rename existing operations are non-compliant and should be removed.

## Valid Abstraction Reasons

Abstractions are acceptable when they:

* enforce domain rules
* isolate infrastructure boundaries
* simplify complex operations
* standardize repeated workflows
* enforce validation or security constraints

Examples:

```
PaymentProcessor
TenantAuthorizationGuard
DocumentImportPipeline
EquityGrantAllocator
```

These abstractions represent **real architectural responsibilities**.

## Value Test

A new abstraction must answer at least one clearly and concretely:

* What complexity does this remove for callers?
* What policy or invariant does this enforce?
* What boundary or coupling risk does this prevent?
* What correctness or security guarantee does this add?

If the answer is vague or stylistic, reject the abstraction.

## Architectural Guideline

A good abstraction should answer one of these questions:

* What complexity does this hide?
* What policy does this enforce?
* What architectural boundary does this protect?

If the answer is “none”, the abstraction should not exist.

## Layer Chain Rule

Avoid layer chains where adjacent layers only forward calls.

If three or more layers exist in a flow, every layer must have distinct responsibility.
Otherwise collapse the chain.