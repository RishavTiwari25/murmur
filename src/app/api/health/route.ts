import { DISABLED_DEPENDENCY, getInfrastructureHealth } from "@/lib/swarm/infrastructure";
import { pingDatabase } from "@/lib/database";
import { buildHealthReport } from "@/lib/healthReport";
import { getExecutionMode, pingTemporal } from "@/lib/temporal/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const executionMode = getExecutionMode();
  const [health, postgres, temporal] = await Promise.all([
    getInfrastructureHealth({ force: true }),
    check(pingDatabase),
    executionMode === "temporal" ? check(pingTemporal) : Promise.resolve({ ...DISABLED_DEPENDENCY }),
  ]);
  // Kafka only mirrors run events to downstream consumers. When it is not
  // configured it is reported as "disabled"; when configured but unreachable
  // the probe is "degraded" rather than failing, so uptime checks do not page
  // for lost telemetry.
  const report = buildHealthReport({
    executionMode,
    checkedAt: health.checkedAt,
    kafka: health.kafka,
    redis: health.redis,
    postgres,
    temporal,
  });
  return Response.json(report, {
    status: report.status === "not_ready" ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}

async function check(probe: () => Promise<void>) {
  const startedAt = Date.now();
  try {
    await probe();
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, latencyMs: Date.now() - startedAt };
  }
}
