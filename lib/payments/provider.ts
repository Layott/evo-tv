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

export function getProvider(): PaymentProvider {
  const id = (process.env.PAYMENT_PROVIDER ?? "mock") as "paystack" | "mock";
  if (id === "paystack") return paystack;
  return mock;
}
