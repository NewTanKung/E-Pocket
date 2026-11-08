import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveMonolithAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/ledger";
import { MonolithAccessGate } from "@/components/auth/MonolithAccessGate";
import { EPocketWorkspace } from "@/components/EPocketWorkspace";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    noRedirect?: string;
    demo?: "onboarding" | "dashboard";
  }>;
}) {
  const reqHeaders = await headers();
  let cookieHeader = reqHeaders.get("cookie");
  const params = await searchParams;

  if (
    process.env.ALLOW_DEV_MOCK_AUTH === "true" &&
    process.env.APP_ENV !== "production" &&
    params.demo
  ) {
    const { createDevSimulationCookieValue } = await import("@/lib/auth");
    const demoId =
      params.demo === "onboarding"
        ? "demo_onboarding_user"
        : "demo_dashboard_user";
    const simCookie = createDevSimulationCookieValue({
      id: demoId,
      email: `${params.demo}@monolith.local`,
      name: "คุณคมเดช (Monolith Account)",
      role: "MEMBER",
    });
    cookieHeader = `monolith_session=${encodeURIComponent(simCookie)}`;
  }

  const outcome = await resolveMonolithAuth(cookieHeader);

  if (outcome.status === "UNAUTHENTICATED") {
    // In production when accessed without session, redirect directly to Monolith Hub SSO login URL
    if (!outcome.allowDevSimulation && params.noRedirect !== "1") {
      redirect(outcome.loginUrl);
    }
    return (
      <MonolithAccessGate
        mode="UNAUTHENTICATED"
        loginUrl={outcome.loginUrl}
        hubUrl={outcome.hubUrl}
        allowDevSimulation={outcome.allowDevSimulation}
      />
    );
  }

  if (outcome.status === "FORBIDDEN") {
    return (
      <MonolithAccessGate
        mode="FORBIDDEN"
        hubUrl={outcome.hubUrl}
        message={outcome.message}
      />
    );
  }

  if (outcome.status === "UNAVAILABLE") {
    return (
      <MonolithAccessGate
        mode="UNAVAILABLE"
        hubUrl={outcome.hubUrl}
        message={outcome.message}
        allowDevSimulation={outcome.allowDevSimulation}
      />
    );
  }

  const dashboard = await getDashboardData(outcome.user, params.month);

  return (
    <EPocketWorkspace
      initialDashboard={dashboard}
      hubUrl={outcome.hubUrl}
      isDevSimulation={outcome.isDevSimulation}
    />
  );
}
