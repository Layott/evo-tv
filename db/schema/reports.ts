import { pgTable, text, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * User-submitted reports against streams / VODs / clips / users / chat
 * messages. Moderation queue lives on this table.
 *
 * Status state machine: `open` → `resolved` | `dismissed`. `resolved` implies
 * the moderator took an action (delete, ban, sanction); `dismissed` implies
 * the report was reviewed but no action warranted.
 */
export const contentReports = pgTable(
  "content_reports",
  {
    id: text("id").primaryKey(),
    /** Null if anonymous report (rare - most are authed). */
    reporterUserId: text("reporter_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** 'stream' | 'vod' | 'clip' | 'user' | 'chat_message' | 'party' */
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    /** 'spam' | 'abuse' | 'copyright' | 'illegal' | 'csam' | 'impersonation' | 'other' */
    category: text("category").notNull(),
    details: text("details"),
    /** 'open' | 'resolved' | 'dismissed' */
    status: text("status").notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => user.id),
    resolvedAt: text("resolved_at"),
    resolutionNotes: text("resolution_notes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("content_reports_status_idx").on(t.status, t.createdAt),
    index("content_reports_target_idx").on(t.targetType, t.targetId),
    index("content_reports_reporter_idx").on(t.reporterUserId),
  ],
);

export type ContentReport = typeof contentReports.$inferSelect;
