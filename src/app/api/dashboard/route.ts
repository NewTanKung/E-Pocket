import { requireApiUser } from "@/lib/api-auth";
import { getDashboardData } from "@/lib/ledger";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const month = url.searchParams.get("month") || undefined;
    const dashboard = await getDashboardData(auth.user, month);
    return Response.json({ dashboard });
  } catch (error) {
    console.error("Dashboard GET error:", error);
    return Response.json(
      { error: "ไม่สามารถโหลดข้อมูลแดชบอร์ดการเงินได้" },
      { status: 500 },
    );
  }
}
