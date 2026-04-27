import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "1025", 10);
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    // Mailhog has no auth and no TLS by default. Only flip to secure for :465.
    secure: port === 465,
    ignoreTLS: port === 1025,
  });
  return cachedTransporter;
}

/**
 * Send a transactional email. If SMTP_HOST is not configured, falls back to
 * logging the payload so local development without Mailhog still works.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? "EVO TV <no-reply@evotv.local>";
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.log("[email:stub]", {
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return;
  }
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
