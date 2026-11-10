import { bigint, pgTable, text } from "drizzle-orm/pg-core";

/**
 * The entire database schema. One table. Aggregate counters only.
 * No users, no files, no fingerprints, no timestamps of individual events.
 */
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: bigint("value", { mode: "number" }).notNull().default(0),
});
