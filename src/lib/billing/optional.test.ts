import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getRequestSession, service } = vi.hoisted(() => ({
  getRequestSession: vi.fn(),
  service: {
    startProCheckout: vi.fn(),
    createBillingPortal: vi.fn(),
    processStripeEvent: vi.fn(),
    verifyStripeWebhook: vi.fn(),
    BillingNotFoundError: class extends Error {},
  },
}));
vi.mock("@/lib/auth", () => ({ getRequestSession }));
vi.mock("@/lib/billing/service", () => service);

import { isBillingEnabled } from "./stripe";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as portal } from "@/app/api/billing/portal/route";
import { POST as webhook } from "@/app/api/billing/webhook/route";

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_PRO_PRICE_ID", "");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

const post = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${path}`, { method: "POST", headers, body: "{}" });

describe("optional Stripe billing", () => {
  it("is enabled only with both a secret key and a Pro price", () => {
    expect(isBillingEnabled()).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    expect(isBillingEnabled()).toBe(false);
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_1");
    expect(isBillingEnabled()).toBe(true);
  });

  it.each([
    ["checkout", checkout, "/api/billing/checkout"],
    ["portal", portal, "/api/billing/portal"],
  ] as const)("%s answers 503 billing disabled without touching auth or Stripe", async (_, route, path) => {
    const response = await route(post(path));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ billing: "disabled" });
    expect(getRequestSession).not.toHaveBeenCalled();
    expect(service.startProCheckout).not.toHaveBeenCalled();
    expect(service.createBillingPortal).not.toHaveBeenCalled();
  });

  it("webhook tolerates deliveries when billing is disabled", async () => {
    const response = await webhook(
      post("/api/billing/webhook", { "stripe-signature": "t=1,v1=x" }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ billing: "disabled" });
    expect(service.verifyStripeWebhook).not.toHaveBeenCalled();
  });

  it("webhook still requires a signature once billing is enabled", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_1");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_1");
    const response = await webhook(post("/api/billing/webhook"));
    expect(response.status).toBe(400);
  });
});
