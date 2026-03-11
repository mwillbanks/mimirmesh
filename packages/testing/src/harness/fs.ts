import { cp } from "node:fs/promises";

export const copyWorkspaceTo = async (source: string, destination: string): Promise<void> => {
  await cp(source, destination, { recursive: true, force: true });
};
