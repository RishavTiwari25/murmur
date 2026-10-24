import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export type Role = "planner" | "validator" | "worker" | "synthesizer" | "vision";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
export const model = (id: string) => openrouter(id);

// Preferred paid model — auto-used the moment the OpenRouter key has credit.
const CLAUDE = process.env.MURMUR_CLAUDE_MODEL ?? "anthropic/claude-sonnet-4.5";

// Free fallback pools (re-verified live on OpenRouter 2026-10-22). Order = preference;
// the executor walks the list on rate-limit / unavailability so a single 429 never kills
// a run. OpenRouter retires free models without notice, so chainFor() also drops any id
// that is no longer listed — a stale entry here costs nothing instead of failing the run.
const FREE_STRUCTURED = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "minimax/minimax-m3.1-flash:free",
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-31b-it:free",
];
const FREE_CHAT = [
  "minimax/minimax-m3.1-flash:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "poolside/laguna-s-2.1:free",
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-31b-it:free",
];
const FREE_VISION = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
];

const ENV_OVERRIDE: Record<Role, string | undefined> = {
  planner: process.env.MURMUR_PLANNER_MODEL,
  validator: process.env.MURMUR_VALIDATOR_MODEL,
  worker: process.env.MURMUR_WORKER_MODEL,
  synthesizer: process.env.MURMUR_SYNTH_MODEL,
  vision: process.env.MURMUR_VISION_MODEL,
};

// Cached probe: does this key have paid access? A SUCCESSFUL result (true or
// false) is cached for the process lifetime. A probe FAILURE (network error,
// bad response) is not cached, so a transient blip doesn't permanently pin
// this process to the free-only chain for its entire lifetime.
let paidProbe: Promise<boolean> | null = null;
function hasPaidAccess(): Promise<boolean> {
  if (process.env.MURMUR_FORCE_PAID === "1") return Promise.resolve(true);
  if (process.env.MURMUR_FORCE_FREE === "1") return Promise.resolve(false);
  if (!paidProbe) {
    paidProbe = fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    })
      .then((r) => r.json())
      .then((j) => j?.data?.is_free_tier === false)
      .catch((error) => {
        paidProbe = null; // let the next call retry instead of caching a failure
        console.error("Paid-access probe failed; treating as free tier for this call", error);
        return false;
      });
  }
  return paidProbe;
}

// Cached list of model ids OpenRouter currently serves. Refreshed hourly; on a fetch
// failure the chain is used unfiltered rather than emptied.
const LIVE_TTL_MS = 60 * 60 * 1000;
let liveModels: { at: number; ids: Promise<Set<string> | null> } | null = null;
function liveModelIds(): Promise<Set<string> | null> {
  if (!liveModels || Date.now() - liveModels.at > LIVE_TTL_MS) {
    const ids = fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((j: { data?: { id: string }[] }) =>
        j?.data?.length ? new Set(j.data.map((m) => m.id)) : null,
      )
      .catch((error) => {
        liveModels = null; // retry on the next call instead of caching the failure
        console.error("OpenRouter model list fetch failed; using the static chain", error);
        return null;
      });
    liveModels = { at: Date.now(), ids };
  }
  return liveModels.ids;
}

/** Ordered list of model ids to try for a role. Claude first when the key is paid. */
export async function chainFor(role: Role): Promise<string[]> {
  const paid = await hasPaidAccess();
  const pool = role === "vision"
    ? FREE_VISION
    : role === "worker" || role === "synthesizer"
      ? FREE_CHAT
      : FREE_STRUCTURED;
  // Workers stay free even on a paid key (cost control); other roles prefer Claude.
  const head = [ENV_OVERRIDE[role], paid && role !== "worker" ? CLAUDE : undefined].filter(
    Boolean,
  ) as string[];
  const live = await liveModelIds();
  // Explicit overrides and the paid model are kept as-is; only the free pool is filtered.
  const free = live ? pool.filter((id) => live.has(id)) : pool;
  return [...new Set([...head, ...(free.length ? free : pool)])];
}
