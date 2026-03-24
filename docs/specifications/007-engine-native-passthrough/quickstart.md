# Quickstart: Engine-Native Passthrough Namespacing

## 1. Start the project runtime

From the repository root:

```bash
mm runtime restart --non-interactive
```

Expected outcome:

- runtime reaches healthy or explicitly degraded state
- passthrough-capable engines complete discovery
- bootstrap evidence is recorded in `.mimirmesh/runtime/bootstrap-state.json` and per-engine runtime state

## 2. List published MCP tools through the client surface

```bash
mimirmesh-client list-tools
```

Validate that:

- unified tools such as `search_code` and `find_symbol` still appear unchanged
- discovered passthrough tools use `<engine>_<tool>` names such as `srclight_search_symbols`
- retired `mimirmesh`-prefixed passthrough aliases do not appear in the published list
- if runtime readiness is degraded or failed, passthrough publication truthfully reflects that state instead of listing undiscovered tools

## 3. Invoke a published passthrough tool

Example:

```bash
mimirmesh-client tool srclight_search_symbols '{"query":"ToolRouter"}'
```

Validate that:

- the call succeeds
- provenance still identifies the owning engine and engine tool
- the result content remains equivalent to the previous passthrough behavior

## 4. Verify unified tools are unchanged

```bash
mimirmesh-client tool search_code '{"query":"export"}'
```

Validate that:

- the unified tool name is unchanged
- the routed result still succeeds with normal provenance

## 5. Verify retired alias guidance

Example legacy call:

```bash
mimirmesh-client tool mimirmesh.srclight.search_symbols '{"query":"ToolRouter"}'
```

Validate that:

- the call fails
- the failure explicitly says the alias is retired
- the response identifies the replacement tool such as `srclight_search_symbols`

## 6. Check documentation-facing examples

Confirm that these surfaces match the observed runtime behavior:

- `docs/features/mcp-server.md`
- `docs/features/mcp-client.md`
- skill guidance that references passthrough tools
- CLI inspection surfaces such as `mimirmesh mcp list-tools`

## 7. Optional internal-state sanity check

Inspect `.mimirmesh/runtime/routing-table.json` after discovery.

Validate that:

- passthrough routing still resolves correctly
- any retained internal identifiers continue to support correct external publication and invocation
