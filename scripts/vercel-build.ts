import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { validateProductionEnv } from "./productionEnv";

const require = createRequire(import.meta.url);

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Sensitive Vercel variables are intentionally unavailable through `env pull`
// but are present inside the Production build. Run idempotent release
// migrations there before producing the deployable Next.js artifact.
if (process.env.VERCEL_ENV === "production") {
  const features = validateProductionEnv(process.env);
  console.log(
    `Production features: kafka=${features.kafka ? "on" : "off"}, billing=${features.billing ? "on" : "off"}`,
  );
  run("pnpm", ["db:migrate"]);
}

run(process.execPath, [require.resolve("next/dist/bin/next"), "build"]);
