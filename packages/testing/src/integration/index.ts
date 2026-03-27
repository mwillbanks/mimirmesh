import { type FixtureType, materializeFixture } from "../fixtures";

export { parseIntegrationCliOptions, shouldRunIntegrationTests } from "./manager";

export const createIntegrationFixture = async (type: FixtureType): Promise<string> =>
	materializeFixture(type);
