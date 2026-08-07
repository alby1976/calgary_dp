import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const canliiMetadataCache = sqliteTable("canlii_metadata_cache", {
  appealNumber: text("appeal_number").primaryKey(),
  status: text("status").notNull(),
  payload: text("payload"),
  fetchedAt: integer("fetched_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const canliiRateState = sqliteTable("canlii_rate_state", {
  id: integer("id").primaryKey(),
  leaseUntil: integer("lease_until").notNull().default(0),
  lastStartedAt: integer("last_started_at").notNull().default(0),
});

export const canliiRequestLog = sqliteTable(
  "canlii_request_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestedAt: integer("requested_at").notNull(),
  },
  (table) => [index("canlii_request_log_requested_at_idx").on(table.requestedAt)],
);
