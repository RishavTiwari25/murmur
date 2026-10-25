/**
 * Model provider detection, kept free of SDK imports so the build script and
 * route guards can use it cheaply.
 *
 * AI Gateway counts as configured on Vercel (VERCEL / VERCEL_OIDC_TOKEN, where
 * the deployment's OIDC token authenticates automatically) or with an explicit
 * AI_GATEWAY_API_KEY. OpenRouter is configured only by OPENROUTER_API_KEY, and
 * direct Google Gemini (free tier) only by GOOGLE_GENERATIVE_AI_API_KEY.
 */
type Env = Record<string, string | undefined>;

export function isGatewayConfigured(env: Env = process.env) {
  if (env.MURMUR_DISABLE_AI_GATEWAY === "1") return false;
  return Boolean(
    env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim() || env.VERCEL?.trim(),
  );
}

export function isGoogleConfigured(env: Env = process.env) {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

export function isOpenRouterConfigured(env: Env = process.env) {
  return Boolean(env.OPENROUTER_API_KEY?.trim());
}

/** True when at least one model provider can serve requests. */
export function isModelProviderConfigured(env: Env = process.env) {
  return isGoogleConfigured(env) || isGatewayConfigured(env) || isOpenRouterConfigured(env);
}

export const MODEL_PROVIDER_MISSING_MESSAGE =
  "No model provider is configured. Deploy on Vercel (AI Gateway via OIDC), or set GOOGLE_GENERATIVE_AI_API_KEY, AI_GATEWAY_API_KEY or OPENROUTER_API_KEY.";
