# Quality Gates

Every completed change must satisfy the repository-quality gates that apply to its scope.

- Add or update automated tests for changed behavior.
- Run repository-native type, lint, and test validation for the affected scope.
- Run build validation when the change affects distributable code, packaging, or binaries.
- Validate routed MCP behavior when tool descriptions, schemas, routing rules, or adapter normalization change.
- Validate runtime-backed behavior when runtime, adapter, or deployment surfaces change.
- Update docs when functionality, behavior, or operating guidance changes.
- Do not leave stale examples, placeholder text, or dead references behind.
