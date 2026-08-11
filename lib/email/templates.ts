import "server-only";

export type EmailOtpType =
  | "email-verification"
  | "sign-in"
  | "forget-password"
  | "change-email";

interface OtpTemplateParams {
  otp: string;
  type: EmailOtpType;
  appName?: string;
  expiryMinutes?: number;
}

interface RenderedTemplate {
  subject: string;
  text: string;
  html: string;
}

/**
 * Render the transactional OTP email body. Keep this in code rather than the
 * `email_templates` DB table for now — Better-Auth fires synchronously and
 * we want to keep latency low. Once the admin email-template UI is widely
 * used we can fall back to DB lookup with this as the default.
 */
export function renderOtpEmail({
  otp,
  type,
  appName = "EVO TV",
  expiryMinutes = 10,
}: OtpTemplateParams): RenderedTemplate {
  const intent =
    type === "email-verification"
      ? "verify your email"
      : type === "sign-in"
        ? "sign in"
        : type === "forget-password"
          ? "reset your password"
          : "confirm your new email";
  const subject =
    type === "email-verification"
      ? `Your ${appName} verification code: ${otp}`
      : type === "sign-in"
        ? `Your ${appName} sign-in code: ${otp}`
        : type === "forget-password"
          ? `Reset your ${appName} password: code ${otp}`
          : `Confirm your new ${appName} email: code ${otp}`;

  const text = [
    `Your 6-digit code to ${intent}: ${otp}`,
    `It expires in ${expiryMinutes} minutes.`,
    "",
    `If you didn't request this, ignore this email.`,
    "",
    appName,
  ].join("\n");

  /*
   * Set like the landing page, not like a dashboard.
   *
   * The previous version broke three rules the owner set by rejecting concrete
   * work: a hairline border around the card and again around the code, a
   * tracked-out uppercase eyebrow reading "RESET CODE", and a cyan that was
   * picked rather than sampled. It also signed off as "evo.tv", a domain that
   * is not ours, and put an em dash in the subject line.
   *
   * Separation here comes from background and type scale, the same way it does
   * on the site: ink, a raised panel, a deeper well for the code. No rules, no
   * boxes, no eyebrow. The sentence above the code already says what the code
   * is for, so labelling it again was decoration pretending to be information.
   *
   * Palette is the wordmark's, straight off `globals.css`. Hex is inlined
   * because email clients do not support custom properties.
   *
   * Table layout and inline styles are not stylistic choices: Outlook still
   * renders with Word's engine, which has no flexbox, no grid, and drops most
   * of a <style> block.
   */
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
  </head>
  <body style="margin:0;padding:0;background:#05191b;">
    <!-- Preheader: the grey line clients show next to the subject. Hidden in
         the body itself, otherwise the code appears twice. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your code is ${otp} and it expires in ${expiryMinutes} minutes.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#05191b;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="460" style="max-width:460px;width:100%;background:#0a2426;border-radius:20px;">
            <tr>
              <td style="padding:36px 32px 32px;font-family:Georgia,'Times New Roman',serif;">

                <p style="margin:0 0 28px;font-size:22px;line-height:1;color:#eaf6f5;font-weight:700;letter-spacing:-0.01em;">
                  EVO<span style="color:#46e3ce;">&nbsp;TV</span>
                </p>

                <p style="margin:0 0 28px;font-size:17px;line-height:1.5;color:#eaf6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  Use this code to ${intent}. It expires in ${expiryMinutes} minutes.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#05191b;border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:26px 16px;">
                      <span style="font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:1;color:#46e3ce;font-weight:700;letter-spacing:10px;">${otp}</span>
                    </td>
                  </tr>
                </table>

                <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#9fbdbd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  Didn't ask for this? Ignore it. The code expires on its own and nothing changes.
                </p>

              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0;font-size:12px;color:#6d8a8a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            ${appName} &middot; evotv.co
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
