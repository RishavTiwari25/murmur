import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { kafkaConstructed, pingRedis } = vi.hoisted(() => ({
  kafkaConstructed: vi.fn(),
  pingRedis: vi.fn(async () => undefined),
}));

vi.mock("kafkajs", () => ({
  Kafka: class {
    constructor() {
      kafkaConstructed();
      throw new Error("Kafka must not be constructed when disabled");
    }
  },
  logLevel: { DEBUG: 5, ERROR: 1 },
}));
vi.mock("./redis", () => ({ pingRedis }));

import { isKafkaEnabled } from "./config";
import { publishSwarmEvent } from "./kafka";
import {
  dependencyState,
  getInfrastructureHealth,
  resetInfrastructureHealthCache,
} from "./infrastructure";
import type { SwarmEventEnvelope } from "./session";

const envelope = {
  id: "run-1:1",
  runId: "run-1",
  sequence: 1,
  version: 1,
  occurredAt: Date.now(),
  event: { kind: "run.start" },
} as unknown as SwarmEventEnvelope;

beforeEach(() => {
  vi.stubEnv("KAFKA_BROKERS", "");
  vi.stubEnv("AZURE_EVENTHUBS_CONNECTION_STRING", "");
  kafkaConstructed.mockClear();
  pingRedis.mockClear();
  resetInfrastructureHealthCache();
});
afterEach(() => vi.unstubAllEnvs());

describe("optional Kafka", () => {
  it("is disabled unless brokers or an Event Hubs connection string are set", () => {
    expect(isKafkaEnabled()).toBe(false);
    vi.stubEnv("KAFKA_BROKERS", "  ");
    expect(isKafkaEnabled()).toBe(false);
    vi.stubEnv("KAFKA_BROKERS", "localhost:9092");
    expect(isKafkaEnabled()).toBe(true);
    vi.stubEnv("KAFKA_BROKERS", "");
    vi.stubEnv("AZURE_EVENTHUBS_CONNECTION_STRING", "Endpoint=sb://x.servicebus.windows.net/");
    expect(isKafkaEnabled()).toBe(true);
  });

  it("skips publishing without constructing a Kafka client", async () => {
    await expect(publishSwarmEvent(envelope)).resolves.toBe(false);
    expect(kafkaConstructed).not.toHaveBeenCalled();
  });

  it("reports Kafka as disabled and lets runs start on Redis alone", async () => {
    const health = await getInfrastructureHealth({ force: true });
    expect(health.ok).toBe(true);
    expect(health.kafka).toMatchObject({ disabled: true });
    expect(dependencyState(health.kafka)).toBe("disabled");
    expect(dependencyState(health.redis)).toBe("up");
    expect(kafkaConstructed).not.toHaveBeenCalled();
  });

  it("still blocks runs when Redis is down", async () => {
    pingRedis.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const health = await getInfrastructureHealth({ force: true });
    expect(health.ok).toBe(false);
    expect(dependencyState(health.redis)).toBe("down");
  });
});
