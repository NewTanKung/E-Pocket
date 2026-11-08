import { requireApiUser } from "@/lib/api-auth";
import { updateFixedPlanSchema } from "@/lib/validation";
import { getDashboardData, updateUserFixedPlan } from "@/lib/ledger";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const dashboard = await getDashboardData(auth.user);
    return Response.json({
      fixedIncomes: dashboard.fixedIncomes,
      fixedExpenses: dashboard.fixedExpenses,
      warningThresholdPct: dashboard.warningThresholdPct,
    });
  } catch (error) {
    console.error("Fixed plan GET error:", error);
    return Response.json(
      { error: "ไม่สามารถโหลดแผนรายรับ-รายจ่ายคงที่ได้" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const raw = await request.json();
    const parsed = updateFixedPlanSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "ข้อมูลแผนรายรับ-รายจ่ายคงที่ไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    await updateUserFixedPlan(auth.user, parsed.data);
    const dashboard = await getDashboardData(
      auth.user,
      parsed.data.targetYearMonth,
    );
    return Response.json({ ok: true, dashboard });
  } catch (error) {
    console.error("Fixed plan PUT error:", error);
    return Response.json(
      { error: "ไม่สามารถอัปเดตแผนรายรับ-รายจ่ายคงที่ได้" },
      { status: 500 },
    );
  }
}
