import { runCommand } from "../services/command";

export type DockerAvailability = {
  dockerInstalled: boolean;
  dockerDaemonRunning: boolean;
  composeAvailable: boolean;
  reasons: string[];
};

export const detectDockerAvailability = async (): Promise<DockerAvailability> => {
  const reasons: string[] = [];

  const dockerVersion = await runCommand(["docker", "--version"]);
  const dockerInstalled = dockerVersion.exitCode === 0;
  if (!dockerInstalled) {
    reasons.push("Docker is not installed.");
    return {
      dockerInstalled,
      dockerDaemonRunning: false,
      composeAvailable: false,
      reasons,
    };
  }

  const dockerInfo = await runCommand(["docker", "info", "--format", "{{json .ServerVersion}}"]);
  const dockerDaemonRunning = dockerInfo.exitCode === 0;
  if (!dockerDaemonRunning) {
    reasons.push("Docker daemon is not running.");
  }

  const composeVersion = await runCommand(["docker", "compose", "version"]);
  const composeAvailable = composeVersion.exitCode === 0;
  if (!composeAvailable) {
    reasons.push("Docker Compose plugin is unavailable.");
  }

  return {
    dockerInstalled,
    dockerDaemonRunning,
    composeAvailable,
    reasons,
  };
};
