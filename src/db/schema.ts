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
  numeric,
  uuid,
  pgEnum,
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

export const plans = pgTable("plans", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  created_at: timestamp()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  deleted_at: timestamp("deleted_at"),
});

export const plansRelations = relations(plans, ({ many }) => ({
  members: many(members),
  planBenefits: many(plans_benefits),
}));

export const members = pgTable("members", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  member_number: varchar({ length: 255 }).notNull(),
  active: boolean().default(false).notNull(),
  plan_id: integer()
    .notNull()
    .references(() => plans.id),
  created_at: timestamp()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  deleted_at: timestamp("deleted_at"),
});

export const membersRelations = relations(members, ({ one, many }) => ({
  plan: one(plans, {
    fields: [members.plan_id],
    references: [plans.id],
  }),
  claims: many(claims),
}));

export const benefits = pgTable("benefits", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  annual_limit: numeric(),
  created_at: timestamp()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  deleted_at: timestamp("deleted_at"),
});

export const benefitsRelations = relations(benefits, ({ many }) => ({
  benefitPlans: many(plans_benefits),
}));

export const plans_benefits = pgTable("plans_benefits", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  plan_id: integer()
    .notNull()
    .references(() => plans.id),
  benefit_id: integer()
    .notNull()
    .references(() => benefits.id),
  annual_limit: numeric(),
  is_excluded: boolean().default(true).notNull(),
  created_at: timestamp()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  deleted_at: timestamp("deleted_at"),
});

export const plansBenefitsRelations = relations(plans_benefits, ({ one }) => ({
  plan: one(plans, {
    fields: [plans_benefits.plan_id],
    references: [plans.id],
  }),
  benefit: one(benefits, {
    fields: [plans_benefits.benefit_id],
    references: [benefits.id],
  }),
}));

export const procedures = pgTable("procedures", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  code: varchar({ length: 255 }).notNull().unique(),
  benefit_id: integer()
    .notNull()
    .references(() => benefits.id),
  average_cost: numeric().notNull(),
  created_at: timestamp()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  deleted_at: timestamp("deleted_at"),
});

export const proceduresRelations = relations(procedures, ({ one, many }) => ({
  benefit: one(benefits, {
    fields: [procedures.benefit_id],
    references: [benefits.id],
  }),
  claims: many(claims),
}));

export const claimsStatusEnums = pgEnum("claims_status", [
  "APPROVED",
  "PARTIAL",
  "REJECTED",
]);

export const claims = pgTable("claims", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  claim_id: uuid().defaultRandom(),
  member_id: integer()
    .notNull()
    .references(() => members.id)
    .notNull(),
  claim_amount: numeric().notNull(),
  procedure_id: integer()
    .notNull()
    .references(() => procedures.id)
    .notNull(),
  diagnosis_code: varchar({ length: 255 }).notNull().unique(),
  fraud_flag: boolean().default(false).notNull(),
  approved_amount: numeric(),
  status: claimsStatusEnums(),
  created_at: timestamp()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  deleted_at: timestamp("deleted_at"),
});

export const claimsRelations = relations(claims, ({ one }) => ({
  procedure: one(procedures, {
    fields: [claims.procedure_id],
    references: [procedures.id],
  }),
  member: one(members, {
    fields: [claims.member_id],
    references: [members.id],
  }),
}));
