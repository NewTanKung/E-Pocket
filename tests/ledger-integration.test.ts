import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  completeUserOnboarding,
  getDashboardData,
  ensureMonthlySheet,
  recalculateSheetExtraTotals,
  checkAndRecordBudgetAlert,
} from "../src/lib/ledger";
import { toSatang, shiftYearMonth, getCurrentYearMonth } from "../src/lib/finance-engine";

test("Database integration: onboarding, additional transactions, month-to-month rollover, and Hub alert deduplication", async (t) => {
  const testUser = {
    id: `test_user_${Date.now()}`,
    email: "integration@monolith.test",
    name: "ผู้ทดสอบ E-Pocket",
    role: "MEMBER" as const,
  };

  const originalFetch = globalThis.fetch;
  const hubNotificationsSent: unknown[] = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/api/notifications")) {
      hubNotificationsSent.push(JSON.parse(String(init?.body || "{}")));
      return Response.json({ ok: true }, { status: 201 });
    }
    return originalFetch(url, init);
  };

  t.after(async () => {
    globalThis.fetch = originalFetch;
    await prisma.financialProfile
      .delete({ where: { userId: testUser.id } })
      .catch(() => undefined);
  });

  // 1. Before onboarding, onboardingCompleted is false
  const initialData = await getDashboardData(testUser);
  assert.equal(initialData.onboardingCompleted, false);

  // 2. Complete onboarding with 40,000 salary and 15,000 fixed expenses (25,000 baseline remaining)
  await completeUserOnboarding(testUser, {
    primarySalaryTitle: "เงินเดือนประจำ",
    primarySalaryBaht: 40000,
    additionalFixedIncomes: [{ title: "ค่าตำแหน่ง", amountBaht: 5000 }],
    fixedExpenses: [
      { title: "ค่าเช่าคอนโด", category: "HOUSING", amountBaht: 10000, dueDay: 1 },
      { title: "ค่าไฟและอินเทอร์เน็ต", category: "UTILITIES", amountBaht: 5000, dueDay: 15 },
    ],
    warningThresholdPct: 20,
  });

  const currentYm = getCurrentYearMonth();
  const afterOnboarding = await getDashboardData(testUser, currentYm);
  assert.equal(afterOnboarding.onboardingCompleted, true);
  assert.equal(afterOnboarding.currentMetrics.fixedIncomeBaht, 45000);
  assert.equal(afterOnboarding.currentMetrics.fixedExpenseBaht, 15000);
  assert.equal(afterOnboarding.currentMetrics.baselineRemainingBaht, 30000);
  assert.equal(afterOnboarding.currentMetrics.totalAvailableBalanceBaht, 30000);
  assert.equal(afterOnboarding.currentMetrics.status, "HEALTHY");

  // 3. Add extra income (+3,000) and extra expense (-8,000) in current month
  const currentSheet = await ensureMonthlySheet(testUser.id, currentYm);
  await prisma.transaction.createMany({
    data: [
      {
        sheetId: currentSheet.id,
        userId: testUser.id,
        type: "INCOME",
        title: "งานฟรีแลนซ์",
        category: "FREELANCE",
        amountSatang: toSatang(3000),
      },
      {
        sheetId: currentSheet.id,
        userId: testUser.id,
        type: "EXPENSE",
        title: "ค่าอาหารและสังสรรค์",
        category: "FOOD",
        amountSatang: toSatang(8000),
      },
    ],
  });
  await recalculateSheetExtraTotals(currentSheet.id);

  const afterTx = await getDashboardData(testUser, currentYm);
  // 30,000 baseline + 3,000 extra income - 8,000 extra expense = 25,000 net cashflow
  assert.equal(afterTx.currentMetrics.monthNetCashflowBaht, 25000);
  assert.equal(afterTx.currentMetrics.totalAvailableBalanceBaht, 25000);

  // 4. Advance to next month and verify automatic rollover (+25,000 carried over + 30,000 new baseline = 55,000)
  const nextYm = shiftYearMonth(currentYm, 1);
  const nextMonthDashboard = await getDashboardData(testUser, nextYm);
  assert.equal(nextMonthDashboard.currentMetrics.carryOverBaht, 25000);
  assert.equal(nextMonthDashboard.currentMetrics.baselineRemainingBaht, 30000);
  assert.equal(
    nextMonthDashboard.currentMetrics.totalAvailableBalanceBaht,
    55000,
  );

  // 5. Trigger WARNING alert in currentYm and verify deduplication
  await prisma.transaction.create({
    data: {
      sheetId: currentSheet.id,
      userId: testUser.id,
      type: "EXPENSE",
      title: "ซื้ออุปกรณ์ทำงาน",
      category: "SHOPPING",
      amountSatang: toSatang(21000), // leaves 4,000 out of 33,000 spendable (~12.1% <= 20%)
    },
  });
  await recalculateSheetExtraTotals(currentSheet.id);

  const firstAlert = await checkAndRecordBudgetAlert(testUser.id, currentYm);
  assert.ok(firstAlert);
  assert.equal(firstAlert.level, "WARNING");
  assert.equal(hubNotificationsSent.length, 1);

  // Calling checkAndRecordBudgetAlert again for the same sheet & level does not duplicate notification
  const secondAlert = await checkAndRecordBudgetAlert(testUser.id, currentYm);
  assert.equal(secondAlert?.id, firstAlert.id);
  assert.equal(hubNotificationsSent.length, 1);
});
