import { type FixtureType, materializeFixture } from "../fixtures";

export const createIntegrationFixture = async (type: FixtureType): Promise<string> =>
	materializeFixture(type);
