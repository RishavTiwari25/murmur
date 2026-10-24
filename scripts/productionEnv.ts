/**
 * Production environment contract for `pnpm vercel-build`.
 *
 * The minimal deployment needs only OpenRouter, Postgres, Redis, Better Auth,
 * the public app URL and the execution mode. Kafka and Stripe are optional:
 * their variables are validated only when the feature is switched on.
 */
export const REQUIRED_PRODUCTION_ENV = [
  "OPENROUTER_API_KEY",
  "DATABASE_URL",
  "REDIS_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "APP_URL",
  "MURMUR_EXECUTION_MODE",
] as const;

/** Required together once KAFKA_BROKERS is set. */
export const KAFKA_PRODUCTION_ENV = [
  "KAFKA_BROKERS",
  "KAFKA_SWARM_EVENTS_TOPIC",
  "KAFKA_SSL",
  "KAFKA_SASL_MECHANISM",
  "KAFKA_USERNAME",
  "KAFKA_PASSWORD",
] as const;

/** Required together once any Stripe variable is set. */
export const STRIPE_PRODUCTION_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
] as const;

type Env = Record<string, string | undefined>;

export interface ProductionEnvSummary {
  kafka: boolean;
  billing: boolean;
}

function present(env: Env, name: string) {
  return Boolean(env[name]?.trim());
}

function parseUrl(env: Env, name: string) {
  try {
    return new URL(env[name]!.trim());
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}

/** Throws a descriptive error for the first violated rule. */
export function validateProductionEnv(env: Env): ProductionEnvSummary {
  const missing: string[] = REQUIRED_PRODUCTION_ENV.filter((name) => !present(env, name));

  const kafka = present(env, "KAFKA_BROKERS");
  if (kafka) missing.push(...KAFKA_PRODUCTION_ENV.filter((name) => !present(env, name)));

  const billing = STRIPE_PRODUCTION_ENV.some((name) => present(env, name));
  if (billing) missing.push(...STRIPE_PRODUCTION_ENV.filter((name) => !present(env, name)));

  if (missing.length > 0) {
    throw new Error(`Missing required Production environment variables: ${missing.join(", ")}`);
  }

  const redis = parseUrl(env, "REDIS_URL");
  if (redis.protocol !== "redis:" && redis.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://.");
  }

  const database = parseUrl(env, "DATABASE_URL");
  if (database.protocol !== "postgres:" && database.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://.");
  }

  for (const name of ["APP_URL", "BETTER_AUTH_URL"]) {
    if (parseUrl(env, name).protocol !== "https:") {
      throw new Error(`${name} must use https:// in Production.`);
    }
  }

  const mode = env.MURMUR_EXECUTION_MODE!.trim();
  if (mode !== "direct" && mode !== "temporal") {
    throw new Error("MURMUR_EXECUTION_MODE must be direct or temporal.");
  }

  if (kafka && !["1", "true", "yes"].includes(env.KAFKA_SSL!.trim().toLowerCase())) {
    throw new Error("KAFKA_SSL must be enabled for Production Kafka connections.");
  }

  return { kafka, billing };
}
