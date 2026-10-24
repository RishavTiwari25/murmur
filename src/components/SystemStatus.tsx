"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, RadioIcon, WarningIcon } from "./ui/Icons";

interface HealthResponse {
  status: "ready" | "degraded" | "not_ready";
  executionMode: "direct" | "temporal";
  dependencies: Record<string, DependencyStatus>;
}

interface DependencyStatus {
  ok: boolean;
  required?: boolean;
  state?: "up" | "down" | "disabled";
}

/** Row label for one dependency. Exported for unit tests. */
export function dependencyLabel(dependency: DependencyStatus) {
  if (dependency.state === "disabled") return "Disabled";
  if (dependency.ok) return "Ready";
  return dependency.required === false ? "Degraded" : "Unavailable";
}

export function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  // "degraded" still serves runs — only optional telemetry is missing — so the
  // header stays green and the affected row carries the caveat instead.
  // Dependencies that are intentionally not configured report "disabled" and
  // never affect the header.
  const ready = health?.status === "ready" || health?.status === "degraded";
  const mode = health?.executionMode ?? "temporal";
  const dependencyLabels: Record<string, string> = {
    postgres: "PostgreSQL",
    redis: "Redis",
    kafka: "Kafka event bus",
    temporal: "Temporal",
  };

  return (
    <details className="murmur-system">
      <summary title={ready ? "All required services are ready" : "Check infrastructure status"}>
        <span className={`murmur-system-dot${ready ? " is-ready" : ""}`} />
        <span>{health ? (ready ? "Systems ready" : "Limited mode") : "Checking systems"}</span>
        <ChevronDownIcon size={14} />
      </summary>
      <div className="murmur-popover murmur-system-popover">
        <div className="murmur-popover-head">
          <span><RadioIcon size={15} />Infrastructure</span>
          <strong>{mode === "temporal" ? "Durable" : "Direct"}</strong>
        </div>
        <ul>
          {health ? Object.entries(health.dependencies).map(([key, dependency]) => (
            <li key={key}>
              {dependency.state === "disabled" ? (
                <span className="murmur-system-off" aria-hidden="true" />
              ) : dependency.ok ? (
                <CheckIcon size={15} />
              ) : (
                <WarningIcon size={15} />
              )}
              <span>{dependencyLabels[key] ?? key}</span>
              <small className={dependency.state === "disabled" ? "is-disabled" : undefined}>
                {dependencyLabel(dependency)}
              </small>
            </li>
          )) : <li><span className="murmur-button-loader" />Checking dependencies…</li>}
        </ul>
      </div>
    </details>
  );
}
