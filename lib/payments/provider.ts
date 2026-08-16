import "server-only";

export interface CheckoutInit {
  userId: string;
  amountNgn: number;
  email: string;
  reference: string;
  metadata?: Record<string, unknown>;
  callbackUrl: string;
}

export interface CheckoutResult {
  redirectUrl: string;
  reference: string;
  accessCode?: string;
}

export interface VerificationResult {
  reference: string;
  status: "success" | "failed" | "pending";
  amountNgn: number;
  userId?: string;
  paidAt?: string;
}

export interface PaymentProvider {
  id: "paystack" | "mock" | "stripe";
  initCheckout(input: CheckoutInit): Promise<CheckoutResult>;
  verify(reference: string): Promise<VerificationResult>;
  handleWebhook(rawBody: string, signature: string | null): Promise<VerificationResult>;
}

export { paystack } from "./paystack";
export { mock as mockProvider } from "./mock";

import { paystack } from "./paystack";
import { mock } from "./mock";

/**
 * The provider named by `PAYMENT_PROVIDER`, with one refusal.
 *
 * The mock provider approves every payment without taking money, which is
 * exactly right in development and a way of giving the shop away in
 * production. On 2026-08-16 production had `PAYMENT_PROVIDER=[SENSITIVE]`, a
 * placeholder left by a redacted export, and anything other than "paystack"
 * silently selected the mock. Nobody had bought anything yet, so nothing was
 * lost, but a subscription would have been free.
 *
 * A misconfigured production now fails loudly at checkout instead. Set
 * `ALLOW_MOCK_PAYMENTS=true` to opt into the old behaviour on a staging box
 * that runs with NODE_ENV=production.
 */
export function getProvider(): PaymentProvider {
  const id = process.env.PAYMENT_PROVIDER ?? "mock";
  if (id === "paystack") return paystack;

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_MOCK_PAYMENTS !== "true"
  ) {
    throw new Error(
      `Refusing to take payments with the mock provider in production (PAYMENT_PROVIDER=${
        id || "unset"
      }). Set PAYMENT_PROVIDER=paystack with a real PAYSTACK_SECRET_KEY, or ALLOW_MOCK_PAYMENTS=true if this is deliberate.`,
    );
  }
  return mock;
}
