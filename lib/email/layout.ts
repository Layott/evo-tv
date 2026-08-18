import "server-only";

/**
 * One shell for every email EVO TV sends.
 *
 * The OTP mail was designed and the rest were not: verification and
 * change-of-address went out as bare paragraphs with a naked link, which is
 * both off-brand and the shape a phishing filter is most suspicious of. Rather
 * than copy that one template around, its layout lives here and every message
 * is a call with content.
 *
 * The rules it follows are the platform's own, not email conventions:
 *
 * - No hairlines. Separation is background steps and space, exactly as on the
 *   site. No bordered card, no rule above the footer, no boxed button.
 * - No glow, no gradient. Flat fills only.
 * - Palette sampled from the wordmark: mint on dark teal, straight off
 *   `globals.css`. Hex is inlined because email clients do not support custom
 *   properties.
 * - No em dashes, per the owner's standing rule.
 *
 * Table layout and inline styles are not a stylistic choice. Outlook renders
 * with Word's engine, which has no flexbox, no grid, and discards most of a
 * `<style>` block, so anything structural has to be a table and anything
 * visual has to be an attribute.
 */

const INK = "#05191b";
const SURFACE = "#0a2426";
const WELL = "#05191b";
const TEXT = "#eaf6f5";
const MUTED = "#9dbdb9";
const MINT = "#46e3ce";
const BLUE = "#42ace8";

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface EmailBlock {
  /** A paragraph of body copy. */
  text?: string;
  /**
   * A single call to action. Rendered as a filled button, and repeated
   * underneath as a plain URL: some clients strip the link from a styled
   * anchor, and a recipient who cannot click has to be able to copy.
   */
  cta?: { label: string; url: string };
  /**
   * A monospaced value the recipient reads back, such as a one-time code or an
   * order reference. Sits in a deeper well so it separates without a border.
   */
  code?: string;
  /** Label and value pairs, for receipts and confirmations. */
  rows?: Array<{ label: string; value: string }>;
}

export interface EmailContent {
  /** The grey line clients show beside the subject in the inbox list. */
  preheader: string;
  /** The one sentence that carries the message. */
  heading: string;
  blocks: EmailBlock[];
  /** Small print under the content. Typically why they received this. */
  footnote?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBlock(block: EmailBlock): string {
  if (block.text) {
    return `<p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:${TEXT};font-family:${SANS};">${block.text}</p>`;
  }

  if (block.code) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${WELL};border-radius:14px;margin:0 0 24px;">
      <tr><td align="center" style="padding:22px 16px;">
        <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;letter-spacing:0.16em;color:${MINT};font-weight:700;">${escapeHtml(
          block.code,
        )}</span>
      </td></tr>
    </table>`;
  }

  if (block.rows) {
    const rows = block.rows
      .map(
        (r, i) => `<tr>
          <td style="padding:${i === 0 ? "18px" : "10px"} 20px 10px;font-family:${SANS};font-size:14px;color:${MUTED};">${escapeHtml(r.label)}</td>
          <td align="right" style="padding:${i === 0 ? "18px" : "10px"} 20px 10px;font-family:${SANS};font-size:14px;color:${TEXT};font-weight:600;">${escapeHtml(r.value)}</td>
        </tr>`,
      )
      .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${WELL};border-radius:14px;margin:0 0 24px;">${rows}<tr><td colspan="2" style="height:10px;"></td></tr></table>`;
  }

  if (block.cta) {
    // Filled, not outlined, and the URL repeats below because some clients
    // strip styled anchors and a recipient who cannot click must be able to
    // copy.
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr><td style="background:${MINT};border-radius:12px;">
        <a href="${block.cta.url}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:700;color:${INK};text-decoration:none;">${escapeHtml(
          block.cta.label,
        )}</a>
      </td></tr>
    </table>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${MUTED};font-family:${SANS};word-break:break-all;">
      Or paste this into your browser: ${escapeHtml(block.cta.url)}
    </p>`;
  }

  return "";
}

/** The branded HTML for one message. */
export function renderEmailHtml(content: EmailContent): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
  </head>
  <body style="margin:0;padding:0;background:${INK};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
      content.preheader,
    )}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${INK};">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="max-width:480px;width:100%;background:${SURFACE};border-radius:20px;">
            <tr>
              <td style="padding:36px 32px 30px;">

                <p style="margin:0 0 26px;font-size:22px;line-height:1;color:${TEXT};font-weight:700;letter-spacing:-0.01em;font-family:${SANS};">
                  EVO<span style="color:${MINT};">&nbsp;TV</span>
                </p>

                <p style="margin:0 0 22px;font-size:21px;line-height:1.3;color:${TEXT};font-weight:700;letter-spacing:-0.015em;font-family:${SANS};">
                  ${content.heading}
                </p>

                ${content.blocks.map(renderBlock).join("\n")}

                ${
                  content.footnote
                    ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${MUTED};font-family:${SANS};">${content.footnote}</p>`
                    : ""
                }

              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED};font-family:${SANS};">
            EVO TV, Lagos &middot; <span style="color:${BLUE};">evotv.co</span>
          </p>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * The plain-text twin.
 *
 * Not an afterthought: a message with no text part is scored as spam by most
 * filters, and some corporate clients render nothing else.
 */
export function renderEmailText(content: EmailContent): string {
  const lines: string[] = [content.heading, ""];
  for (const block of content.blocks) {
    if (block.text) lines.push(stripTags(block.text), "");
    if (block.code) lines.push(`    ${block.code}`, "");
    if (block.rows) {
      for (const r of block.rows) lines.push(`${r.label}: ${r.value}`);
      lines.push("");
    }
    if (block.cta) lines.push(`${block.cta.label}: ${block.cta.url}`, "");
  }
  if (content.footnote) lines.push(stripTags(content.footnote), "");
  lines.push("EVO TV, Lagos");
  return lines.join("\n");
}

/** Body copy may carry a little markup for emphasis; text gets it flattened. */
function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}
