import { describe, expect, it } from "vitest";
import { dependencyLabel } from "./SystemStatus";

describe("dependencyLabel", () => {
  it("labels unconfigured optional services as Disabled, not Down", () => {
    expect(dependencyLabel({ ok: false, required: false, state: "disabled" })).toBe("Disabled");
  });

  it("keeps Ready / Degraded / Unavailable for configured services", () => {
    expect(dependencyLabel({ ok: true, required: true, state: "up" })).toBe("Ready");
    expect(dependencyLabel({ ok: false, required: false, state: "down" })).toBe("Degraded");
    expect(dependencyLabel({ ok: false, required: true, state: "down" })).toBe("Unavailable");
  });
});
