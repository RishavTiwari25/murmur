import Stripe from "stripe";

let stripeClient: Stripe | undefined;

/**
 * Stripe is optional. Billing is enabled only when both the secret key and the
 * Pro price are configured; otherwise every user stays on the free plan, the
 * free-tier rate limits still apply, and billing routes answer 503.
 */
export function isBillingEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_PRO_PRICE_ID?.trim());
}

export const BILLING_DISABLED_MESSAGE = "Billing is disabled on this deployment.";

export function billingDisabledResponse() {
  return Response.json(
    { error: BILLING_DISABLED_MESSAGE, billing: "disabled" },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getProPriceId() {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRO_PRICE_ID is not configured.");
  return priceId;
}

export function getAppUrl() {
  return (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
