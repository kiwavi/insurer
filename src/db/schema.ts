import {
  integer,
  pgTable,
  varchar,
  timestamp,
  boolean,
  text,
  uniqueIndex,
  bigint,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { isNull, relations, sql } from "drizzle-orm";

// users table
export const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    phone_number: varchar({ length: 255 }).unique(),
    activated: boolean().default(false).notNull(),
    created_at: timestamp()
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updated_at: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
    deleted_at: timestamp("deleted_at"),
    password_hash: text("password_hash"),
    hashed_verification_code: integer(),
    profile_picture: text(),
  },
  (table) => [
    // partial unique index that enforces uniqueness for active users
    uniqueIndex("user_softdelete_idx")
      .on(table.email, table.phone_number)
      .where(isNull(table.deleted_at)),
  ],
);
