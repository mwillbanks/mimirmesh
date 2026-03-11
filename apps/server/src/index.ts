export { startMcpServer } from "./startup/start-server";

if (import.meta.main) {
  const { startMcpServer } = await import("./startup/start-server");
  await startMcpServer();
}
