import { homedir } from "node:os";
import { join } from "node:path";

import { installFromArtifacts } from "@mimirmesh/installer";

const root = process.cwd();
const artifactDir = join(root, "dist");
const targetBinDir = process.env.MIMIRMESH_INSTALL_DIR ?? join(homedir(), ".local", "bin");

const result = await installFromArtifacts({
	artifactDir,
	targetBinDir,
});

process.stdout.write(
	`${JSON.stringify(
		{
			binaryPath: result.binaryPath,
			aliasPath: result.aliasPath,
			serverPath: result.serverPath,
			clientPath: result.clientPath,
			verified: result.verified,
		},
		null,
		2,
	)}\n`,
);
