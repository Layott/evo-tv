import "server-only";
import { Resend } from "resend";

import { log } from "@/lib/log";
import { isMailConfigured, sendMail } from "./index";

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
 * Send a transactional email: Resend first, SMTP second, console last.
 *
 * This used Resend and nothing else, and threw when Resend refused. Production
 * had an invalid RESEND_API_KEY, so every password reset code and every
 * verification email failed with "API key is invalid" while a perfectly good
 * Gmail SMTP transport sat configured and unused in the same environment. From
 * the outside it looked like the emails simply never arrived.
 *
 * One provider is a single point of failure for the only channel that can get
 * a locked-out user back in. Two providers, tried in order, is the fix; the
 * failure of the first is logged rather than swallowed, so a bad key is still
 * visible instead of being quietly masked forever.
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailParams): Promise<{ id: string }> {
  const resend = getResend();

  if (resend) {
    try {
      const result = await resend.emails.send({
        from: FROM,
        to,
        subject,
        text,
        html,
      });
      if ("error" in result && result.error) {
        throw new Error(result.error.message);
      }
      const id = (result as { data?: { id?: string } }).data?.id ?? "unknown";
      log.info("email.send.ok", { to, subject, id, via: "resend" });
      return { id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Warn, do not throw: SMTP may still deliver it.
      log.warn("email.send.failed", { to, subject, via: "resend", error: message });
      if (!isMailConfigured()) {
        throw new Error(`Email send failed: ${message}`);
      }
    }
  }

  if (isMailConfigured()) {
    await sendMail({ to, subject, html, text });
    log.info("email.send.ok", { to, subject, id: "smtp", via: "smtp" });
    return { id: `smtp_${Date.now()}` };
  }

  // No provider at all. Print it so local development can read the code out of
  // the server log rather than needing an account anywhere.
  log.info("email.send.console_fallback", { to, subject, preview: text });
  return { id: `console_${Date.now()}` };
}
