import type { ExpenseCategory } from "@prisma/client";
import { requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema } from "@/lib/validation";
import {
  checkAndRecordBudgetAlert,
  getDashboardData,
  recalculateSheetExtraTotals,
} from "@/lib/ledger";
import { toSatang } from "@/lib/finance-engine";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: auth.user.id },
      include: { sheet: true },
    });
    if (!existing) {
      return Response.json({ error: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });
    }

    const raw = await request.json();
    const parsed = updateTransactionSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error:
            parsed.error.issues[0]?.message || "ข้อมูลสำหรับแก้ไขไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.type ? { type: parsed.data.type } : {}),
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(parsed.data.category
          ? { category: parsed.data.category as ExpenseCategory }
          : {}),
        ...(parsed.data.amountBaht !== undefined
          ? { amountSatang: toSatang(parsed.data.amountBaht) }
          : {}),
        ...(parsed.data.occurredAt
          ? { occurredAt: new Date(parsed.data.occurredAt) }
          : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      },
    });

    await recalculateSheetExtraTotals(existing.sheetId);
    await checkAndRecordBudgetAlert(auth.user.id, existing.sheet.yearMonth);

    const dashboard = await getDashboardData(
      auth.user,
      existing.sheet.yearMonth,
    );
    return Response.json({ ok: true, dashboard });
  } catch (error) {
    console.error("Transaction PATCH error:", error);
    return Response.json(
      { error: "ไม่สามารถแก้ไขรายการได้" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: auth.user.id },
      include: { sheet: true },
    });
    if (!existing) {
      return Response.json({ error: "ไม่พบรายการที่ต้องการลบ" }, { status: 404 });
    }

    await prisma.transaction.delete({ where: { id: existing.id } });
    await recalculateSheetExtraTotals(existing.sheetId);
    await checkAndRecordBudgetAlert(auth.user.id, existing.sheet.yearMonth);

    const dashboard = await getDashboardData(
      auth.user,
      existing.sheet.yearMonth,
    );
    return Response.json({ ok: true, dashboard });
  } catch (error) {
    console.error("Transaction DELETE error:", error);
    return Response.json(
      { error: "ไม่สามารถลบรายการได้" },
      { status: 500 },
    );
  }
}
