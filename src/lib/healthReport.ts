import type { DependencyHealth } from "./swarm/infrastructure";

export type HealthStatus = "ready" | "degraded" | "not_ready";

export interface ReportedDependency {
  ok: boolean;
  required: boolean;
  /** "disabled" means intentionally not configured on this deployment. */
  state: "up" | "down" | "disabled";
  latencyMs: number;
}

export interface HealthReport {
  status: HealthStatus;
  executionMode: "direct" | "temporal";
  checkedAt: string;
  dependencies: Record<"kafka" | "redis" | "postgres" | "temporal", ReportedDependency>;
}

interface HealthInputs {
  executionMode: "direct" | "temporal";
  checkedAt: number;
  kafka: DependencyHealth;
  redis: DependencyHealth;
  postgres: DependencyHealth;
  temporal: DependencyHealth;
}

function report(dependency: DependencyHealth, required: boolean): ReportedDependency {
  return {
    ok: dependency.ok,
    required,
    state: dependency.disabled ? "disabled" : dependency.ok ? "up" : "down",
    latencyMs: dependency.latencyMs,
  };
}

/**
 * Pure projection behind GET /api/health. Optional dependencies that are not
 * configured (Kafka without KAFKA_BROKERS, Temporal in direct mode) are
 * "disabled": they never fail the probe and never mark it degraded. Only an
 * optional dependency that is configured but unreachable degrades it.
 */
export function buildHealthReport(input: HealthInputs): HealthReport {
  const temporalRequired = input.executionMode === "temporal";
  const ready =
    input.redis.ok && input.postgres.ok && (!temporalRequired || input.temporal.ok);
  const degraded = ready && !input.kafka.disabled && !input.kafka.ok;
  return {
    status: ready ? (degraded ? "degraded" : "ready") : "not_ready",
    executionMode: input.executionMode,
    checkedAt: new Date(input.checkedAt).toISOString(),
    dependencies: {
      kafka: report(input.kafka, false),
      redis: report(input.redis, true),
      postgres: report(input.postgres, true),
      temporal: report(input.temporal, temporalRequired),
    },
  };
}
