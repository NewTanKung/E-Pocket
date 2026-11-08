export type CategoryCode =
  | "SALARY"
  | "BONUS"
  | "FREELANCE"
  | "INVESTMENT"
  | "OTHER_INCOME"
  | "HOUSING"
  | "UTILITIES"
  | "FOOD"
  | "TRANSPORT"
  | "DEBT"
  | "SUBSCRIPTION"
  | "SHOPPING"
  | "HEALTH"
  | "ENTERTAINMENT"
  | "SAVINGS"
  | "OTHER_EXPENSE";

export type FinancialHealthStatus =
  | "HEALTHY"
  | "WARNING"
  | "OVERSPENT_MONTH"
  | "CRITICAL";

export interface CategoryMeta {
  code: CategoryCode;
  label: string;
  kind: "INCOME" | "EXPENSE";
  color: string;
  icon: string;
}

export const CATEGORY_MAP: Record<CategoryCode, CategoryMeta> = {
  SALARY: {
    code: "SALARY",
    label: "เงินเดือนประจำ",
    kind: "INCOME",
    color: "#6ee7b7",
    icon: "Briefcase",
  },
  BONUS: {
    code: "BONUS",
    label: "โบนัส / ค่าคอมมิชชัน",
    kind: "INCOME",
    color: "#34d399",
    icon: "Award",
  },
  FREELANCE: {
    code: "FREELANCE",
    label: "งานเสริม / ฟรีแลนซ์",
    kind: "INCOME",
    color: "#5eead4",
    icon: "Laptop",
  },
  INVESTMENT: {
    code: "INVESTMENT",
    label: "ผลตอบแทนการลงทุน / ดอกเบี้ย",
    kind: "INCOME",
    color: "#93c5fd",
    icon: "TrendingUp",
  },
  OTHER_INCOME: {
    code: "OTHER_INCOME",
    label: "รายรับอื่นๆ",
    kind: "INCOME",
    color: "#a4e4d8",
    icon: "PlusCircle",
  },
  HOUSING: {
    code: "HOUSING",
    label: "ที่พักอาศัย / ค่าเช่า / ผ่อนบ้าน",
    kind: "EXPENSE",
    color: "#7dd3fc",
    icon: "Home",
  },
  UTILITIES: {
    code: "UTILITIES",
    label: "ค่าน้ำ / ค่าไฟ / อินเทอร์เน็ต / โทรศัพท์",
    kind: "EXPENSE",
    color: "#38bdf8",
    icon: "Zap",
  },
  FOOD: {
    code: "FOOD",
    label: "อาหารและเครื่องดื่ม",
    kind: "EXPENSE",
    color: "#fcd34d",
    icon: "Utensils",
  },
  TRANSPORT: {
    code: "TRANSPORT",
    label: "เดินทาง / น้ำมัน / รถไฟฟ้า",
    kind: "EXPENSE",
    color: "#fb923c",
    icon: "Car",
  },
  DEBT: {
    code: "DEBT",
    label: "ผ่อนชำระ / บัตรเครดิต / สินเชื่อ",
    kind: "EXPENSE",
    color: "#fda4af",
    icon: "CreditCard",
  },
  SUBSCRIPTION: {
    code: "SUBSCRIPTION",
    label: "บริการรายเดือน / สตรีมมิ่ง",
    kind: "EXPENSE",
    color: "#f472b6",
    icon: "Repeat",
  },
  SHOPPING: {
    code: "SHOPPING",
    label: "ของใช้ส่วนตัว / ช้อปปิ้ง",
    kind: "EXPENSE",
    color: "#f9a8d4",
    icon: "ShoppingBag",
  },
  HEALTH: {
    code: "HEALTH",
    label: "สุขภาพ / ประกัน / ฟิตเนส",
    kind: "EXPENSE",
    color: "#86efac",
    icon: "HeartPulse",
  },
  ENTERTAINMENT: {
    code: "ENTERTAINMENT",
    label: "สังสรรค์ / ท่องเที่ยว / บันเทิง",
    kind: "EXPENSE",
    color: "#fdba74",
    icon: "Film",
  },
  SAVINGS: {
    code: "SAVINGS",
    label: "เงินออม / ลงทุนประจำเดือน",
    kind: "EXPENSE",
    color: "#a4e4d8",
    icon: "PiggyBank",
  },
  OTHER_EXPENSE: {
    code: "OTHER_EXPENSE",
    label: "รายจ่ายอื่นๆ",
    kind: "EXPENSE",
    color: "#cbd5e1",
    icon: "Receipt",
  },
};

export const INCOME_CATEGORIES: CategoryMeta[] = Object.values(
  CATEGORY_MAP,
).filter((c) => c.kind === "INCOME");

export const EXPENSE_CATEGORIES: CategoryMeta[] = Object.values(
  CATEGORY_MAP,
).filter((c) => c.kind === "EXPENSE");

export function toSatang(baht: number): bigint {
  if (!Number.isFinite(baht)) return 0n;
  return BigInt(Math.round(baht * 100));
}

export function fromSatang(satang: bigint | number): number {
  const val = typeof satang === "bigint" ? Number(satang) : satang;
  return Math.round(val) / 100;
}

export function formatBaht(
  baht: number,
  options?: { showSign?: boolean; compact?: boolean },
): string {
  const abs = Math.abs(baht);
  const formatted = new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
    ...(options?.compact ? { notation: "compact" } : {}),
  }).format(abs);
  const sign =
    baht < 0 ? "-" : options?.showSign && baht > 0 ? "+" : "";
  return `${sign}฿${formatted}`;
}

export function getCurrentYearMonth(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isValidYearMonth(ym: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [yStr, mStr] = ym.split("-");
  const date = new Date(Number(yStr), Number(mStr) - 1 + deltaMonths, 1);
  return getCurrentYearMonth(date);
}

export function formatThaiMonthLabel(ym: string): string {
  if (!isValidYearMonth(ym)) return ym;
  const [yStr, mStr] = ym.split("-");
  const date = new Date(Number(yStr), Number(mStr) - 1, 1);
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getRemainingDaysInMonth(
  yearMonth: string,
  referenceDate = new Date(),
): { totalDays: number; remainingDays: number; isCurrentMonth: boolean; isPastMonth: boolean } {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  const currentYm = getCurrentYearMonth(referenceDate);
  if (yearMonth < currentYm) {
    return {
      totalDays,
      remainingDays: 0,
      isCurrentMonth: false,
      isPastMonth: true,
    };
  }
  if (yearMonth > currentYm) {
    return {
      totalDays,
      remainingDays: totalDays,
      isCurrentMonth: false,
      isPastMonth: false,
    };
  }

  const todayDate = referenceDate.getDate();
  const remainingDays = Math.max(1, totalDays - todayDate + 1);
  return {
    totalDays,
    remainingDays,
    isCurrentMonth: true,
    isPastMonth: false,
  };
}

export interface SheetSummaryInput {
  yearMonth: string;
  fixedIncomeSatang: bigint;
  fixedExpenseSatang: bigint;
  extraIncomeSatang: bigint;
  extraExpenseSatang: bigint;
}

export interface ComputedMonthMetrics {
  yearMonth: string;
  monthLabel: string;
  fixedIncomeBaht: number;
  fixedExpenseBaht: number;
  baselineRemainingBaht: number;
  extraIncomeBaht: number;
  extraExpenseBaht: number;
  totalIncomeBaht: number;
  totalExpenseBaht: number;
  monthNetCashflowBaht: number;
  carryOverBaht: number;
  totalAvailableBalanceBaht: number;
  dailySafeToSpendBaht: number;
  remainingDays: number;
  totalDays: number;
  expenseRatioPct: number;
  discretionaryUsedPct: number;
  status: FinancialHealthStatus;
  statusLabel: string;
  statusDescription: string;
}

export function evaluateFinancialHealth(params: {
  baselineRemainingSatang: bigint;
  extraIncomeSatang: bigint;
  extraExpenseSatang: bigint;
  monthNetCashflowSatang: bigint;
  totalAvailableSatang: bigint;
  warningThresholdPct: number;
}): {
  status: FinancialHealthStatus;
  statusLabel: string;
  statusDescription: string;
} {
  const {
    baselineRemainingSatang,
    extraIncomeSatang,
    monthNetCashflowSatang,
    totalAvailableSatang,
    warningThresholdPct,
  } = params;

  if (totalAvailableSatang < 0n) {
    return {
      status: "CRITICAL",
      statusLabel: "ยอดเงินสะสมติดลบ (วิกฤต)",
      statusDescription:
        "รายจ่ายรวมเกินกว่าทั้งรายรับเดือนนี้และเงินสะสมที่ทบมา ควรชะลอการใช้จ่ายเพิ่มเติมทันที",
    };
  }

  if (monthNetCashflowSatang < 0n) {
    return {
      status: "OVERSPENT_MONTH",
      statusLabel: "ใช้เกินรายรับเดือนนี้ (ดึงเงินสะสมมาใช้)",
      statusDescription:
        "เดือนนี้มียอดรายจ่ายเกินรายรับประจำเดือน ระบบได้นำเงินคงเหลือที่ทบมาจากเดือนก่อนมาชดเชย",
    };
  }

  const spendablePool = baselineRemainingSatang + extraIncomeSatang;
  if (spendablePool > 0n) {
    const remainingRatioPct =
      Number((monthNetCashflowSatang * 10000n) / spendablePool) / 100;
    if (remainingRatioPct <= warningThresholdPct) {
      return {
        status: "WARNING",
        statusLabel: "เงินคงเหลือใกล้ถึงเกณฑ์เฝ้าระวัง",
        statusDescription: `เงินคงเหลือเฉพาะเดือนนี้เหลือ ${remainingRatioPct.toFixed(1)}% ของงบที่ใช้ได้ (เกณฑ์แจ้งเตือน ${warningThresholdPct}%)`,
      };
    }
  } else if (monthNetCashflowSatang === 0n && totalAvailableSatang === 0n) {
    return {
      status: "WARNING",
      statusLabel: "ไม่มียอดเงินคงเหลือเผื่อใช้จ่าย",
      statusDescription: "รายจ่ายคงที่เท่ากับรายรับพอดี ไม่มีงบเหลือสำหรับใช้จ่ายเพิ่มเติม",
    };
  }

  return {
    status: "HEALTHY",
    statusLabel: "สุขภาพการเงินปกติ",
    statusDescription:
      "การใช้จ่ายอยู่ในกรอบที่วางไว้ มีเงินคงเหลือเพียงพอสำหรับการใช้จ่ายและทบสะสมไปเดือนถัดไป",
  };
}

export function computeRolloverSeries(
  sheets: SheetSummaryInput[],
  warningThresholdPct = 20,
  referenceDate = new Date(),
): ComputedMonthMetrics[] {
  const sorted = [...sheets].sort((a, b) =>
    a.yearMonth.localeCompare(b.yearMonth),
  );

  let runningCarryOverSatang = 0n;
  const results: ComputedMonthMetrics[] = [];

  for (const sheet of sorted) {
    const baselineRemainingSatang =
      sheet.fixedIncomeSatang - sheet.fixedExpenseSatang;
    const totalIncomeSatang =
      sheet.fixedIncomeSatang + sheet.extraIncomeSatang;
    const totalExpenseSatang =
      sheet.fixedExpenseSatang + sheet.extraExpenseSatang;
    const monthNetCashflowSatang = totalIncomeSatang - totalExpenseSatang;

    const carryOverSatang = runningCarryOverSatang;
    const totalAvailableSatang = carryOverSatang + monthNetCashflowSatang;

    // Rollover into the next month
    runningCarryOverSatang = totalAvailableSatang;

    const { totalDays, remainingDays } = getRemainingDaysInMonth(
      sheet.yearMonth,
      referenceDate,
    );

    const spendablePoolForDaily =
      totalAvailableSatang > 0n ? totalAvailableSatang : 0n;
    const dailySafeSatang =
      remainingDays > 0
        ? spendablePoolForDaily / BigInt(remainingDays)
        : 0n;

    const totalPoolForRatio =
      totalIncomeSatang + (carryOverSatang > 0n ? carryOverSatang : 0n);
    const expenseRatioPct =
      totalPoolForRatio > 0n
        ? Math.min(
            999,
            Math.round(
              Number((totalExpenseSatang * 10000n) / totalPoolForRatio),
            ) / 100,
          )
        : totalExpenseSatang > 0n
          ? 100
          : 0;

    const discretionaryPool =
      baselineRemainingSatang +
      sheet.extraIncomeSatang +
      (carryOverSatang > 0n ? carryOverSatang : 0n);
    const discretionaryUsedPct =
      discretionaryPool > 0n
        ? Math.min(
            999,
            Math.round(
              Number((sheet.extraExpenseSatang * 10000n) / discretionaryPool),
            ) / 100,
          )
        : sheet.extraExpenseSatang > 0n
          ? 100
          : 0;

    const health = evaluateFinancialHealth({
      baselineRemainingSatang,
      extraIncomeSatang: sheet.extraIncomeSatang,
      extraExpenseSatang: sheet.extraExpenseSatang,
      monthNetCashflowSatang,
      totalAvailableSatang,
      warningThresholdPct,
    });

    results.push({
      yearMonth: sheet.yearMonth,
      monthLabel: formatThaiMonthLabel(sheet.yearMonth),
      fixedIncomeBaht: fromSatang(sheet.fixedIncomeSatang),
      fixedExpenseBaht: fromSatang(sheet.fixedExpenseSatang),
      baselineRemainingBaht: fromSatang(baselineRemainingSatang),
      extraIncomeBaht: fromSatang(sheet.extraIncomeSatang),
      extraExpenseBaht: fromSatang(sheet.extraExpenseSatang),
      totalIncomeBaht: fromSatang(totalIncomeSatang),
      totalExpenseBaht: fromSatang(totalExpenseSatang),
      monthNetCashflowBaht: fromSatang(monthNetCashflowSatang),
      carryOverBaht: fromSatang(carryOverSatang),
      totalAvailableBalanceBaht: fromSatang(totalAvailableSatang),
      dailySafeToSpendBaht: fromSatang(dailySafeSatang),
      remainingDays,
      totalDays,
      expenseRatioPct,
      discretionaryUsedPct,
      ...health,
    });
  }

  return results;
}
