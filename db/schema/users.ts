import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Better-Auth owned tables (singular names match adapter expectations).

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().default(""),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    // EVO TV additions
    role: text("role", { enum: ["user", "premium", "admin"] })
      .notNull()
      .default("user"),
    handle: text("handle").unique(),
  },
  (t) => [index("user_email_idx").on(t.email), index("user_handle_idx").on(t.handle)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
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
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// App-owned profile + prefs sit alongside Better-Auth `user`.

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url").notNull().default(""),
  bio: text("bio").notNull().default(""),
  country: text("country").notNull().default("NG"),
  onboardedAt: text("onboarded_at"),
  createdAt: text("created_at").notNull(),
});

export const userPrefs = pgTable("user_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  favoriteGames: jsonb("favorite_games").$type<string[]>().notNull().default([]),
  favoriteTeams: jsonb("favorite_teams").$type<string[]>().notNull().default([]),
  favoritePlayers: jsonb("favorite_players").$type<string[]>().notNull().default([]),
  notifOptIn: jsonb("notif_opt_in")
    .$type<{
      goLive: boolean;
      eventReminder: boolean;
      newVod: boolean;
      weeklyDigest: boolean;
    }>()
    .notNull(),
  playback: jsonb("playback")
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
