import { and, eq } from "drizzle-orm";
import { db } from "..";
import { benefits, plans_benefits, procedures } from "../db/schema";
import { HttpError } from "./error";
import { integer } from "drizzle-orm/pg-core";

export async function calculateBenefitLimit(
  plan_id: number,
  claim_amount: number,
  benefit_id: number,
) {
  let status, amount_approved;
  // fetch benefit id from plans benefits
  let [plan_benefit] = await db
    .select({
      annual_limit: plans_benefits.annual_limit,
      is_excluded: plans_benefits.is_excluded,
    })
    .from(plans_benefits)
    .where(
      and(
        eq(plans_benefits.plan_id, plan_id),
        eq(plans_benefits.benefit_id, benefit_id),
      ),
    );

  // compare annual limit now to the claim amount
  if (!plan_benefit) {
    status = "REJECTED";
    amount_approved = 0;
  }

  if (!plan_benefit.annual_limit || plan_benefit.is_excluded) {
    status = "REJECTED";
    amount_approved = 0;
  }

  if (Number(plan_benefit.annual_limit) < claim_amount) {
    status = "PARTIAL";
    amount_approved = claim_amount - Number(plan_benefit.annual_limit);
  }

  if (Number(plan_benefit.annual_limit) > claim_amount) {
    status = "APPROVED";
    amount_approved = claim_amount;
  }

  return { status, amount_approved };
}

export async function calculateFraud(
  claim_amount: number,
  procedure: {
    id: number;
    code: string;
    benefit_id: number;
    average_cost: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
  },
) {
  if (claim_amount > Number(procedure.average_cost) * 2) {
    return true;
  }
  return false;
}
