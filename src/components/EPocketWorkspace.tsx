"use client";

import React, { useState } from "react";
import type { DashboardDataDTO } from "@/lib/ledger";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { PocketDashboard } from "@/components/dashboard/PocketDashboard";

interface EPocketWorkspaceProps {
  initialDashboard: DashboardDataDTO;
  hubUrl: string;
  isDevSimulation?: boolean;
}

export function EPocketWorkspace({
  initialDashboard,
  hubUrl,
  isDevSimulation = false,
}: EPocketWorkspaceProps) {
  const [dashboard, setDashboard] =
    useState<DashboardDataDTO>(initialDashboard);

  if (!dashboard.onboardingCompleted) {
    return (
      <main id="main-content">
        <OnboardingWizard
          user={dashboard.user}
          hubUrl={hubUrl}
          onComplete={(updatedDashboard) => setDashboard(updatedDashboard)}
        />
      </main>
    );
  }

  return (
    <main id="main-content">
      <PocketDashboard
        initialDashboard={dashboard}
        hubUrl={hubUrl}
        isDevSimulation={isDevSimulation}
      />
    </main>
  );
}
