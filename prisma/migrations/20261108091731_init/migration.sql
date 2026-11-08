-- CreateEnum
CREATE TYPE "FixedItemType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARY', 'BONUS', 'FREELANCE', 'INVESTMENT', 'OTHER_INCOME', 'HOUSING', 'UTILITIES', 'FOOD', 'TRANSPORT', 'DEBT', 'SUBSCRIPTION', 'SHOPPING', 'HEALTH', 'ENTERTAINMENT', 'SAVINGS', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('WARNING', 'OVERSPENT_MONTH', 'CRITICAL');

-- CreateTable
CREATE TABLE "FinancialProfile" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "warningThresholdPct" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FixedIncomeItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "isPrimarySalary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedIncomeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedExpenseItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER_EXPENSE',
    "amountSatang" BIGINT NOT NULL,
    "dueDay" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "fixedIncomeSatang" BIGINT NOT NULL DEFAULT 0,
    "fixedExpenseSatang" BIGINT NOT NULL DEFAULT 0,
    "extraIncomeSatang" BIGINT NOT NULL DEFAULT 0,
    "extraExpenseSatang" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyFixedSnapshot" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "itemType" "FixedItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER_EXPENSE',
    "amountSatang" BIGINT NOT NULL,
    "dueDay" INTEGER,
    "sourceItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyFixedSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAlertLog" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "AlertLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "sentToHub" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedIncomeItem_userId_isActive_idx" ON "FixedIncomeItem"("userId", "isActive");

-- CreateIndex
CREATE INDEX "FixedExpenseItem_userId_isActive_idx" ON "FixedExpenseItem"("userId", "isActive");

-- CreateIndex
CREATE INDEX "MonthlySheet_userId_yearMonth_idx" ON "MonthlySheet"("userId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySheet_userId_yearMonth_key" ON "MonthlySheet"("userId", "yearMonth");

-- CreateIndex
CREATE INDEX "MonthlyFixedSnapshot_sheetId_itemType_idx" ON "MonthlyFixedSnapshot"("sheetId", "itemType");

-- CreateIndex
CREATE INDEX "Transaction_sheetId_occurredAt_idx" ON "Transaction"("sheetId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_occurredAt_idx" ON "Transaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "BudgetAlertLog_userId_sentAt_idx" ON "BudgetAlertLog"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAlertLog_sheetId_level_key" ON "BudgetAlertLog"("sheetId", "level");

-- AddForeignKey
ALTER TABLE "FixedIncomeItem" ADD CONSTRAINT "FixedIncomeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FinancialProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpenseItem" ADD CONSTRAINT "FixedExpenseItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FinancialProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySheet" ADD CONSTRAINT "MonthlySheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FinancialProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFixedSnapshot" ADD CONSTRAINT "MonthlyFixedSnapshot_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "MonthlySheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "MonthlySheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FinancialProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAlertLog" ADD CONSTRAINT "BudgetAlertLog_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "MonthlySheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAlertLog" ADD CONSTRAINT "BudgetAlertLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FinancialProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
