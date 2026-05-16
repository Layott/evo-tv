import "server-only";
import { Resend } from "resend";

import { log } from "@/lib/log";

const FROM = process.env.EMAIL_FROM ?? "EVO TV <noreply@evo.tv>";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let cachedResend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedResend) cachedResend = new Resend(key);
  return cachedResend;
}

/**
 * Send a transactional email. Falls back to console.log when
 * `RESEND_API_KEY` is unset so dev environments don't need a real provider
 * — the OTP is still printed so testers can copy it from the server log.
 *
 * Throws on Resend API error so call sites can surface the failure to the
 * user (Better-Auth surfaces this as a sign-up error toast).
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailParams): Promise<{ id: string }> {
  const resend = getResend();
  if (!resend) {
    log.info("email.send.console_fallback", { to, subject, preview: text });
    return { id: `console_${Date.now()}` };
  }
  const result = await resend.emails.send({ from: FROM, to, subject, text, html });
  if ("error" in result && result.error) {
    log.warn("email.send.failed", { to, subject, error: result.error });
    throw new Error(`Email send failed: ${result.error.message}`);
  }
  const id = (result as { data?: { id?: string } }).data?.id ?? "unknown";
  log.info("email.send.ok", { to, subject, id });
  return { id };
}
