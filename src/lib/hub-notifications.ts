import type { AlertLevel } from "@prisma/client";
import {
  formatBaht,
  formatThaiMonthLabel,
  type ComputedMonthMetrics,
  type FinancialHealthStatus,
} from "./finance-engine";
import { getAuthConfig } from "./auth";

export interface HubNotificationPayload {
  userId: string;
  title: string;
  message: string;
  linkUrl?: string;
}

export function buildBudgetAlertContent(
  metrics: ComputedMonthMetrics,
  serviceUrl: string,
): { level: AlertLevel; title: string; message: string; linkUrl: string } | null {
  const status: FinancialHealthStatus = metrics.status;
  if (status === "HEALTHY") return null;

  const monthName = formatThaiMonthLabel(metrics.yearMonth);
  const linkUrl = `${serviceUrl.replace(/\/$/, "")}?month=${metrics.yearMonth}`;

  if (status === "CRITICAL") {
    return {
      level: "CRITICAL",
      title: `แจ้งเตือนการเงินวิกฤต (${monthName})`,
      message: `ยอดเงินคงเหลือสุทธิรวมติดลบ ${formatBaht(metrics.totalAvailableBalanceBaht)} กรุณาตรวจสอบรายการใช้จ่ายใน E-Pocket`,
      linkUrl,
    };
  }

  if (status === "OVERSPENT_MONTH") {
    return {
      level: "OVERSPENT_MONTH",
      title: `ใช้จ่ายเกินรายรับประจำเดือน (${monthName})`,
      message: `เดือนนี้ใช้จ่ายเกินรายรับ ${formatBaht(Math.abs(metrics.monthNetCashflowBaht))} (คงเหลือสุทธิรวมยอดทบ ${formatBaht(metrics.totalAvailableBalanceBaht)})`,
      linkUrl,
    };
  }

  return {
    level: "WARNING",
    title: `เงินคงเหลือใกล้ถึงเกณฑ์เฝ้าระวัง (${monthName})`,
    message: `เงินคงเหลือเดือนนี้ ${formatBaht(metrics.monthNetCashflowBaht)} (งบใช้จ่ายได้เฉลี่ย ${formatBaht(metrics.dailySafeToSpendBaht)}/วัน)`,
    linkUrl,
  };
}

export async function dispatchHubNotification(
  payload: HubNotificationPayload,
  customOptions?: { hubUrl?: string; serviceToken?: string },
): Promise<boolean> {
  const config = getAuthConfig();
  const hubUrl = customOptions?.hubUrl || config.hubUrl;
  const serviceToken = customOptions?.serviceToken || config.serviceToken;

  if (!hubUrl || !serviceToken) return false;

  try {
    const res = await fetch(new URL("/api/notifications", hubUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
