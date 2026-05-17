CREATE TABLE "vod_bookmarks" (
	"user_id" text NOT NULL,
	"vod_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vod_bookmarks" ADD CONSTRAINT "vod_bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vod_bookmarks" ADD CONSTRAINT "vod_bookmarks_vod_id_vods_id_fk" FOREIGN KEY ("vod_id") REFERENCES "public"."vods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vod_bookmarks" ADD CONSTRAINT "vod_bookmarks_user_id_vod_id_pk" PRIMARY KEY ("user_id","vod_id");--> statement-breakpoint
CREATE INDEX "vod_bookmarks_user_idx" ON "vod_bookmarks" USING btree ("user_id","created_at");
