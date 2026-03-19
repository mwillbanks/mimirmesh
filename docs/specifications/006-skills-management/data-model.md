# Data Model 006

## Global config

```yaml
version: 1
skills:
  install:
    symbolic: true
```

## Installed bundled skill status

- `name`
- `sourcePath`
- `targetPath`
- `installed`
- `mode`
- `outdated`
- `broken`

## CLI selection modes

- `install`: all bundled skills, all preselected
- `update`: outdated installed bundled skills, all preselected
- `remove`: installed bundled skills, none preselected
