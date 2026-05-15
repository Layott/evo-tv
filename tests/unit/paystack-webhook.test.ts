import { beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { paystack } from "@/lib/payments/paystack";

const TEST_SECRET = "sk_test_unit_test_secret";

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
});

function sign(body: string): string {
  return crypto.createHmac("sha512", TEST_SECRET).update(body).digest("hex");
}

describe("paystack.handleWebhook", () => {
  it("accepts a correctly-signed success event", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: {
        reference: "ref_smoke_1",
        status: "success",
        amount: 5000_00, // 5000 NGN in kobo
        paid_at: "2026-05-15T20:00:00.000Z",
        metadata: { userId: "user_x" },
      },
    });
    const sig = sign(body);
    const result = await paystack.handleWebhook(body, sig);
    expect(result.reference).toBe("ref_smoke_1");
    expect(result.status).toBe("success");
    expect(result.amountNgn).toBe(5000);
    expect(result.userId).toBe("user_x");
  });

  it("rejects a missing signature header", async () => {
    await expect(paystack.handleWebhook("{}", null)).rejects.toThrow(
      "Missing x-paystack-signature header",
    );
  });

  it("rejects a tampered body", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: {
        reference: "ref_smoke_2",
        status: "success",
        amount: 1000_00,
        paid_at: "",
      },
    });
    const sig = sign(body);
    const tampered = body.replace("success", "failed");
    await expect(paystack.handleWebhook(tampered, sig)).rejects.toThrow(
      "Bad signature",
    );
  });

  it("rejects a sig of wrong length", async () => {
    await expect(paystack.handleWebhook("{}", "deadbeef")).rejects.toThrow(
      "Bad signature",
    );
  });

  it("maps non-success statuses correctly", async () => {
    const body = JSON.stringify({
      event: "charge.failed",
      data: {
        reference: "ref_fail",
        status: "failed",
        amount: 100_00,
        paid_at: null,
      },
    });
    const sig = sign(body);
    const result = await paystack.handleWebhook(body, sig);
    expect(result.status).toBe("failed");
    expect(result.amountNgn).toBe(100);
  });

  it("maps unknown status to pending", async () => {
    const body = JSON.stringify({
      event: "charge.pending",
      data: {
        reference: "ref_p",
        status: "wat",
        amount: 50_00,
        paid_at: null,
      },
    });
    const sig = sign(body);
    const result = await paystack.handleWebhook(body, sig);
    expect(result.status).toBe("pending");
  });
});
