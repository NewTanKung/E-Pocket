import type { HubUser, HubRole } from "./index";
export interface ServiceOptions {
  hubUrl: string;
  serviceToken: string;
  timeoutMs?: number;
}
export interface ServiceSession {
  user: HubUser | null;
  service: { id: string; slug: string };
  access: { role: HubRole };
}
export class HubAuthError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
    this.name = "HubAuthError";
  }
}
/** Server only: forward only the Monolith cookie and keep Service Token private. */
export async function getServiceSession(
  cookieHeader: string | null | undefined,
  options: ServiceOptions,
): Promise<ServiceSession> {
  const { extractHubSessionFromCookie } = await import("./index");
  const token = extractHubSessionFromCookie(cookieHeader);
  const base = new URL(options.hubUrl);
  if (
    base.username ||
    base.password ||
    !["http:", "https:"].includes(base.protocol) ||
    (base.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
  )
    throw new HubAuthError(503, "HUB_UNAVAILABLE");
  try {
    const res = await fetch(new URL("/api/integrations/session", base), {
      headers: {
        Authorization: `Bearer ${options.serviceToken}`,
        ...(token
          ? { Cookie: `monolith_session=${encodeURIComponent(token)}` }
          : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs || 5000),
    });
    const result = await res.json();
    if (!res.ok) throw new HubAuthError(res.status, result.code || "HUB_ERROR");
    if (
      !result.service?.id ||
      !["GUEST", "MEMBER", "ADMIN"].includes(result.access?.role) ||
      (result.user && (!result.user.id || !result.user.email))
    )
      throw new HubAuthError(503, "HUB_UNAVAILABLE");
    return result as ServiceSession;
  } catch (error) {
    if (error instanceof HubAuthError) throw error;
    throw new HubAuthError(503, "HUB_UNAVAILABLE");
  }
}
export function createHubLoginUrl(options: {
  hubUrl: string;
  serviceId: string;
  returnTo: string;
}) {
  const url = new URL("/auth/continue", options.hubUrl);
  url.searchParams.set("service", options.serviceId);
  url.searchParams.set("returnTo", options.returnTo);
  return url.href;
}
