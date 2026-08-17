-- A product can belong to a show.
--
-- The shop and the catalogue have been two separate worlds: a jersey knows
-- which team it belongs to (`products.team_id`) and nothing knows which show a
-- piece of merchandise came out of. So a viewer reading about a programme is
-- never told there is a hoodie for it, and the shop cannot say where a product
-- comes from.
--
-- Nullable on purpose. Most stock is not tied to a programme, and a product
-- that loses its show should keep selling rather than disappear, which is why
-- this is `set null` rather than a cascade.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "show_id" text;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "products"
		ADD CONSTRAINT "products_show_id_shows_id_fk"
		FOREIGN KEY ("show_id") REFERENCES "shows"("id")
		ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- The only query this column serves is "what is in the shop for this show",
-- and it is asked on a page a viewer is waiting on.
CREATE INDEX IF NOT EXISTS "products_show_idx" ON "products" USING btree ("show_id");
