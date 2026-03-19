# Quickstart 006

Install all bundled skills into the current repository:

```bash
mimirmesh skills install
```

Update outdated installed bundled skills:

```bash
mimirmesh skills update
```

Remove a specific installed skill without prompting:

```bash
mimirmesh skills remove mimirmesh-agent-router --non-interactive
```

Use copied installs instead of symbolic links by setting the global config:

```yaml
version: 1
skills:
  install:
    symbolic: false
```
