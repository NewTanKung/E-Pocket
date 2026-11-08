import { resolveMonolithAuth } from "./auth";
import type { HubUser } from "@monolith/auth-client";

export async function requireApiUser(
  request: Request,
): Promise<
  | { ok: true; user: HubUser; hubUrl: string }
  | { ok: false; response: Response }
> {
  const outcome = await resolveMonolithAuth(
    request.headers.get("cookie"),
    request.url,
  );

  if (outcome.status === "AUTHENTICATED") {
    return {
      ok: true,
      user: outcome.user,
      hubUrl: outcome.hubUrl,
    };
  }

  if (outcome.status === "UNAUTHENTICATED") {
    return {
      ok: false,
      response: Response.json(
        {
          error: "กรุณาเข้าสู่ระบบด้วยบัญชี Monolith ก่อนใช้งาน",
          code: "UNAUTHENTICATED",
          loginUrl: outcome.loginUrl,
        },
        { status: 401 },
      ),
    };
  }

  if (outcome.status === "FORBIDDEN") {
    return {
      ok: false,
      response: Response.json(
        {
          error: outcome.message,
          code: "FORBIDDEN",
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: false,
    response: Response.json(
      {
        error: outcome.message,
        code: "HUB_UNAVAILABLE",
      },
      { status: 503 },
    ),
  };
}
