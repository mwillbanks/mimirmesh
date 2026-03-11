import { describe, expect, test } from "bun:test";

import { parseComposePs } from "./compose";

describe("runtime compose health parsing", () => {
  test("parses array json format", () => {
    const parsed = parseComposePs(
      JSON.stringify([
        {
          Service: "mm-srclight",
          State: "running",
          Health: "healthy",
          Status: "Up 20s",
          ID: "abc123",
        },
      ]),
    );

    expect(parsed.length).toBe(1);
    expect(parsed[0]?.name).toBe("mm-srclight");
    expect(parsed[0]?.state).toBe("running");
    expect(parsed[0]?.health).toBe("healthy");
  });
});
