import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const write = async (path: string, content: string): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
};

export const createSpecifyStub = async (rootPath: string): Promise<string> => {
	const scriptPath = join(rootPath, "specify-stub.sh");
	const content = `#!/usr/bin/env bash
set -e

if [[ "$1" == "--version" ]]; then
  echo "specify-cli 0.2.1"
  exit 0
fi

if [[ "$1" == "check" ]]; then
  echo "codex: ok"
  exit 0
fi

if [[ "$1" == "init" ]]; then
  mkdir -p .specify/memory .specify/scripts/bash .specify/templates .codex/prompts
  cat > .specify/memory/constitution.md <<'DOC'
# Constitution
DOC
  cat > .specify/scripts/bash/common.sh <<'DOC'
get_feature_dir() { echo "$1/specs/$2"; }
DOC
  cat > .specify/scripts/bash/create-new-feature.sh <<'DOC'
SPECS_DIR="$REPO_ROOT/specs"
DOC
  cat > .specify/scripts/bash/setup-plan.sh <<'DOC'
printf '{"SPECS_DIR":"%s"}' "$REPO_ROOT/specs"
DOC
  cat > .specify/templates/plan-template.md <<'DOC'
**Input**: Feature specification from /specs/[###-feature-name]/spec.md
DOC
  cat > .specify/templates/tasks-template.md <<'DOC'
**Input**: Design documents from /specs/[###-feature-name]/
DOC
  cat > .codex/prompts/speckit.specify.md <<'DOC'
Use /specs/[###-feature-name]/spec.md
DOC
  cat > .codex/prompts/speckit.plan.md <<'DOC'
Use specs/[###-feature]/plan.md
DOC
  exit 0
fi

echo "unsupported args: $*" >&2
exit 1
`;
	await write(scriptPath, content);
	await chmod(scriptPath, 0o755);
	return scriptPath;
};
