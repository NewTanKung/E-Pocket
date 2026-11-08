import {
  getServiceSession,
  createHubLoginUrl,
  HubAuthError,
  type ServiceSession,
} from "@monolith/auth-client/server";
import { extractHubSessionFromCookie, type HubUser } from "@monolith/auth-client";

export type AuthOutcome =
  | {
      status: "AUTHENTICATED";
      user: HubUser;
      service: { id: string; slug: string };
      hubUrl: string;
      isDevSimulation?: boolean;
    }
  | {
      status: "UNAUTHENTICATED";
      loginUrl: string;
      hubUrl: string;
      allowDevSimulation: boolean;
    }
  | {
      status: "FORBIDDEN";
      message: string;
      hubUrl: string;
    }
  | {
      status: "UNAVAILABLE";
      message: string;
      hubUrl: string;
      allowDevSimulation: boolean;
    };

export interface AuthConfig {
  hubUrl: string;
  serviceToken: string;
  serviceId: string;
  serviceUrl: string;
  appEnv: string;
  allowDevMockAuth: boolean;
}

export function getAuthConfig(): AuthConfig {
  const hubUrl = process.env.HUB_URL || "http://localhost:3000";
  const serviceToken = process.env.MONOLITH_SERVICE_TOKEN || "";
  const serviceId = process.env.MONOLITH_SERVICE_ID || "e-pocket";
  const serviceUrl = process.env.SERVICE_URL || "http://localhost:3001";
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const allowDevMockAuth =
    appEnv !== "production" && process.env.ALLOW_DEV_MOCK_AUTH === "true";

  return {
    hubUrl,
    serviceToken,
    serviceId,
    serviceUrl,
    appEnv,
    allowDevMockAuth,
  };
}

function parseDevSimulationSession(
  cookieHeader: string | null | undefined,
): HubUser | null {
  const token = extractHubSessionFromCookie(cookieHeader);
  if (!token || !token.startsWith("dev_monolith_")) return null;
  try {
    const raw = Buffer.from(
      token.slice("dev_monolith_".length),
      "base64url",
    ).toString("utf8");
    const parsed = JSON.parse(raw) as Partial<HubUser>;
    if (
      typeof parsed.id === "string" &&
      parsed.id.length > 0 &&
      typeof parsed.email === "string" &&
      parsed.email.includes("@") &&
      (parsed.role === "MEMBER" || parsed.role === "ADMIN")
    ) {
      return {
        id: parsed.id,
        email: parsed.email,
        name: parsed.name ?? "สมาชิก Monolith",
        role: parsed.role,
        image: parsed.image ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function createDevSimulationCookieValue(user: HubUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image ?? null,
    }),
    "utf8",
  ).toString("base64url");
  return `dev_monolith_${payload}`;
}

export async function resolveMonolithAuth(
  cookieHeader: string | null | undefined,
  returnToUrl?: string,
  customConfig?: Partial<AuthConfig>,
): Promise<AuthOutcome> {
  const config = { ...getAuthConfig(), ...customConfig };
  const returnTo = returnToUrl || config.serviceUrl;

  if (config.allowDevMockAuth) {
    const devUser = parseDevSimulationSession(cookieHeader);
    if (devUser) {
      return {
        status: "AUTHENTICATED",
        user: devUser,
        service: { id: config.serviceId, slug: "e-pocket" },
        hubUrl: config.hubUrl,
        isDevSimulation: true,
      };
    }
  }

  let loginUrl = config.hubUrl;
  try {
    loginUrl = createHubLoginUrl({
      hubUrl: config.hubUrl,
      serviceId: config.serviceId,
      returnTo,
    });
  } catch {
    // Keep fallback if URL construction fails
  }

  if (!config.serviceToken) {
    return {
      status: "UNAVAILABLE",
      message: "ยังไม่ได้กำหนดค่า MONOLITH_SERVICE_TOKEN สำหรับเชื่อมต่อ Monolith Hub",
      hubUrl: config.hubUrl,
      allowDevSimulation: config.allowDevMockAuth,
    };
  }

  try {
    const session: ServiceSession = await getServiceSession(cookieHeader, {
      hubUrl: config.hubUrl,
      serviceToken: config.serviceToken,
    });

    // Enforce that E-Pocket requires an actual Monolith account (no anonymous Guest access)
    if (!session.user || !session.user.id || session.access.role === "GUEST") {
      return {
        status: "UNAUTHENTICATED",
        loginUrl,
        hubUrl: config.hubUrl,
        allowDevSimulation: config.allowDevMockAuth,
      };
    }

    return {
      status: "AUTHENTICATED",
      user: session.user,
      service: session.service,
      hubUrl: config.hubUrl,
    };
  } catch (error) {
    if (error instanceof HubAuthError) {
      if (error.status === 401 || error.code === "UNAUTHENTICATED") {
        return {
          status: "UNAUTHENTICATED",
          loginUrl,
          hubUrl: config.hubUrl,
          allowDevSimulation: config.allowDevMockAuth,
        };
      }
      if (error.status === 403) {
        return {
          status: "FORBIDDEN",
          message:
            "บัญชี Monolith ของคุณยังไม่มีสิทธิ์เข้าใช้งานบริการ E-Pocket หรือบริการถูกปิดชั่วคราว",
          hubUrl: config.hubUrl,
        };
      }
    }

    return {
      status: "UNAVAILABLE",
      message: "ไม่สามารถติดต่อระบบยืนยันตัวตน Monolith Hub ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
      hubUrl: config.hubUrl,
      allowDevSimulation: config.allowDevMockAuth,
    };
  }
}
