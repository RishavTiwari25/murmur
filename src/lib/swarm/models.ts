import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGateway, type LanguageModel } from "ai";
import { isGatewayConfigured, isOpenRouterConfigured } from "./provider";

export {
  isGatewayConfigured,
  isModelProviderConfigured,
  isOpenRouterConfigured,
  MODEL_PROVIDER_MISSING_MESSAGE,
} from "./provider";

export type Role = "planner" | "validator" | "worker" | "synthesizer" | "vision";

/**
 * Model provider selection.
 *
 * The primary provider is the Vercel AI Gateway. On Vercel it authenticates
 * with the deployment's OIDC token automatically, so no API key is needed;
 * locally it uses AI_GATEWAY_API_KEY or the VERCEL_OIDC_TOKEN written by
 * `vercel env pull`. OpenRouter is an optional fallback, used only when
 * OPENROUTER_API_KEY is set. Chain entries for OpenRouter carry an
 * `openrouter:` prefix; every other id is an AI Gateway model id.
 */
export const OPENROUTER_PREFIX = "openrouter:";

let gatewayProvider: ReturnType<typeof createGateway> | null = null;
let openrouterProvider: ReturnType<typeof createOpenRouter> | null = null;

export function model(id: string): LanguageModel {
  if (id.startsWith(OPENROUTER_PREFIX)) {
    openrouterProvider ??= createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    return openrouterProvider(id.slice(OPENROUTER_PREFIX.length));
  }
  // createGateway() reads AI_GATEWAY_API_KEY, falling back to the Vercel OIDC token.
  gatewayProvider ??= createGateway();
  return gatewayProvider(id);
}

// Cheap, fast AI Gateway defaults (verified against https://ai-gateway.vercel.sh/v1/models
// on 2026-10-24). Order = preference; the executor walks the list on
// rate-limit / unavailability. Each role's first entry is overridable via
// MURMUR_<ROLE>_MODEL.
const GATEWAY_DEFAULTS: Record<Role, string[]> = {
  planner: ["google/gemini-2.5-flash", "openai/gpt-5-nano"],
  validator: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
  worker: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
  synthesizer: ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"],
  vision: ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"],
};

// Preferred paid OpenRouter model — used only when the OpenRouter key has credit.
const CLAUDE = process.env.MURMUR_CLAUDE_MODEL ?? "anthropic/claude-sonnet-4.5";

// OpenRouter free fallback pools (re-verified live on OpenRouter 2026-10-22).
// OpenRouter retires free models without notice, so the chain also drops any id
// that is no longer listed.
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

function envOverride(role: Role): string | undefined {
  const value = {
    planner: process.env.MURMUR_PLANNER_MODEL,
    validator: process.env.MURMUR_VALIDATOR_MODEL,
    worker: process.env.MURMUR_WORKER_MODEL,
    synthesizer: process.env.MURMUR_SYNTH_MODEL,
    vision: process.env.MURMUR_VISION_MODEL,
  }[role];
  return value?.trim() || undefined;
}

// Cached probe: does this OpenRouter key have paid access? A successful result is
// cached for the process lifetime; a probe failure is not, so a transient blip
// doesn't pin this process to the free-only chain.
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
        paidProbe = null;
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
        liveModels = null;
        console.error("OpenRouter model list fetch failed; using the static chain", error);
        return null;
      });
    liveModels = { at: Date.now(), ids };
  }
  return liveModels.ids;
}

/** OpenRouter chain (unprefixed ids). Probes openrouter.ai only when called. */
async function openRouterChain(role: Role, override?: string): Promise<string[]> {
  const paid = await hasPaidAccess();
  const pool = role === "vision"
    ? FREE_VISION
    : role === "worker" || role === "synthesizer"
      ? FREE_CHAT
      : FREE_STRUCTURED;
  // Workers stay free even on a paid key (cost control); other roles prefer Claude.
  const head = [override, paid && role !== "worker" ? CLAUDE : undefined].filter(
    Boolean,
  ) as string[];
  const live = await liveModelIds();
  const free = live ? pool.filter((id) => live.has(id)) : pool;
  return [...new Set([...head, ...(free.length ? free : pool)])];
}

/**
 * Ordered list of model ids to try for a role: AI Gateway models first (when
 * configured), then OpenRouter models prefixed with `openrouter:` (only when
 * OPENROUTER_API_KEY is set). MURMUR_<ROLE>_MODEL overrides the head of the
 * primary provider's chain.
 */
export async function chainFor(role: Role): Promise<string[]> {
  const gateway = isGatewayConfigured();
  const openrouter = isOpenRouterConfigured();
  const override = envOverride(role);
  const chain: string[] = [];

  if (gateway) {
    chain.push(...(override ? [override] : []), ...GATEWAY_DEFAULTS[role]);
  }
  if (openrouter) {
    const ids = await openRouterChain(role, gateway ? undefined : override);
    chain.push(...ids.map((id) => `${OPENROUTER_PREFIX}${id}`));
  }
  if (!gateway && !openrouter) {
    // No provider is configured; still return the gateway defaults so the call
    // fails with the provider's own authentication error rather than an empty chain.
    chain.push(...(override ? [override] : []), ...GATEWAY_DEFAULTS[role]);
  }
  return [...new Set(chain)];
}
