import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const drawStatus = pgEnum("draw_status", [
  "provisional",
  "confirmed",
  "corrected",
]);

export const ingestionStatus = pgEnum("ingestion_status", [
  "running",
  "succeeded",
  "failed",
]);

export const lotteries = pgTable("lotteries", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  totalNumbers: integer("total_numbers").notNull(),
  drawSize: integer("draw_size").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const draws = pgTable(
  "draws",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotteryId: uuid("lottery_id")
      .notNull()
      .references(() => lotteries.id, { onDelete: "restrict" }),
    contestNumber: integer("contest_number").notNull(),
    drawnAt: timestamp("drawn_at", { withTimezone: true }).notNull(),
    numbers: jsonb("numbers").$type<number[]>().notNull(),
    extras: jsonb("extras").$type<Record<string, unknown>>(),
    source: text("source").notNull(),
    status: drawStatus("status").default("provisional").notNull(),
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("draw_lottery_contest_unique").on(
      table.lotteryId,
      table.contestNumber,
    ),
    index("draw_lottery_date_idx").on(table.lotteryId, table.drawnAt),
  ],
);

export const prizeTiers = pgTable(
  "prize_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    hits: integer("hits").notNull(),
    extraHits: integer("extra_hits"),
    winners: integer("winners").default(0).notNull(),
    prize: numeric("prize", { precision: 16, scale: 2 }),
  },
  (table) => [index("prize_tier_draw_idx").on(table.drawId)],
);

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lotteryId: uuid("lottery_id")
      .notNull()
      .references(() => lotteries.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    targetContest: integer("target_contest"),
    mode: text("mode").default("manual").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("portfolio_user_idx").on(table.userId, table.createdAt)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    numbers: jsonb("numbers").$type<number[]>().notNull(),
    extras: jsonb("extras").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("ticket_portfolio_position_unique").on(
      table.portfolioId,
      table.position,
    ),
  ],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  status: ingestionStatus("status").default("running").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  receivedCount: integer("received_count").default(0).notNull(),
  error: text("error"),
});

export const sourcePayloads = pgTable(
  "source_payloads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drawId: uuid("draw_id").references(() => draws.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    hash: text("hash").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("source_payload_hash_unique").on(table.source, table.hash),
    index("source_payload_draw_idx").on(table.drawId),
  ],
);
