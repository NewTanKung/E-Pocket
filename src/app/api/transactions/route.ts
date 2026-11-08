import type { ExpenseCategory } from "@prisma/client";
import { requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createTransactionSchema } from "@/lib/validation";
import {
  checkAndRecordBudgetAlert,
  ensureMonthlySheet,
  getDashboardData,
  recalculateSheetExtraTotals,
} from "@/lib/ledger";
import { getCurrentYearMonth, toSatang } from "@/lib/finance-engine";

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const raw = await request.json();
    const parsed = createTransactionSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "ข้อมูลรายการรับ-จ่ายไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    const occurredDate = parsed.data.occurredAt
      ? new Date(parsed.data.occurredAt)
      : new Date();
    const resolvedDate = Number.isNaN(occurredDate.getTime())
      ? new Date()
      : occurredDate;

    const targetMonth =
      parsed.data.yearMonth || getCurrentYearMonth(resolvedDate);

    const sheet = await ensureMonthlySheet(auth.user.id, targetMonth);

    await prisma.transaction.create({
      data: {
        sheetId: sheet.id,
        userId: auth.user.id,
        type: parsed.data.type,
        title: parsed.data.title,
        category: parsed.data.category as ExpenseCategory,
        amountSatang: toSatang(parsed.data.amountBaht),
        occurredAt: resolvedDate,
        note: parsed.data.note || null,
      },
    });

    await recalculateSheetExtraTotals(sheet.id);
    await checkAndRecordBudgetAlert(auth.user.id, targetMonth);

    const dashboard = await getDashboardData(auth.user, targetMonth);
    return Response.json({ ok: true, dashboard }, { status: 201 });
  } catch (error) {
    console.error("Transaction POST error:", error);
    return Response.json(
      { error: "ไม่สามารถบันทึกรายการได้ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
