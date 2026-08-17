import "server-only";
import crypto from "node:crypto";
import type {
  PaymentProvider,
  CheckoutResult,
  VerificationResult,
  CheckoutInit,
} from "./provider";

const BASE = "https://api.paystack.co";

function secretKey(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY not set");
  return k;
}

async function psFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Paystack ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export const paystack: PaymentProvider = {
  id: "paystack",
  async initCheckout(input: CheckoutInit): Promise<CheckoutResult> {
    const body = {
      email: input.email,
      amount: input.amountNgn * 100,
      reference: input.reference,
      metadata: input.metadata ?? {},
      callback_url: input.callbackUrl,
      currency: "NGN",
    };
    const res = await psFetch<{
      data: { authorization_url: string; access_code: string; reference: string };
    }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      redirectUrl: res.data.authorization_url,
      reference: res.data.reference,
      accessCode: res.data.access_code,
    };
  },
  async verify(reference: string): Promise<VerificationResult> {
    const res = await psFetch<{
      data: {
        reference: string;
        status: string;
        amount: number;
        paid_at: string | null;
        metadata?: { userId?: string; plan?: string };
      };
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    return {
      reference: res.data.reference,
      status:
        res.data.status === "success"
          ? "success"
          : res.data.status === "failed"
          ? "failed"
          : "pending",
      amountNgn: Math.round(res.data.amount / 100),
      userId: res.data.metadata?.userId,
      plan: res.data.metadata?.plan,
      paidAt: res.data.paid_at ?? undefined,
    };
  },
  async handleWebhook(rawBody: string, signature: string | null): Promise<VerificationResult> {
    if (!signature) throw new Error("Missing x-paystack-signature header");
    const expected = crypto
      .createHmac("sha512", secretKey())
      .update(rawBody)
      .digest("hex");
    if (expected.length !== signature.length) throw new Error("Bad signature");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new Error("Bad signature");
    }
    const parsed = JSON.parse(rawBody) as {
      event: string;
      data: {
        reference: string;
        status: string;
        amount: number;
        paid_at: string | null;
        metadata?: { userId?: string; plan?: string };
      };
    };
    return {
      reference: parsed.data.reference,
      status:
        parsed.data.status === "success"
          ? "success"
          : parsed.data.status === "failed"
          ? "failed"
          : "pending",
      amountNgn: Math.round(parsed.data.amount / 100),
      userId: parsed.data.metadata?.userId,
      plan: parsed.data.metadata?.plan,
      paidAt: parsed.data.paid_at ?? undefined,
    };
  },
};
