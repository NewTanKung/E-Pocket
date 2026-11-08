import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeRolloverSeries,
  toSatang,
  fromSatang,
  shiftYearMonth,
  evaluateFinancialHealth,
} from "../src/lib/finance-engine";
import { buildBudgetAlertContent } from "../src/lib/hub-notifications";

test("toSatang and fromSatang convert Thai Baht accurately without floating point drift", () => {
  assert.equal(toSatang(35000), 3500000n);
  assert.equal(toSatang(199.99), 19999n);
  assert.equal(fromSatang(3500000n), 35000);
  assert.equal(fromSatang(19999n), 199.99);
});

test("shiftYearMonth transitions across year boundaries properly", () => {
  assert.equal(shiftYearMonth("2026-11", 1), "2026-12");
  assert.equal(shiftYearMonth("2026-12", 1), "2027-01");
  assert.equal(shiftYearMonth("2026-01", -1), "2025-12");
});

test("computeRolloverSeries calculates monthly baseline remaining and rolls over balance month-to-month", () => {
  const referenceDate = new Date("2026-11-15T10:00:00Z");
  const series = computeRolloverSeries(
    [
      {
        yearMonth: "2026-10",
        fixedIncomeSatang: toSatang(35000),
        fixedExpenseSatang: toSatang(12000),
        extraIncomeSatang: toSatang(2000),
        extraExpenseSatang: toSatang(5000),
      },
      {
        yearMonth: "2026-11",
        fixedIncomeSatang: toSatang(35000),
        fixedExpenseSatang: toSatang(12000),
        extraIncomeSatang: toSatang(0),
        extraExpenseSatang: toSatang(8000),
      },
    ],
    20,
    referenceDate,
  );

  assert.equal(series.length, 2);

  const oct = series[0]!;
  // Oct baseline = 35000 - 12000 = 23000
  assert.equal(oct.baselineRemainingBaht, 23000);
  // Oct net cashflow = 23000 + 2000 - 5000 = 20000
  assert.equal(oct.monthNetCashflowBaht, 20000);
  assert.equal(oct.carryOverBaht, 0);
  assert.equal(oct.totalAvailableBalanceBaht, 20000);
  assert.equal(oct.status, "HEALTHY");

  const nov = series[1]!;
  // Nov carry-over must equal Oct total available (20000)
  assert.equal(nov.carryOverBaht, 20000);
  // Nov baseline = 35000 - 12000 = 23000
  assert.equal(nov.baselineRemainingBaht, 23000);
  // Nov net cashflow = 23000 - 8000 = 15000
  assert.equal(nov.monthNetCashflowBaht, 15000);
  // Nov total available = 20000 + 15000 = 35000
  assert.equal(nov.totalAvailableBalanceBaht, 35000);
  // Remaining days in Nov from Nov 15 inclusive = 16 days
  assert.equal(nov.remainingDays, 16);
  assert.equal(nov.dailySafeToSpendBaht, 2187.5);
});

test("evaluateFinancialHealth and buildBudgetAlertContent classify WARNING, OVERSPENT_MONTH, and CRITICAL accurately", () => {
  // 1. WARNING when remaining monthly cashflow <= 20% of spendable baseline
  const warningHealth = evaluateFinancialHealth({
    baselineRemainingSatang: toSatang(10000),
    extraIncomeSatang: 0n,
    extraExpenseSatang: toSatang(8500),
    monthNetCashflowSatang: toSatang(1500), // 15% left
    totalAvailableSatang: toSatang(1500),
    warningThresholdPct: 20,
  });
  assert.equal(warningHealth.status, "WARNING");

  // 2. OVERSPENT_MONTH when monthNetCashflow < 0 but carry-over keeps totalAvailable >= 0
  const overspentMonthHealth = evaluateFinancialHealth({
    baselineRemainingSatang: toSatang(10000),
    extraIncomeSatang: 0n,
    extraExpenseSatang: toSatang(12000),
    monthNetCashflowSatang: toSatang(-2000),
    totalAvailableSatang: toSatang(5000), // had 7000 carryover
    warningThresholdPct: 20,
  });
  assert.equal(overspentMonthHealth.status, "OVERSPENT_MONTH");

  // 3. CRITICAL when totalAvailable < 0
  const criticalHealth = evaluateFinancialHealth({
    baselineRemainingSatang: toSatang(10000),
    extraIncomeSatang: 0n,
    extraExpenseSatang: toSatang(15000),
    monthNetCashflowSatang: toSatang(-5000),
    totalAvailableSatang: toSatang(-1000),
    warningThresholdPct: 20,
  });
  assert.equal(criticalHealth.status, "CRITICAL");

  const series = computeRolloverSeries(
    [
      {
        yearMonth: "2026-11",
        fixedIncomeSatang: toSatang(20000),
        fixedExpenseSatang: toSatang(10000),
        extraIncomeSatang: 0n,
        extraExpenseSatang: toSatang(12000),
      },
    ],
    20,
  );
  const alert = buildBudgetAlertContent(
    series[0]!,
    "https://epocket.monolith.test",
  );
  assert.ok(alert);
  assert.equal(alert.level, "CRITICAL");
  assert.equal(
    alert.linkUrl,
    "https://epocket.monolith.test?month=2026-11",
  );
});
