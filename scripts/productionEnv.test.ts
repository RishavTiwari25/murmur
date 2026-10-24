import { describe, expect, it } from "vitest";
import { REQUIRED_PRODUCTION_ENV, validateProductionEnv } from "./productionEnv";

const minimal = {
  OPENROUTER_API_KEY: "sk-or-test",
  DATABASE_URL: "postgresql://user:pass@ep-example.neon.tech/murmur?sslmode=require",
  REDIS_URL: "rediss://default:token@example.upstash.io:6379",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "https://murmur.example.com",
  APP_URL: "https://murmur.example.com",
  MURMUR_EXECUTION_MODE: "direct",
};

describe("validateProductionEnv", () => {
  it("accepts the minimal deployment without Kafka or Stripe", () => {
    expect(validateProductionEnv(minimal)).toEqual({ kafka: false, billing: false });
  });

  it("lists exactly the minimal required variables", () => {
    expect([...REQUIRED_PRODUCTION_ENV].sort()).toEqual(Object.keys(minimal).sort());
  });

  it.each(Object.keys(minimal))("rejects a deployment missing %s", (name) => {
    expect(() => validateProductionEnv({ ...minimal, [name]: "" })).toThrow(name);
  });

  it("requires the full Kafka set and TLS only once KAFKA_BROKERS is set", () => {
    expect(() => validateProductionEnv({ ...minimal, KAFKA_BROKERS: "kafka:9093" })).toThrow(
      /KAFKA_SWARM_EVENTS_TOPIC/,
    );
    const kafka = {
      ...minimal,
      KAFKA_BROKERS: "kafka:9093",
      KAFKA_SWARM_EVENTS_TOPIC: "murmur.swarm.events",
      KAFKA_SASL_MECHANISM: "scram-sha-256",
      KAFKA_USERNAME: "murmur",
      KAFKA_PASSWORD: "secret",
    };
    expect(() => validateProductionEnv({ ...kafka, KAFKA_SSL: "0" })).toThrow(
      "KAFKA_SSL must be enabled",
    );
    expect(validateProductionEnv({ ...kafka, KAFKA_SSL: "1" })).toEqual({
      kafka: true,
      billing: false,
    });
  });

  it("ignores KAFKA_SSL when Kafka is disabled", () => {
    expect(validateProductionEnv({ ...minimal, KAFKA_SSL: "0" }).kafka).toBe(false);
  });

  it("requires every Stripe variable once any one is set", () => {
    expect(() => validateProductionEnv({ ...minimal, STRIPE_SECRET_KEY: "sk_live" })).toThrow(
      /STRIPE_PRO_PRICE_ID, STRIPE_WEBHOOK_SECRET/,
    );
    expect(
      validateProductionEnv({
        ...minimal,
        STRIPE_SECRET_KEY: "sk_live",
        STRIPE_PRO_PRICE_ID: "price_1",
        STRIPE_WEBHOOK_SECRET: "whsec_1",
      }),
    ).toEqual({ kafka: false, billing: true });
  });

  it("enforces URL schemes and the execution mode", () => {
    expect(() => validateProductionEnv({ ...minimal, REDIS_URL: "https://x" })).toThrow("REDIS_URL");
    expect(() => validateProductionEnv({ ...minimal, DATABASE_URL: "mysql://x" })).toThrow(
      "DATABASE_URL",
    );
    expect(() => validateProductionEnv({ ...minimal, APP_URL: "http://x" })).toThrow("APP_URL");
    expect(() => validateProductionEnv({ ...minimal, MURMUR_EXECUTION_MODE: "fast" })).toThrow(
      "MURMUR_EXECUTION_MODE",
    );
  });
});
