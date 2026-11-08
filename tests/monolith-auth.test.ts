import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMonolithAuth } from "../src/lib/auth";

test("resolveMonolithAuth enforces Monolith account presence and rejects anonymous Guest access", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const baseConfig = {
    hubUrl: "http://localhost:3000",
    serviceToken: "service-secret-token",
    serviceId: "e-pocket",
    serviceUrl: "http://localhost:3001",
    appEnv: "production",
    allowDevMockAuth: false,
  };

  // 1. Authenticated MEMBER passes
  let capturedHeaders: Record<string, string> | undefined;
  globalThis.fetch = async (_input, init) => {
    capturedHeaders = init?.headers as Record<string, string>;
    return Response.json({
      user: {
        id: "user_monolith_1",
        email: "komdet@example.com",
        name: "Komdet",
        role: "MEMBER",
      },
      service: { id: "e-pocket", slug: "e-pocket" },
      access: { role: "MEMBER" },
    });
  };

  const authOk = await resolveMonolithAuth(
    "other=1; monolith_session=opaque_session_token",
    "http://localhost:3001/dashboard",
    baseConfig,
  );
  assert.equal(authOk.status, "AUTHENTICATED");
  if (authOk.status === "AUTHENTICATED") {
    assert.equal(authOk.user.id, "user_monolith_1");
    assert.equal(authOk.user.email, "komdet@example.com");
  }
  assert.deepEqual(capturedHeaders, {
    Authorization: "Bearer service-secret-token",
    Cookie: "monolith_session=opaque_session_token",
  });

  // 2. Guest session (user: null) is rejected as UNAUTHENTICATED and redirected to Hub login
  globalThis.fetch = async () =>
    Response.json({
      user: null,
      service: { id: "e-pocket", slug: "e-pocket" },
      access: { role: "GUEST" },
    });

  const guestOutcome = await resolveMonolithAuth(
    null,
    "http://localhost:3001",
    baseConfig,
  );
  assert.equal(guestOutcome.status, "UNAUTHENTICATED");
  if (guestOutcome.status === "UNAUTHENTICATED") {
    const redirectUrl = new URL(guestOutcome.loginUrl);
    assert.equal(redirectUrl.pathname, "/auth/continue");
    assert.equal(redirectUrl.searchParams.get("service"), "e-pocket");
    assert.equal(
      redirectUrl.searchParams.get("returnTo"),
      "http://localhost:3001",
    );
  }

  // 3. Hub 401 returns UNAUTHENTICATED
  globalThis.fetch = async () =>
    Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });

  const unauthOutcome = await resolveMonolithAuth(
    "monolith_session=expired",
    "http://localhost:3001",
    baseConfig,
  );
  assert.equal(unauthOutcome.status, "UNAUTHENTICATED");

  // 4. Hub 403 returns FORBIDDEN
  globalThis.fetch = async () =>
    Response.json({ code: "FORBIDDEN" }, { status: 403 });

  const forbiddenOutcome = await resolveMonolithAuth(
    "monolith_session=valid",
    "http://localhost:3001",
    baseConfig,
  );
  assert.equal(forbiddenOutcome.status, "FORBIDDEN");

  // 5. Network failure / Hub unreachable fails closed with UNAVAILABLE (503)
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };

  const unavailableOutcome = await resolveMonolithAuth(
    "monolith_session=valid",
    "http://localhost:3001",
    baseConfig,
  );
  assert.equal(unavailableOutcome.status, "UNAVAILABLE");
});
