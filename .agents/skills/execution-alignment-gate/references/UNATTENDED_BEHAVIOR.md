# Unattended behavior

This file governs user-side non-response only.

## Wait window

If the environment supports synchronous waiting and the user is reasonably expected to reply, wait up to 30 seconds.

If no answer arrives within that window:

* mark the clarification as unattended
* proceed as if clarification was declined
* do not open repeated wait windows
* do not loop for more input

If the environment does not support synchronous waiting, apply unattended fallback immediately.

## Fallback behavior

When using unattended fallback:

* proceed only if safe
* lock only material assumptions
* avoid destructive, irreversible, expensive, or externally visible choices unless already authorized
* use the short assumption format in [assets/TEMPLATE_ASSUMPTIONS_BLOCK.md](../assets/TEMPLATE_ASSUMPTIONS_BLOCK.md)
* state that execution proceeded under unattended fallback semantics

## Manager distinction

This wait logic does not apply to manager clarification.

If a sub-agent needs manager input, it must return a compact blocked packet. It must not simulate chat waiting behavior.
