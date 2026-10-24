import { describe, expect, it } from "vitest";
import { buildHealthReport } from "./healthReport";

const up = { ok: true, latencyMs: 1 };
const down = { ok: false, latencyMs: 1 };
const disabled = { ok: false, latencyMs: 0, disabled: true };

describe("buildHealthReport", () => {
  it("is ready on a minimal direct deployment with Kafka and Temporal disabled", () => {
    const report = buildHealthReport({
      executionMode: "direct",
      checkedAt: 0,
      kafka: disabled,
      redis: up,
      postgres: up,
      temporal: disabled,
    });
    expect(report.status).toBe("ready");
    expect(report.dependencies.kafka).toMatchObject({ state: "disabled", required: false });
    expect(report.dependencies.temporal).toMatchObject({ state: "disabled", required: false });
  });

  it("degrades, but does not fail, when configured Kafka is unreachable", () => {
    const report = buildHealthReport({
      executionMode: "direct",
      checkedAt: 0,
      kafka: down,
      redis: up,
      postgres: up,
      temporal: disabled,
    });
    expect(report.status).toBe("degraded");
    expect(report.dependencies.kafka.state).toBe("down");
  });

  it("is not ready without Redis or Postgres", () => {
    for (const [redis, postgres] of [
      [down, up],
      [up, down],
    ]) {
      const report = buildHealthReport({
        executionMode: "direct",
        checkedAt: 0,
        kafka: disabled,
        redis,
        postgres,
        temporal: disabled,
      });
      expect(report.status).toBe("not_ready");
    }
  });

  it("requires Temporal only in temporal mode", () => {
    const report = buildHealthReport({
      executionMode: "temporal",
      checkedAt: 0,
      kafka: disabled,
      redis: up,
      postgres: up,
      temporal: down,
    });
    expect(report.status).toBe("not_ready");
    expect(report.dependencies.temporal).toMatchObject({ state: "down", required: true });
  });
});
