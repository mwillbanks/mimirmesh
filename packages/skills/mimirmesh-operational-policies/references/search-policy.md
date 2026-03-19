# Search Policy

MímirMesh search policy is optimized for precision, low token usage, and fast localization.

- Start with routed tools before passthrough tools.
- Prefer `find_symbol` for stable names such as functions, classes, commands, and interfaces.
- Prefer `search_code` for exact strings, code patterns, error text, import shapes, or when the symbol name is unknown.
- Prefer `trace_dependency` only after the relevant symbol or module is localized.
- Prefer `find_tests` after the implementation target is known.
- Prefer `explain_project` only for broad orientation or when the user asked for repository-wide structure.
- Pass `path` whenever the likely package or subsystem is known.
- Keep `limit` small on the first call.
- Stop once the answer is localized. Do not keep widening the search without evidence.
- Escalate to investigation, architecture, or integration workflows only when the localized search result shows that the question is broader than navigation.
