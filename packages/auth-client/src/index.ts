import { jwtVerify, SignJWT } from "jose";

export const ROLES = ["GUEST", "MEMBER", "ADMIN"] as const;
export type HubRole = (typeof ROLES)[number];
export interface HubUser {
  id: string;
  email: string;
  name: string | null;
  role: HubRole;
  image?: string | null;
}
export const DEFAULT_COOKIE_NAME = "monolith_session";
const ISSUER = "monolith-hub";
const AUDIENCE = "monolith-apps";

function secretKey(customSecret?: string): Uint8Array {
  const secret = customSecret ?? process.env.MONOLITH_JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("MONOLITH_JWT_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}
export function isHubRole(value: unknown): value is HubRole {
  return ROLES.includes(value as HubRole);
}
export function hasRequiredRole(
  role: HubRole | undefined,
  minimum: HubRole,
): boolean {
  return ROLES.indexOf(role ?? "GUEST") >= ROLES.indexOf(minimum);
}
/** @deprecated Legacy JWT helper. New Hub sessions use server-side introspection. */
export async function signHubToken(
  user: HubUser,
  customSecret?: string,
  expiresIn = "7d",
): Promise<string> {
  if (!isHubRole(user.role)) throw new Error("Invalid session role.");
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey(customSecret));
}
export async function verifyHubToken(
  token: string,
  customSecret?: string,
): Promise<HubUser | null> {
  // Configuration errors must fail loudly instead of silently using an insecure key.
  const key = secretKey(customSecret);
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ["sub", "email", "role", "iat", "exp"],
    });
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.email !== "string" ||
      !payload.email ||
      !isHubRole(payload.role) ||
      (payload.name != null && typeof payload.name !== "string") ||
      (payload.image != null && typeof payload.image !== "string")
    )
      return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: (payload.name as string | null) ?? null,
      image: (payload.image as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
export function extractHubSessionFromCookie(
  cookieHeader: string | null | undefined,
  cookieName = DEFAULT_COOKIE_NAME,
): string | null {
  for (const cookie of cookieHeader?.split(";") ?? []) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(cookieName + "=")) {
      try {
        return decodeURIComponent(trimmed.slice(cookieName.length + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
/** @deprecated Does not verify the new opaque sessions. Use getServiceSession from /server. */
export async function verifyHubSession(
  cookieHeader: string | null | undefined,
  customSecret?: string,
  cookieName = DEFAULT_COOKIE_NAME,
): Promise<HubUser | null> {
  const token = extractHubSessionFromCookie(cookieHeader, cookieName);
  return token ? verifyHubToken(token, customSecret) : null;
}
