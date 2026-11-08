import type { ExpenseCategory } from "@prisma/client";
import type { HubUser } from "@monolith/auth-client";
import { prisma } from "./prisma";
import {
  CATEGORY_MAP,
  type CategoryCode,
  type ComputedMonthMetrics,
  computeRolloverSeries,
  fromSatang,
  getCurrentYearMonth,
  isValidYearMonth,
  toSatang,
} from "./finance-engine";
import {
  buildBudgetAlertContent,
  dispatchHubNotification,
} from "./hub-notifications";
import { getAuthConfig } from "./auth";

export interface FixedIncomeDTO {
  id: string;
  title: string;
  amountBaht: number;
  isPrimarySalary: boolean;
}

export interface FixedExpenseDTO {
  id: string;
  title: string;
  category: CategoryCode;
  categoryLabel: string;
  categoryColor: string;
  amountBaht: number;
  dueDay: number | null;
}

export interface TransactionDTO {
  id: string;
  type: "INCOME" | "EXPENSE";
  title: string;
  category: CategoryCode;
  categoryLabel: string;
  categoryColor: string;
  amountBaht: number;
  occurredAt: string;
  note: string | null;
}

export interface CategoryBreakdownDTO {
  category: CategoryCode;
  label: string;
  color: string;
  fixedAmountBaht: number;
  extraAmountBaht: number;
  totalAmountBaht: number;
  percentage: number;
}

export interface DashboardDataDTO {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  onboardingCompleted: boolean;
  warningThresholdPct: number;
  selectedMonth: string;
  availableMonths: string[];
  currentMetrics: ComputedMonthMetrics;
  monthlyTrend: ComputedMonthMetrics[];
  fixedIncomes: FixedIncomeDTO[];
  fixedExpenses: FixedExpenseDTO[];
  monthFixedSnapshots: {
    incomes: FixedIncomeDTO[];
    expenses: FixedExpenseDTO[];
  };
  transactions: TransactionDTO[];
  categoryBreakdown: CategoryBreakdownDTO[];
  recentAlerts: {
    id: string;
    level: string;
    message: string;
    sentToHub: boolean;
    sentAt: string;
  }[];
}

export async function ensureFinancialProfile(user: HubUser) {
  return prisma.financialProfile.upsert({
    where: { userId: user.id },
    update: {
      email: user.email,
      displayName: user.name ?? user.email.split("@")[0],
    },
    create: {
      userId: user.id,
      email: user.email,
      displayName: user.name ?? user.email.split("@")[0],
      onboardingCompleted: false,
      warningThresholdPct: 20,
    },
  });
}

export async function syncMonthlySheetFixedSnapshots(
  userId: string,
  yearMonth: string,
) {
  const [incomes, expenses] = await Promise.all([
    prisma.fixedIncomeItem.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isPrimarySalary: "desc" }, { createdAt: "asc" }],
    }),
    prisma.fixedExpenseItem.findMany({
      where: { userId, isActive: true },
      orderBy: [{ amountSatang: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  const fixedIncomeSatang = incomes.reduce(
    (sum, item) => sum + item.amountSatang,
    0n,
  );
  const fixedExpenseSatang = expenses.reduce(
    (sum, item) => sum + item.amountSatang,
    0n,
  );

  const sheet = await prisma.monthlySheet.upsert({
    where: {
      userId_yearMonth: { userId, yearMonth },
    },
    update: {
      fixedIncomeSatang,
      fixedExpenseSatang,
    },
    create: {
      userId,
      yearMonth,
      fixedIncomeSatang,
      fixedExpenseSatang,
      extraIncomeSatang: 0n,
      extraExpenseSatang: 0n,
    },
  });

  await prisma.monthlyFixedSnapshot.deleteMany({
    where: { sheetId: sheet.id },
  });

  const snapshotData = [
    ...incomes.map((inc) => ({
      sheetId: sheet.id,
      itemType: "INCOME" as const,
      title: inc.title,
      category: "SALARY" as ExpenseCategory,
      amountSatang: inc.amountSatang,
      dueDay: null,
      sourceItemId: inc.id,
    })),
    ...expenses.map((exp) => ({
      sheetId: sheet.id,
      itemType: "EXPENSE" as const,
      title: exp.title,
      category: exp.category,
      amountSatang: exp.amountSatang,
      dueDay: exp.dueDay,
      sourceItemId: exp.id,
    })),
  ];

  if (snapshotData.length > 0) {
    await prisma.monthlyFixedSnapshot.createMany({
      data: snapshotData,
    });
  }

  return sheet;
}

export async function ensureMonthlySheet(userId: string, yearMonth: string) {
  const existing = await prisma.monthlySheet.findUnique({
    where: {
      userId_yearMonth: { userId, yearMonth },
    },
  });
  if (existing) return existing;
  return syncMonthlySheetFixedSnapshots(userId, yearMonth);
}

export async function recalculateSheetExtraTotals(sheetId: string) {
  const txs = await prisma.transaction.findMany({
    where: { sheetId },
    select: { type: true, amountSatang: true },
  });

  let extraIncomeSatang = 0n;
  let extraExpenseSatang = 0n;

  for (const tx of txs) {
    if (tx.type === "INCOME") {
      extraIncomeSatang += tx.amountSatang;
    } else {
      extraExpenseSatang += tx.amountSatang;
    }
  }

  return prisma.monthlySheet.update({
    where: { id: sheetId },
    data: {
      extraIncomeSatang,
      extraExpenseSatang,
    },
  });
}

export async function completeUserOnboarding(
  user: HubUser,
  input: {
    primarySalaryBaht: number;
    primarySalaryTitle: string;
    additionalFixedIncomes: {
      title: string;
      amountBaht: number;
    }[];
    fixedExpenses: {
      title: string;
      category: CategoryCode;
      amountBaht: number;
      dueDay?: number | null;
    }[];
    warningThresholdPct: number;
  },
) {
  await ensureFinancialProfile(user);

  await prisma.$transaction(async (tx) => {
    await tx.fixedIncomeItem.deleteMany({ where: { userId: user.id } });
    await tx.fixedExpenseItem.deleteMany({ where: { userId: user.id } });

    await tx.fixedIncomeItem.create({
      data: {
        userId: user.id,
        title: input.primarySalaryTitle || "เงินเดือนประจำ",
        amountSatang: toSatang(input.primarySalaryBaht),
        isPrimarySalary: true,
        isActive: true,
      },
    });

    for (const extraInc of input.additionalFixedIncomes) {
      if (extraInc.amountBaht > 0) {
        await tx.fixedIncomeItem.create({
          data: {
            userId: user.id,
            title: extraInc.title,
            amountSatang: toSatang(extraInc.amountBaht),
            isPrimarySalary: false,
            isActive: true,
          },
        });
      }
    }

    for (const exp of input.fixedExpenses) {
      if (exp.amountBaht >= 0) {
        await tx.fixedExpenseItem.create({
          data: {
            userId: user.id,
            title: exp.title,
            category: exp.category as ExpenseCategory,
            amountSatang: toSatang(exp.amountBaht),
            dueDay: exp.dueDay ?? null,
            isActive: true,
          },
        });
      }
    }

    await tx.financialProfile.update({
      where: { userId: user.id },
      data: {
        onboardingCompleted: true,
        warningThresholdPct: input.warningThresholdPct,
      },
    });
  });

  const currentYm = getCurrentYearMonth();
  await syncMonthlySheetFixedSnapshots(user.id, currentYm);
  await checkAndRecordBudgetAlert(user.id, currentYm);
}

export async function updateUserFixedPlan(
  user: HubUser,
  input: {
    fixedIncomes: {
      title: string;
      amountBaht: number;
      isPrimarySalary?: boolean;
    }[];
    fixedExpenses: {
      title: string;
      category: CategoryCode;
      amountBaht: number;
      dueDay?: number | null;
    }[];
    warningThresholdPct: number;
    applyToCurrentMonth: boolean;
    targetYearMonth?: string;
  },
) {
  await ensureFinancialProfile(user);

  await prisma.$transaction(async (tx) => {
    await tx.fixedIncomeItem.deleteMany({ where: { userId: user.id } });
    await tx.fixedExpenseItem.deleteMany({ where: { userId: user.id } });

    let primaryAssigned = false;
    for (const inc of input.fixedIncomes) {
      const isPrimary = !primaryAssigned && (inc.isPrimarySalary ?? true);
      if (isPrimary) primaryAssigned = true;
      await tx.fixedIncomeItem.create({
        data: {
          userId: user.id,
          title: inc.title,
          amountSatang: toSatang(inc.amountBaht),
          isPrimarySalary: isPrimary,
          isActive: true,
        },
      });
    }

    for (const exp of input.fixedExpenses) {
      await tx.fixedExpenseItem.create({
        data: {
          userId: user.id,
          title: exp.title,
          category: exp.category as ExpenseCategory,
          amountSatang: toSatang(exp.amountBaht),
          dueDay: exp.dueDay ?? null,
          isActive: true,
        },
      });
    }

    await tx.financialProfile.update({
      where: { userId: user.id },
      data: {
        onboardingCompleted: true,
        warningThresholdPct: input.warningThresholdPct,
      },
    });
  });

  if (input.applyToCurrentMonth) {
    const ym =
      input.targetYearMonth && isValidYearMonth(input.targetYearMonth)
        ? input.targetYearMonth
        : getCurrentYearMonth();
    await syncMonthlySheetFixedSnapshots(user.id, ym);
    await checkAndRecordBudgetAlert(user.id, ym);
  }
}

export async function checkAndRecordBudgetAlert(
  userId: string,
  yearMonth: string,
) {
  const profile = await prisma.financialProfile.findUnique({
    where: { userId },
  });
  if (!profile || !profile.onboardingCompleted) return null;

  const allSheets = await prisma.monthlySheet.findMany({
    where: { userId },
    orderBy: { yearMonth: "asc" },
  });

  const series = computeRolloverSeries(allSheets, profile.warningThresholdPct);
  const targetMetrics = series.find((s) => s.yearMonth === yearMonth);
  const targetSheet = allSheets.find((s) => s.yearMonth === yearMonth);

  if (!targetMetrics || !targetSheet) return null;

  const config = getAuthConfig();
  const alertContent = buildBudgetAlertContent(
    targetMetrics,
    config.serviceUrl,
  );
  if (!alertContent) return null;

  const existingAlert = await prisma.budgetAlertLog.findUnique({
    where: {
      sheetId_level: {
        sheetId: targetSheet.id,
        level: alertContent.level,
      },
    },
  });

  if (existingAlert) return existingAlert;

  const sentToHub = await dispatchHubNotification({
    userId,
    title: alertContent.title,
    message: alertContent.message,
    linkUrl: alertContent.linkUrl,
  });

  return prisma.budgetAlertLog.create({
    data: {
      sheetId: targetSheet.id,
      userId,
      level: alertContent.level,
      message: `${alertContent.title}: ${alertContent.message}`,
      sentToHub,
    },
  });
}

export async function getDashboardData(
  user: HubUser,
  requestedYearMonth?: string,
): Promise<DashboardDataDTO> {
  const profile = await ensureFinancialProfile(user);
  const currentYm = getCurrentYearMonth();
  const selectedMonth =
    requestedYearMonth && isValidYearMonth(requestedYearMonth)
      ? requestedYearMonth
      : currentYm;

  if (profile.onboardingCompleted) {
    await ensureMonthlySheet(user.id, selectedMonth);
  }

  const [fixedIncomes, fixedExpenses, allSheets] = await Promise.all([
    prisma.fixedIncomeItem.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ isPrimarySalary: "desc" }, { createdAt: "asc" }],
    }),
    prisma.fixedExpenseItem.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ amountSatang: "desc" }, { createdAt: "asc" }],
    }),
    prisma.monthlySheet.findMany({
      where: { userId: user.id },
      orderBy: { yearMonth: "asc" },
      include: {
        fixedSnapshots: {
          orderBy: { amountSatang: "desc" },
        },
        transactions: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        },
        alertLogs: {
          orderBy: { sentAt: "desc" },
        },
      },
    }),
  ]);

  const sheetInputs =
    allSheets.length > 0
      ? allSheets
      : [
          {
            yearMonth: selectedMonth,
            fixedIncomeSatang: 0n,
            fixedExpenseSatang: 0n,
            extraIncomeSatang: 0n,
            extraExpenseSatang: 0n,
          },
        ];

  const fullSeries = computeRolloverSeries(
    sheetInputs,
    profile.warningThresholdPct,
  );

  const currentMetrics =
    fullSeries.find((m) => m.yearMonth === selectedMonth) ??
    fullSeries[fullSeries.length - 1]!;

  const selectedSheet = allSheets.find((s) => s.yearMonth === selectedMonth);

  // Build Category Breakdown for selected month (combining fixed expenses + extra expenses)
  const categoryTotals = new Map<
    CategoryCode,
    { fixedSatang: bigint; extraSatang: bigint }
  >();

  if (selectedSheet) {
    for (const snap of selectedSheet.fixedSnapshots) {
      if (snap.itemType === "EXPENSE") {
        const code = (snap.category as CategoryCode) || "OTHER_EXPENSE";
        const prev = categoryTotals.get(code) ?? {
          fixedSatang: 0n,
          extraSatang: 0n,
        };
        prev.fixedSatang += snap.amountSatang;
        categoryTotals.set(code, prev);
      }
    }

    for (const tx of selectedSheet.transactions) {
      if (tx.type === "EXPENSE") {
        const code = (tx.category as CategoryCode) || "OTHER_EXPENSE";
        const prev = categoryTotals.get(code) ?? {
          fixedSatang: 0n,
          extraSatang: 0n,
        };
        prev.extraSatang += tx.amountSatang;
        categoryTotals.set(code, prev);
      }
    }
  }

  let grandTotalExpenseSatang = 0n;
  for (const val of categoryTotals.values()) {
    grandTotalExpenseSatang += val.fixedSatang + val.extraSatang;
  }

  const categoryBreakdown: CategoryBreakdownDTO[] = Array.from(
    categoryTotals.entries(),
  )
    .map(([code, val]) => {
      const meta = CATEGORY_MAP[code] ?? CATEGORY_MAP.OTHER_EXPENSE;
      const totalSatang = val.fixedSatang + val.extraSatang;
      const percentage =
        grandTotalExpenseSatang > 0n
          ? Math.round(
              Number((totalSatang * 10000n) / grandTotalExpenseSatang),
            ) / 100
          : 0;
      return {
        category: code,
        label: meta.label,
        color: meta.color,
        fixedAmountBaht: fromSatang(val.fixedSatang),
        extraAmountBaht: fromSatang(val.extraSatang),
        totalAmountBaht: fromSatang(totalSatang),
        percentage,
      };
    })
    .sort((a, b) => b.totalAmountBaht - a.totalAmountBaht);

  const availableMonths = Array.from(
    new Set([...allSheets.map((s) => s.yearMonth), currentYm, selectedMonth]),
  ).sort();

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    onboardingCompleted: profile.onboardingCompleted,
    warningThresholdPct: profile.warningThresholdPct,
    selectedMonth,
    availableMonths,
    currentMetrics,
    monthlyTrend: fullSeries.slice(-6),
    fixedIncomes: fixedIncomes.map((inc) => ({
      id: inc.id,
      title: inc.title,
      amountBaht: fromSatang(inc.amountSatang),
      isPrimarySalary: inc.isPrimarySalary,
    })),
    fixedExpenses: fixedExpenses.map((exp) => {
      const code = (exp.category as CategoryCode) || "OTHER_EXPENSE";
      const meta = CATEGORY_MAP[code] ?? CATEGORY_MAP.OTHER_EXPENSE;
      return {
        id: exp.id,
        title: exp.title,
        category: code,
        categoryLabel: meta.label,
        categoryColor: meta.color,
        amountBaht: fromSatang(exp.amountSatang),
        dueDay: exp.dueDay,
      };
    }),
    monthFixedSnapshots: {
      incomes: (selectedSheet?.fixedSnapshots ?? [])
        .filter((s) => s.itemType === "INCOME")
        .map((s) => ({
          id: s.id,
          title: s.title,
          amountBaht: fromSatang(s.amountSatang),
          isPrimarySalary: true,
        })),
      expenses: (selectedSheet?.fixedSnapshots ?? [])
        .filter((s) => s.itemType === "EXPENSE")
        .map((s) => {
          const code = (s.category as CategoryCode) || "OTHER_EXPENSE";
          const meta = CATEGORY_MAP[code] ?? CATEGORY_MAP.OTHER_EXPENSE;
          return {
            id: s.id,
            title: s.title,
            category: code,
            categoryLabel: meta.label,
            categoryColor: meta.color,
            amountBaht: fromSatang(s.amountSatang),
            dueDay: s.dueDay,
          };
        }),
    },
    transactions: (selectedSheet?.transactions ?? []).map((tx) => {
      const code = (tx.category as CategoryCode) || "OTHER_EXPENSE";
      const meta = CATEGORY_MAP[code] ?? CATEGORY_MAP.OTHER_EXPENSE;
      return {
        id: tx.id,
        type: tx.type,
        title: tx.title,
        category: code,
        categoryLabel: meta.label,
        categoryColor: meta.color,
        amountBaht: fromSatang(tx.amountSatang),
        occurredAt: tx.occurredAt.toISOString(),
        note: tx.note,
      };
    }),
    categoryBreakdown,
    recentAlerts: (selectedSheet?.alertLogs ?? []).map((log) => ({
      id: log.id,
      level: log.level,
      message: log.message,
      sentToHub: log.sentToHub,
      sentAt: log.sentAt.toISOString(),
    })),
  };
}
