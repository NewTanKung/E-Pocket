import { requireApiUser } from "@/lib/api-auth";
import { onboardingPayloadSchema } from "@/lib/validation";
import { completeUserOnboarding, getDashboardData } from "@/lib/ledger";

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const raw = await request.json();
    const parsed = onboardingPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "ข้อมูลการตั้งค่าเริ่มต้นไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    await completeUserOnboarding(auth.user, parsed.data);
    const dashboard = await getDashboardData(auth.user);
    return Response.json({ ok: true, dashboard });
  } catch (error) {
    console.error("Onboarding POST error:", error);
    return Response.json(
      { error: "ไม่สามารถบันทึกการตั้งค่าเริ่มต้นได้ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
