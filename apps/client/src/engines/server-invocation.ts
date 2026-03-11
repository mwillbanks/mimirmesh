import { access } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const resolveServerInvocation = async (
  projectRoot: string,
): Promise<{ command: string; args: string[]; env: Record<string, string> }> => {
  const explicit = process.env.MIMIRMESH_SERVER_BIN;
  const explicitPath = explicit ? (isAbsolute(explicit) ? explicit : resolve(explicit)) : undefined;
  if (explicitPath && (await pathExists(explicitPath))) {
    return {
      command: explicitPath,
      args: [],
      env: {
        ...process.env,
        MIMIRMESH_PROJECT_ROOT: projectRoot,
      },
    };
  }

  const workspaceBinary = join(projectRoot, "dist", "mimirmesh-server");
  if (await pathExists(workspaceBinary)) {
    return {
      command: workspaceBinary,
      args: [],
      env: {
        ...process.env,
        MIMIRMESH_PROJECT_ROOT: projectRoot,
      },
    };
  }

  return {
    command: "bun",
    args: ["run", join(projectRoot, "apps", "server", "src", "index.ts")],
    env: {
      ...process.env,
      MIMIRMESH_PROJECT_ROOT: projectRoot,
    },
  };
};
