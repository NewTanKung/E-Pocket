import { test } from "node:test";
import assert from "node:assert/strict";
import { createDevSimulationCookieValue } from "../src/lib/auth";
import { POST as onboardingPost } from "../src/app/api/onboarding/route";
import { GET as dashboardGet } from "../src/app/api/dashboard/route";
import { POST as transactionsPost } from "../src/app/api/transactions/route";
import { PATCH as transactionPatch, DELETE as transactionDelete } from "../src/app/api/transactions/[id]/route";
import { PUT as fixedPlanPut } from "../src/app/api/fixed-plan/route";
import { prisma } from "../src/lib/prisma";
import { getCurrentYearMonth, shiftYearMonth } from "../src/lib/finance-engine";

test("API Routes E2E: unauthenticated rejection, onboarding POST, transactions POST/PATCH/DELETE, fixed-plan PUT, and rollover GET", async (t) => {
  const prevAllowMock = process.env.ALLOW_DEV_MOCK_AUTH;
  process.env.ALLOW_DEV_MOCK_AUTH = "true";

  const userId = `api_e2e_user_${Date.now()}`;
  const cookieVal = createDevSimulationCookieValue({
    id: userId,
    email: "api.e2e@monolith.local",
    name: "API E2E Tester",
    role: "MEMBER",
  });
  const cookieHeader = `monolith_session=${encodeURIComponent(cookieVal)}`;

  t.after(async () => {
    process.env.ALLOW_DEV_MOCK_AUTH = prevAllowMock;
    await prisma.financialProfile
      .delete({ where: { userId } })
      .catch(() => undefined);
  });

  // 1. Unauthenticated call without cookie fails
  const unauthReq = new Request("http://localhost:3001/api/dashboard");
  const unauthRes = await dashboardGet(unauthReq);
  assert.notEqual(unauthRes.status, 200);

  // 2. Onboarding POST sets fixed salary (50,000) & fixed expenses (18,000) -> 32,000 remaining
  const onboardReq = new Request("http://localhost:3001/api/onboarding", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      primarySalaryTitle: "เงินเดือนวิศวกรซอฟต์แวร์",
      primarySalaryBaht: 50000,
      additionalFixedIncomes: [],
      fixedExpenses: [
        { title: "ค่าผ่อนคอนโด", category: "HOUSING", amountBaht: 14000, dueDay: 1 },
        { title: "ค่าน้ำ/ไฟ/เน็ต", category: "UTILITIES", amountBaht: 4000, dueDay: 15 },
      ],
      warningThresholdPct: 20,
    }),
  });
  const onboardRes = await onboardingPost(onboardReq);
  assert.equal(onboardRes.status, 200);
  const onboardJson = await onboardRes.json();
  assert.equal(onboardJson.dashboard.onboardingCompleted, true);
  assert.equal(onboardJson.dashboard.currentMetrics.baselineRemainingBaht, 32000);

  // 3. Add extra expense (-2,000) via POST /api/transactions
  const currentYm = getCurrentYearMonth();
  const txPostReq = new Request("http://localhost:3001/api/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      yearMonth: currentYm,
      type: "EXPENSE",
      title: "ค่าอาหารญี่ปุ่น",
      category: "FOOD",
      amountBaht: 2000,
      note: "เลี้ยงฉลองปิดโปรเจกต์",
    }),
  });
  const txPostRes = await transactionsPost(txPostReq);
  assert.equal(txPostRes.status, 201);
  const txPostJson = await txPostRes.json();
  assert.equal(txPostJson.dashboard.currentMetrics.monthNetCashflowBaht, 30000);
  const createdTxId = txPostJson.dashboard.transactions[0]?.id as string;
  assert.ok(createdTxId);

  // 4. Edit transaction to -3,500 via PATCH /api/transactions/[id]
  const txPatchReq = new Request(
    `http://localhost:3001/api/transactions/${createdTxId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        amountBaht: 3500,
      }),
    },
  );
  const txPatchRes = await transactionPatch(txPatchReq, {
    params: Promise.resolve({ id: createdTxId }),
  });
  assert.equal(txPatchRes.status, 200);
  const txPatchJson = await txPatchRes.json();
  assert.equal(txPatchJson.dashboard.currentMetrics.monthNetCashflowBaht, 28500);

  // 5. Check next month rollover via GET /api/dashboard?month=nextYm
  const nextYm = shiftYearMonth(currentYm, 1);
  const nextMonthReq = new Request(
    `http://localhost:3001/api/dashboard?month=${nextYm}`,
    {
      headers: { Cookie: cookieHeader },
    },
  );
  const nextMonthRes = await dashboardGet(nextMonthReq);
  assert.equal(nextMonthRes.status, 200);
  const nextMonthJson = await nextMonthRes.json();
  assert.equal(nextMonthJson.dashboard.currentMetrics.carryOverBaht, 28500);
  assert.equal(
    nextMonthJson.dashboard.currentMetrics.totalAvailableBalanceBaht,
    28500 + 32000,
  );

  // 6. Update Fixed Plan via PUT /api/fixed-plan
  const fixedPlanPutReq = new Request("http://localhost:3001/api/fixed-plan", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      fixedIncomes: [
        { title: "เงินเดือนวิศวกรซอฟต์แวร์ (ปรับฐาน)", amountBaht: 55000, isPrimarySalary: true },
      ],
      fixedExpenses: [
        { title: "ค่าผ่อนคอนโด", category: "HOUSING", amountBaht: 14000, dueDay: 1 },
        { title: "ค่าน้ำ/ไฟ/เน็ต", category: "UTILITIES", amountBaht: 4000, dueDay: 15 },
      ],
      warningThresholdPct: 25,
      applyToCurrentMonth: true,
      targetYearMonth: currentYm,
    }),
  });
  const fixedPlanPutRes = await fixedPlanPut(fixedPlanPutReq);
  assert.equal(fixedPlanPutRes.status, 200);
  const fixedPlanPutJson = await fixedPlanPutRes.json();
  assert.equal(
    fixedPlanPutJson.dashboard.currentMetrics.baselineRemainingBaht,
    37000,
  );

  // 7. Delete transaction via DELETE /api/transactions/[id]
  const txDeleteReq = new Request(
    `http://localhost:3001/api/transactions/${createdTxId}`,
    {
      method: "DELETE",
      headers: { Cookie: cookieHeader },
    },
  );
  const txDeleteRes = await transactionDelete(txDeleteReq, {
    params: Promise.resolve({ id: createdTxId }),
  });
  assert.equal(txDeleteRes.status, 200);
  const txDeleteJson = await txDeleteRes.json();
  assert.equal(
    txDeleteJson.dashboard.currentMetrics.monthNetCashflowBaht,
    37000,
  );
});
