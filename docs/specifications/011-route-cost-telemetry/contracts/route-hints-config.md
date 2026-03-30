# Contract: Repository Route Hint Overrides

## Purpose

Define the repository config surface for adaptive route-hint subset overrides.

## Config Location

`mcp.routingHints`

## Shape

```yaml
mcp:
  routingHints:
    adaptiveSubset:
      include:
        - find_symbol
      exclude:
        - search_code
```

## Semantics

- Built-in default allowlist for this slice: `search_code`, `find_symbol`
- Supported eligible built-in set for overrides in this slice: `search_code`, `find_symbol`
- Effective subset = `(default allowlist + include) - exclude`

## Validation Behavior

- CLI writes validate override entries before writing config.
- Runtime/config readers treat invalid override entries as explicit warnings, ignore them for effective routing, and surface the issue through telemetry health and inspection output.
- Invalid overrides do not permit arbitrary route behavior and do not block baseline static routing.

## Future Compatibility

- Additional eligible built-in tools can be added in later slices without changing the override contract shape.
- The contract intentionally does not expose per-route scoring weights or custom arbitrary route policies in this slice.