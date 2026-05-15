import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Versioned email templates keyed by short slugs (e.g. "welcome",
 * "password-reset", "tip-receipt"). Each save creates a new version; the
 * latest version is rendered when sending mail.
 */
export const emailTemplates = pgTable(
  "email_templates",
  {
    key: text("key").primaryKey(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body").notNull().default(""),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("email_templates_updated_idx").on(t.updatedAt)],
);

export type EmailTemplate = typeof emailTemplates.$inferSelect;
