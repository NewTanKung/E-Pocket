import { DEFAULT_COOKIE_NAME } from "@monolith/auth-client";
import { createDevSimulationCookieValue, getAuthConfig } from "@/lib/auth";

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!config.allowDevMockAuth) {
    return Response.json(
      { error: "ไม่อนุญาตให้จำลอง Session ในโหมด Production" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "login" | "logout";
    name?: string;
    email?: string;
    role?: "MEMBER" | "ADMIN";
    userId?: string;
  };

  if (body.action === "logout") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${DEFAULT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
    });
  }

  const email = (body.email || "member@monolith.local").trim().toLowerCase();
  const userId =
    body.userId ||
    `monolith_${email.replace(/[^a-z0-9]/g, "_").slice(0, 24)}`;
  const cookieVal = createDevSimulationCookieValue({
    id: userId,
    email,
    name: body.name || "คุณคมเดช (Monolith Member)",
    role: body.role === "ADMIN" ? "ADMIN" : "MEMBER",
  });

  return new Response(JSON.stringify({ ok: true, userId }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${DEFAULT_COOKIE_NAME}=${encodeURIComponent(cookieVal)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
    },
  });
}
