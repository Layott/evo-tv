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
          ? `Reset your ${appName} password — code ${otp}`
          : `Confirm your new ${appName} email — code ${otp}`;

  const text = [
    `Your 6-digit code to ${intent}: ${otp}`,
    `It expires in ${expiryMinutes} minutes.`,
    "",
    `If you didn't request this, ignore this email.`,
    "",
    `— ${appName}`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width:480px;background:#121212;border-radius:16px;border:1px solid #262626;padding:32px;">
            <tr>
              <td>
                <h1 style="margin:0 0 12px;font-size:18px;color:#fafafa;font-weight:700;">
                  ${appName}
                </h1>
                <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.5;">
                  Use the code below to ${intent}. It expires in
                  <strong style="color:#fafafa;">${expiryMinutes} minutes</strong>.
                </p>
                <div style="background:#0a0a0a;border:1px solid #2CD7E3;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;color:#67e8f9;text-transform:uppercase;font-weight:600;">
                    ${
                      type === "email-verification"
                        ? "Verification"
                        : type === "sign-in"
                          ? "Sign-in"
                          : type === "forget-password"
                            ? "Reset"
                            : "Confirm"
                    } code
                  </p>
                  <p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;color:#fafafa;font-weight:700;letter-spacing:8px;">
                    ${otp}
                  </p>
                </div>
                <p style="margin:0;font-size:12px;color:#737373;line-height:1.5;">
                  Didn't request this? Ignore this email and the code will expire on its own. No further action needed.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#525252;">
            Sent by ${appName} · evo.tv
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
