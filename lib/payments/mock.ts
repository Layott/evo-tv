import "server-only";
import type { PaymentProvider, CheckoutResult, VerificationResult, CheckoutInit } from "./provider";

declare global {
  // eslint-disable-next-line no-var
  var __evo_mock_payment_state: Map<string, VerificationResult> | undefined;
}

const state: Map<string, VerificationResult> =
  globalThis.__evo_mock_payment_state ?? new Map<string, VerificationResult>();
if (!globalThis.__evo_mock_payment_state) {
  globalThis.__evo_mock_payment_state = state;
}

export const mock: PaymentProvider = {
  id: "mock",
  async initCheckout(input: CheckoutInit): Promise<CheckoutResult> {
    state.set(input.reference, {
      reference: input.reference,
      status: "success",
      amountNgn: input.amountNgn,
      userId: input.userId,
      // Mirror what Paystack gives back, so a flow that works against the mock
      // is actually exercising the same shape in production.
      plan:
        typeof input.metadata?.plan === "string" ? input.metadata.plan : undefined,
      paidAt: new Date().toISOString(),
    });
    return {
      redirectUrl: `${input.callbackUrl}?reference=${encodeURIComponent(input.reference)}&mock=1`,
      reference: input.reference,
    };
  },
  async verify(reference: string): Promise<VerificationResult> {
    return (
      state.get(reference) ?? {
        reference,
        status: "failed",
        amountNgn: 0,
      }
    );
  },
  async handleWebhook(rawBody: string): Promise<VerificationResult> {
    const parsed = JSON.parse(rawBody) as { reference: string };
    return this.verify(parsed.reference);
  },
};
