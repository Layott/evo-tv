-- What the audit log could not tell you.
--
-- A row said who did it, what action, and to which target. It could not say
-- which hat they were wearing, which room the action belonged to, or what the
-- record looked like before and after. So "who changed the price" was
-- answerable and "what was it before" was not, and a role change on an account
-- read the same as any other update.
--
-- All nullable: every existing row predates these and is still a valid record
-- of what it does say.
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "actor_role" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "capability" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "before" jsonb;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "after" jsonb;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "ip" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "user_agent" text;

-- Reading the log is three questions: what did this person do, what happened to
-- this record, and what happened in this room. The first two had no index at
-- all, so both were a sequential scan over every action ever taken.
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_log" ("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_target_idx" ON "audit_log" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "audit_capability_idx" ON "audit_log" ("capability", "created_at");
