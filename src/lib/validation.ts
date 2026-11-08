import { z } from "zod";

const CATEGORY_ENUM = [
  "SALARY",
  "BONUS",
  "FREELANCE",
  "INVESTMENT",
  "OTHER_INCOME",
  "HOUSING",
  "UTILITIES",
  "FOOD",
  "TRANSPORT",
  "DEBT",
  "SUBSCRIPTION",
  "SHOPPING",
  "HEALTH",
  "ENTERTAINMENT",
  "SAVINGS",
  "OTHER_EXPENSE",
] as const;

export const fixedIncomeInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "กรุณาระบุชื่อรายรับคงที่").max(80),
  amountBaht: z
    .number()
    .finite()
    .min(0, "จำนวนเงินต้องไม่ติดลบ")
    .max(100_000_000),
  isPrimarySalary: z.boolean().default(false),
});

export const fixedExpenseInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "กรุณาระบุชื่อรายจ่ายคงที่").max(80),
  category: z.enum(CATEGORY_ENUM).default("OTHER_EXPENSE"),
  amountBaht: z
    .number()
    .finite()
    .min(0, "จำนวนเงินต้องไม่ติดลบ")
    .max(100_000_000),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const onboardingPayloadSchema = z.object({
  primarySalaryBaht: z
    .number()
    .finite()
    .min(0, "กรุณาระบุเงินเดือนคงที่")
    .max(100_000_000),
  primarySalaryTitle: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .default("เงินเดือนประจำ"),
  additionalFixedIncomes: z.array(fixedIncomeInputSchema).default([]),
  fixedExpenses: z.array(fixedExpenseInputSchema).default([]),
  warningThresholdPct: z.number().int().min(5).max(80).default(20),
});

export const updateFixedPlanSchema = z.object({
  fixedIncomes: z
    .array(fixedIncomeInputSchema)
    .min(1, "ต้องมีรายการรายรับคงที่อย่างน้อย 1 รายการ"),
  fixedExpenses: z.array(fixedExpenseInputSchema).default([]),
  warningThresholdPct: z.number().int().min(5).max(80).default(20),
  applyToCurrentMonth: z.boolean().default(true),
  targetYearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

export const createTransactionSchema = z.object({
  yearMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  type: z.enum(["INCOME", "EXPENSE"]),
  title: z.string().trim().min(1, "กรุณาระบุชื่อรายการ").max(100),
  category: z.enum(CATEGORY_ENUM),
  amountBaht: z
    .number()
    .finite()
    .positive("จำนวนเงินต้องมากกว่า 0")
    .max(100_000_000),
  occurredAt: z.string().optional(),
  note: z.string().trim().max(240).optional().nullable(),
});

export const updateTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  category: z.enum(CATEGORY_ENUM).optional(),
  amountBaht: z.number().finite().positive().max(100_000_000).optional(),
  occurredAt: z.string().optional(),
  note: z.string().trim().max(240).optional().nullable(),
});
