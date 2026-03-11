import { materializeFixture, type FixtureType } from "../fixtures";

export const createIntegrationFixture = async (type: FixtureType): Promise<string> =>
  materializeFixture(type);
