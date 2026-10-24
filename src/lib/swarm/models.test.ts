import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { gatewayModel, openrouterModel } = vi.hoisted(() => ({
  gatewayModel: vi.fn((id: string) => ({ provider: "gateway", id })),
  openrouterModel: vi.fn((id: string) => ({ provider: "openrouter", id })),
}));
vi.mock("ai", () => ({ createGateway: () => gatewayModel }));
vi.mock("@openrouter/ai-sdk-provider", () => ({ createOpenRouter: () => openrouterModel }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  for (const name of [
    "VERCEL",
    "VERCEL_OIDC_TOKEN",
    "AI_GATEWAY_API_KEY",
    "OPENROUTER_API_KEY",
    "MURMUR_PLANNER_MODEL",
    "MURMUR_WORKER_MODEL",
    "MURMUR_DISABLE_AI_GATEWAY",
  ]) {
    vi.stubEnv(name, "");
  }
  vi.stubEnv("MURMUR_FORCE_FREE", "1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ json: async () => ({ data: [] }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("model provider selection", () => {
  it("treats Vercel, an OIDC token, or a gateway key as a configured AI Gateway", async () => {
    const { isGatewayConfigured, isModelProviderConfigured } = await import("./provider");
    expect(isModelProviderConfigured()).toBe(false);
    expect(isGatewayConfigured({ VERCEL: "1" })).toBe(true);
    expect(isGatewayConfigured({ VERCEL_OIDC_TOKEN: "jwt" })).toBe(true);
    expect(isGatewayConfigured({ AI_GATEWAY_API_KEY: "key" })).toBe(true);
    expect(isGatewayConfigured({ VERCEL: "1", MURMUR_DISABLE_AI_GATEWAY: "1" })).toBe(false);
    expect(isModelProviderConfigured({ OPENROUTER_API_KEY: "sk-or" })).toBe(true);
  });

  it("uses only AI Gateway models and never probes openrouter.ai without a key", async () => {
    vi.stubEnv("VERCEL", "1");
    const { chainFor } = await import("./models");
    const chain = await chainFor("planner");
    expect(chain[0]).toBe("google/gemini-2.5-flash");
    expect(chain.every((id) => !id.startsWith("openrouter:"))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets MURMUR_<ROLE>_MODEL override the head of the gateway chain", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "key");
    vi.stubEnv("MURMUR_WORKER_MODEL", "openai/gpt-5-mini");
    const { chainFor } = await import("./models");
    expect((await chainFor("worker"))[0]).toBe("openai/gpt-5-mini");
  });

  it("appends prefixed OpenRouter models as a fallback when a key is set", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or");
    const { chainFor } = await import("./models");
    const chain = await chainFor("worker");
    expect(chain[0]).toBe("google/gemini-2.5-flash-lite");
    expect(chain.some((id) => id.startsWith("openrouter:"))).toBe(true);
  });

  it("falls back to OpenRouter alone when only its key is set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or");
    vi.stubEnv("MURMUR_PLANNER_MODEL", "anthropic/claude-haiku-4.5");
    const { chainFor } = await import("./models");
    const chain = await chainFor("planner");
    expect(chain[0]).toBe("openrouter:anthropic/claude-haiku-4.5");
    expect(chain.every((id) => id.startsWith("openrouter:"))).toBe(true);
  });

  it("routes ids to the matching provider", async () => {
    const { model } = await import("./models");
    expect(model("google/gemini-2.5-flash")).toEqual({ provider: "gateway", id: "google/gemini-2.5-flash" });
    expect(model("openrouter:google/gemma-4-31b-it:free")).toEqual({
      provider: "openrouter",
      id: "google/gemma-4-31b-it:free",
    });
  });
});
