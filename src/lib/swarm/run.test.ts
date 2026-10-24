import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
  chainFor: vi.fn(),
  model: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  streamObject: vi.fn(),
  streamText: mocks.streamText,
}));
vi.mock("./models", () => ({
  chainFor: mocks.chainFor,
  model: mocks.model,
}));
vi.mock("./promptPolicy", () => ({ withAgentBehaviorPolicy: (value: string) => value }));
vi.mock("./rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  MODEL_RATE_LIMIT: { limit: 120, windowSeconds: 3600 },
  rateLimitKey: (scope: string, id: string) => `${scope}:${id}`,
  RateLimitError: class RateLimitError extends Error {},
}));

import { runText } from "./run";

describe("runText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chainFor.mockResolvedValue(["test-model"]);
    mocks.model.mockReturnValue("model-instance");
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.streamText.mockReturnValue({
      textStream: (async function* () {
        yield "bounded response";
      })(),
    });
  });

  it("forwards a hard output-token cap for quick chat", async () => {
    await runText("worker", {
      system: "Answer directly.",
      prompt: "Hello",
      maxOutputTokens: 800,
      onDelta: vi.fn(),
    });

    expect(mocks.streamText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 800 }));
  });

  it("falls through to the next model when one has been retired (404)", async () => {
    mocks.chainFor.mockResolvedValue(["retired-model:free", "live-model:free"]);
    mocks.streamText
      .mockReturnValueOnce({
        textStream: (async function* () {
          throw Object.assign(new Error("This model is unavailable for free."), { statusCode: 404 });
        })(),
      })
      .mockReturnValueOnce({
        textStream: (async function* () {
          yield "answer from the live model";
        })(),
      });

    const res = await runText("worker", { system: "s", prompt: "p", onDelta: vi.fn() });

    expect(res).toEqual({ text: "answer from the live model", modelId: "live-model:free" });
  });
});
