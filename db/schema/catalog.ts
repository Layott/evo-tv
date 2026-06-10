import { pgTable, text, integer, boolean, index } from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  coverUrl: text("cover_url").notNull(),
  iconUrl: text("icon_url").notNull(),
  category: text("category", { enum: ["br", "fps", "moba", "sports", "fighting"] }).notNull(),
  platform: text("platform", { enum: ["mobile", "pc", "console"] }).notNull(),
  activePlayers: integer("active_players").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
});

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tag: text("tag").notNull(),
    logoUrl: text("logo_url").notNull(),
    country: text("country").notNull(),
    region: text("region").notNull(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    ranking: integer("ranking").notNull().default(0),
    followers: integer("followers").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
  },
  (t) => [index("teams_game_idx").on(t.gameId)],
);

export const players = pgTable(
  "players",
  {
    id: text("id").primaryKey(),
    handle: text("handle").notNull(),
    realName: text("real_name").notNull(),
    avatarUrl: text("avatar_url").notNull(),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    country: text("country").notNull(),
    kda: integer("kda_x100").notNull().default(0),
    followers: integer("followers").notNull().default(0),
  },
  (t) => [index("players_team_idx").on(t.teamId), index("players_game_idx").on(t.gameId)],
);
