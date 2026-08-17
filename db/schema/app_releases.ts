import { pgTable, text, integer, index } from "drizzle-orm/pg-core";

/**
 * The builds available to download from the website.
 *
 * Before this, `/apps` could only offer whatever was baked into
 * `NEXT_PUBLIC_ANDROID_APK_URL` at image build time, which meant a new APK
 * needed a website redeploy to become downloadable and the page could never say
 * which version it was handing out. Every build so far has therefore lived on
 * one laptop and reached nobody.
 *
 * A row per build, read at request time. Publishing a build is an API call, so
 * the site is current the moment one lands and no redeploy is involved.
 *
 * The APK itself is not stored here. It goes to Spaces through the existing
 * presigned upload route and this holds the URL, because a 100 MB binary has no
 * business in Postgres.
 */
export const appReleases = pgTable(
  "app_releases",
  {
    id: text("id").primaryKey(),
    platform: text("platform", { enum: ["android", "ios"] }).notNull(),
    /** Marketing version, matching `expo.version`. Not unique: 0.1.0 for a while. */
    version: text("version").notNull(),
    /**
     * The build number, and the field that decides which release is current.
     * A date would not: two builds on one day are ordinary, and a clock that
     * moves backwards would silently promote an older binary.
     */
    buildNumber: integer("build_number").notNull(),
    /** The commit the binary was built from, so an install can be traced back. */
    commitSha: text("commit_sha").notNull(),
    fileUrl: text("file_url").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Optional release note shown under the download button. */
    notes: text("notes"),
    releasedAt: text("released_at").notNull(),
  },
  (t) => [
    // The only query this table serves: newest build for a platform.
    index("app_releases_platform_build_idx").on(t.platform, t.buildNumber),
  ],
);
