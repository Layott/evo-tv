import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Better-Auth owned tables (singular names match adapter expectations).

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().default(""),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    // EVO TV additions
    role: text("role", { enum: ["user", "premium", "admin"] })
      .notNull()
      .default("user"),
    handle: text("handle").unique(),
  },
  (t) => [index("user_email_idx").on(t.email), index("user_handle_idx").on(t.handle)]
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("account_user_idx").on(t.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

// App-owned profile + prefs sit alongside Better-Auth `user`.

export const profiles = sqliteTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url").notNull().default(""),
    bio: text("bio").notNull().default(""),
    country: text("country").notNull().default("NG"),
    onboardedAt: text("onboarded_at"),
    createdAt: text("created_at").notNull(),
  }
);

export const userPrefs = sqliteTable("user_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  favoriteGames: text("favorite_games", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  favoriteTeams: text("favorite_teams", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  favoritePlayers: text("favorite_players", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  notifOptIn: text("notif_opt_in", { mode: "json" })
    .$type<{
      goLive: boolean;
      eventReminder: boolean;
      newVod: boolean;
      weeklyDigest: boolean;
    }>()
    .notNull(),
  playback: text("playback", { mode: "json" })
    .$type<{
      defaultQuality: "auto" | "1080p" | "720p" | "480p" | "360p";
      captions: boolean;
      autoplay: boolean;
    }>()
    .notNull(),
  language: text("language").notNull().default("en"),
  theme: text("theme", { enum: ["system", "light", "dark"] })
    .notNull()
    .default("system"),
});

export const usersRelations = relations(user, ({ one }) => ({
  profile: one(profiles, { fields: [user.id], references: [profiles.userId] }),
  prefs: one(userPrefs, { fields: [user.id], references: [userPrefs.userId] }),
}));
