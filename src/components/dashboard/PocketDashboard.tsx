"use client";

import React, { useState, useMemo } from "react";
import {
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Layers,
  Settings,
  Trash2,
  PieChart,
  BarChart3,
  Bell,
  Search,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Check,
  Edit3,
  ExternalLink,
  LogOut,
} from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatBaht,
  formatThaiMonthLabel,
  shiftYearMonth,
  type CategoryCode,
} from "@/lib/finance-engine";
import type { DashboardDataDTO, TransactionDTO } from "@/lib/ledger";

interface PocketDashboardProps {
  initialDashboard: DashboardDataDTO;
  hubUrl: string;
  isDevSimulation?: boolean;
}

export function PocketDashboard({
  initialDashboard,
  hubUrl,
  isDevSimulation = false,
}: PocketDashboardProps) {
  const [dashboard, setDashboard] =
    useState<DashboardDataDTO>(initialDashboard);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Quick Add Transaction State
  const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [txTitle, setTxTitle] = useState("");
  const [txCategory, setTxCategory] = useState<CategoryCode>("FOOD");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [txNote, setTxNote] = useState("");
  const [submittingTx, setSubmittingTx] = useState(false);

  // Edit Transaction Modal State
  const [editingTx, setEditingTx] = useState<TransactionDTO | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<CategoryCode>("FOOD");
  const [editNote, setEditNote] = useState("");

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "EXPENSE" | "INCOME">(
    "ALL",
  );

  // Fixed Plan Editor Modal State
  const [showFixedPlanModal, setShowFixedPlanModal] = useState(false);
  const [draftIncomes, setDraftIncomes] = useState(
    () =>
      initialDashboard.fixedIncomes.map((i) => ({
        key: i.id,
        title: i.title,
        amountBaht: String(i.amountBaht),
        isPrimarySalary: i.isPrimarySalary,
      })),
  );
  const [draftExpenses, setDraftExpenses] = useState(
    () =>
      initialDashboard.fixedExpenses.map((e) => ({
        key: e.id,
        title: e.title,
        category: e.category,
        amountBaht: String(e.amountBaht),
        dueDay: e.dueDay ? String(e.dueDay) : "",
      })),
  );
  const [draftThreshold, setDraftThreshold] = useState(
    initialDashboard.warningThresholdPct,
  );
  const [savingFixedPlan, setSavingFixedPlan] = useState(false);

  const [bannerMessage, setBannerMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const metrics = dashboard.currentMetrics;

  async function switchMonth(targetYm: string) {
    setLoadingMonth(true);
    setBannerMessage(null);
    try {
      const res = await fetch(`/api/dashboard?month=${encodeURIComponent(targetYm)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถสลับเดือนได้");
      }
      setDashboard(data.dashboard);
    } catch (err) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setLoadingMonth(false);
    }
  }

  function handleTxTypeSwitch(nextType: "EXPENSE" | "INCOME") {
    setTxType(nextType);
    setTxCategory(nextType === "EXPENSE" ? "FOOD" : "BONUS");
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    setBannerMessage(null);
    const amountNum = Number(txAmount);
    if (!txTitle.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      setBannerMessage({
        type: "error",
        text: "กรุณาระบุชื่อรายการและจำนวนเงินที่มากกว่า 0 บาท",
      });
      return;
    }

    setSubmittingTx(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: dashboard.selectedMonth,
          type: txType,
          title: txTitle.trim(),
          category: txCategory,
          amountBaht: amountNum,
          occurredAt: txDate ? new Date(txDate).toISOString() : undefined,
          note: txNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "บันทึกรายการไม่สำเร็จ");
      }
      setDashboard(data.dashboard);
      setTxTitle("");
      setTxAmount("");
      setTxNote("");
      setBannerMessage({
        type: "success",
        text: `บันทึก${txType === "INCOME" ? "รายรับเพิ่มเติม" : "การใช้จ่าย"}เรียบร้อยแล้ว`,
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setSubmittingTx(false);
    }
  }

  async function handleDeleteTransaction(id: string) {
    setBannerMessage(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถลบรายการได้");
      }
      setDashboard(data.dashboard);
      setBannerMessage({
        type: "success",
        text: "ลบรายการเรียบร้อยแล้ว",
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    }
  }

  function openEditTransaction(tx: TransactionDTO) {
    setEditingTx(tx);
    setEditTitle(tx.title);
    setEditAmount(String(tx.amountBaht));
    setEditCategory(tx.category);
    setEditNote(tx.note || "");
  }

  async function handleSaveEditTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTx) return;
    const amountNum = Number(editAmount);
    if (!editTitle.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      return;
    }

    try {
      const res = await fetch(`/api/transactions/${editingTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          amountBaht: amountNum,
          category: editCategory,
          note: editNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถแก้ไขรายการได้");
      }
      setDashboard(data.dashboard);
      setEditingTx(null);
      setBannerMessage({
        type: "success",
        text: "อัปเดตรายการเรียบร้อยแล้ว",
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    }
  }

  function openFixedPlanEditor() {
    setDraftIncomes(
      dashboard.fixedIncomes.length > 0
        ? dashboard.fixedIncomes.map((i) => ({
            key: i.id,
            title: i.title,
            amountBaht: String(i.amountBaht),
            isPrimarySalary: i.isPrimarySalary,
          }))
        : [
            {
              key: "inc-default",
              title: "เงินเดือนประจำ",
              amountBaht: "35000",
              isPrimarySalary: true,
            },
          ],
    );
    setDraftExpenses(
      dashboard.fixedExpenses.map((e) => ({
        key: e.id,
        title: e.title,
        category: e.category,
        amountBaht: String(e.amountBaht),
        dueDay: e.dueDay ? String(e.dueDay) : "",
      })),
    );
    setDraftThreshold(dashboard.warningThresholdPct);
    setShowFixedPlanModal(true);
  }

  async function handleSaveFixedPlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingFixedPlan(true);
    setBannerMessage(null);
    try {
      const cleanedIncomes = draftIncomes
        .filter((i) => i.title.trim() && Number(i.amountBaht) >= 0)
        .map((i, idx) => ({
          title: i.title.trim(),
          amountBaht: Number(i.amountBaht) || 0,
          isPrimarySalary: idx === 0,
        }));

      const cleanedExpenses = draftExpenses
        .filter((ex) => ex.title.trim() && Number(ex.amountBaht) >= 0)
        .map((ex) => ({
          title: ex.title.trim(),
          category: ex.category,
          amountBaht: Number(ex.amountBaht) || 0,
          dueDay:
            ex.dueDay && Number(ex.dueDay) >= 1 && Number(ex.dueDay) <= 31
              ? Math.round(Number(ex.dueDay))
              : null,
        }));

      const res = await fetch("/api/fixed-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixedIncomes: cleanedIncomes,
          fixedExpenses: cleanedExpenses,
          warningThresholdPct: draftThreshold,
          applyToCurrentMonth: true,
          targetYearMonth: dashboard.selectedMonth,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถบันทึกแผนรายเดือนได้");
      }
      setDashboard(data.dashboard);
      setShowFixedPlanModal(false);
      setBannerMessage({
        type: "success",
        text: "อัปเดตฐานเงินเดือนและรายจ่ายคงที่รายเดือนเรียบร้อยแล้ว",
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setSavingFixedPlan(false);
    }
  }

  async function handleDevLogout() {
    await fetch("/api/dev-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    window.location.reload();
  }

  const filteredTransactions = useMemo(() => {
    return dashboard.transactions.filter((tx) => {
      if (filterType !== "ALL" && tx.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchCat = tx.categoryLabel.toLowerCase().includes(q);
        const matchNote = (tx.note || "").toLowerCase().includes(q);
        return matchTitle || matchCat || matchNote;
      }
      return true;
    });
  }, [dashboard.transactions, filterType, searchQuery]);

  const maxTrendValue = useMemo(() => {
    let maxVal = 1;
    for (const item of dashboard.monthlyTrend) {
      maxVal = Math.max(
        maxVal,
        item.totalIncomeBaht,
        item.totalExpenseBaht,
        Math.abs(item.totalAvailableBalanceBaht),
      );
    }
    return maxVal;
  }, [dashboard.monthlyTrend]);

  const statusClass =
    metrics.status === "HEALTHY"
      ? "is-healthy"
      : metrics.status === "WARNING"
        ? "is-warning"
        : metrics.status === "OVERSPENT_MONTH"
          ? "is-overspent"
          : "is-critical";

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar liquid-glass">
        <div className="brand-cluster">
          <div className="brand-badge">
            <Wallet size={22} />
          </div>
          <div>
            <div className="brand-title">
              <span>E-Pocket</span>
              <span className="monolith-tag">Monolith Financial Hub</span>
            </div>
            <p className="brand-subtitle">
              บัญชี Monolith: {dashboard.user.name || dashboard.user.email} (
              {dashboard.user.email})
            </p>
          </div>
        </div>

        <div className="topbar-controls">
          {/* Month Switcher */}
          <div className="month-switcher" aria-label="สลับเดือน">
            <button
              id="prev-month-btn"
              type="button"
              className="month-nav-btn"
              disabled={loadingMonth}
              onClick={() =>
                switchMonth(shiftYearMonth(dashboard.selectedMonth, -1))
              }
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft size={17} />
            </button>
            <div id="current-month-display" className="month-label-display">
              {formatThaiMonthLabel(dashboard.selectedMonth)}
            </div>
            <button
              id="next-month-btn"
              type="button"
              className="month-nav-btn"
              disabled={loadingMonth}
              onClick={() =>
                switchMonth(shiftYearMonth(dashboard.selectedMonth, 1))
              }
              title="เดือนถัดไป"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <button
            id="open-fixed-plan-modal-btn"
            type="button"
            onClick={openFixedPlanEditor}
            className="btn-secondary"
          >
            <Settings size={15} />
            <span>ตั้งค่าเงินเดือน / รายจ่ายคงที่</span>
          </button>

          <a href={hubUrl} className="btn-secondary">
            <span>Monolith Hub</span>
            <ExternalLink size={14} />
          </a>

          {isDevSimulation && (
            <button
              id="dev-logout-btn"
              type="button"
              onClick={handleDevLogout}
              className="btn-ghost"
              title="ออกจากโหมดจำลอง"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </header>

      {bannerMessage && (
        <div
          className={
            bannerMessage.type === "error"
              ? "alert-banner-error"
              : "alert-banner-success"
          }
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{bannerMessage.text}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="btn-ghost"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Financial Health Status Banner */}
      <section className="liquid-card health-banner">
        <div>
          <div id="financial-status-badge" className={`status-pill ${statusClass}`}>
            <span className="status-dot" />
            <span>สถานะการเงิน: {metrics.statusLabel}</span>
          </div>
          <h1
            style={{
              fontSize: "clamp(18px, 2vw, 22px)",
              fontWeight: 700,
              marginBottom: "6px",
            }}
          >
            สรุปสถานะกระเป๋าเงินประจำเดือน {metrics.monthLabel}
          </h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
            {metrics.statusDescription}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "16px 18px",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
              งบใช้จ่ายได้เฉลี่ยต่อวัน (Daily Safe-to-Spend)
            </span>
            <strong
              id="daily-safe-to-spend-value"
              style={{
                fontSize: "20px",
                color: "var(--accent-mint)",
                fontWeight: 700,
              }}
            >
              {formatBaht(metrics.dailySafeToSpendBaht)} / วัน
            </strong>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              <span>สัดส่วนรายจ่ายรวมต่อวงเงินที่มีทั้งหมด</span>
              <span>{metrics.expenseRatioPct.toFixed(1)}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, metrics.expenseRatioPct)}%`,
                  background:
                    metrics.status === "CRITICAL"
                      ? "var(--status-critical)"
                      : metrics.status === "OVERSPENT_MONTH"
                        ? "var(--status-overspent)"
                        : metrics.status === "WARNING"
                          ? "var(--status-warning)"
                          : "var(--status-healthy)",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11.5px",
              color: "var(--text-muted)",
            }}
          >
            <span>
              เงินเหลือตั้งต้นหลังหักรายจ่ายคงที่:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {formatBaht(metrics.baselineRemainingBaht)}
              </strong>
            </span>
            <span>
              เหลืออีก {metrics.remainingDays} วันในเดือนนี้
            </span>
          </div>
        </div>
      </section>

      {/* 4 Primary KPI Cards */}
      <section className="kpi-grid" aria-label="ตัวชี้วัดทางการเงินหลัก">
        {/* Card 1: Total Available Balance (with Rollover) */}
        <article className="liquid-card liquid-card-interactive kpi-card">
          <div>
            <div className="kpi-header">
              <span>ยอดเงินคงเหลือสุทธิ (รวมยอดทบ)</span>
              <div className="kpi-icon" style={{ color: "var(--accent-mint)" }}>
                <Wallet size={18} />
              </div>
            </div>
            <div
              id="kpi-total-available-balance"
              className="kpi-value"
              style={{
                marginTop: "10px",
                color:
                  metrics.totalAvailableBalanceBaht >= 0
                    ? "var(--accent-mint)"
                    : "var(--status-critical)",
              }}
            >
              {formatBaht(metrics.totalAvailableBalanceBaht)}
            </div>
          </div>
          <div className="kpi-meta">
            <span>ยอดทบยกมาจากเดือนก่อน</span>
            <strong
              id="kpi-carryover-balance"
              style={{
                color:
                  metrics.carryOverBaht >= 0
                    ? "var(--status-healthy)"
                    : "var(--status-critical)",
              }}
            >
              {formatBaht(metrics.carryOverBaht, { showSign: true })}
            </strong>
          </div>
        </article>

        {/* Card 2: Monthly Net Cashflow */}
        <article className="liquid-card liquid-card-interactive kpi-card">
          <div>
            <div className="kpi-header">
              <span>เงินเหลือเฉพาะเดือนนี้</span>
              <div
                className="kpi-icon"
                style={{
                  color:
                    metrics.monthNetCashflowBaht >= 0
                      ? "var(--status-healthy)"
                      : "var(--status-critical)",
                }}
              >
                <Layers size={18} />
              </div>
            </div>
            <div
              id="kpi-month-net-cashflow"
              className="kpi-value"
              style={{
                marginTop: "10px",
                color:
                  metrics.monthNetCashflowBaht >= 0
                    ? "var(--status-healthy)"
                    : "var(--status-critical)",
              }}
            >
              {formatBaht(metrics.monthNetCashflowBaht, { showSign: true })}
            </div>
          </div>
          <div className="kpi-meta">
            <span>ฐานคงเหลือหลังหักจ่ายคงที่</span>
            <strong>{formatBaht(metrics.baselineRemainingBaht)}</strong>
          </div>
        </article>

        {/* Card 3: Total Income */}
        <article className="liquid-card liquid-card-interactive kpi-card">
          <div>
            <div className="kpi-header">
              <span>รายรับรวมเดือนนี้</span>
              <div
                className="kpi-icon"
                style={{ color: "var(--status-healthy)" }}
              >
                <TrendingUp size={18} />
              </div>
            </div>
            <div
              id="kpi-total-income"
              className="kpi-value"
              style={{ marginTop: "10px", color: "var(--text-primary)" }}
            >
              {formatBaht(metrics.totalIncomeBaht)}
            </div>
          </div>
          <div className="kpi-meta">
            <span>คงที่ {formatBaht(metrics.fixedIncomeBaht)}</span>
            <strong style={{ color: "var(--status-healthy)" }}>
              +เสริม {formatBaht(metrics.extraIncomeBaht)}
            </strong>
          </div>
        </article>

        {/* Card 4: Total Expense */}
        <article className="liquid-card liquid-card-interactive kpi-card">
          <div>
            <div className="kpi-header">
              <span>รายจ่ายรวมเดือนนี้</span>
              <div
                className="kpi-icon"
                style={{ color: "var(--status-critical)" }}
              >
                <TrendingDown size={18} />
              </div>
            </div>
            <div
              id="kpi-total-expense"
              className="kpi-value"
              style={{ marginTop: "10px", color: "var(--text-primary)" }}
            >
              {formatBaht(metrics.totalExpenseBaht)}
            </div>
          </div>
          <div className="kpi-meta">
            <span>คงที่ {formatBaht(metrics.fixedExpenseBaht)}</span>
            <strong style={{ color: "var(--status-critical)" }}>
              +จ่ายเพิ่ม {formatBaht(metrics.extraExpenseBaht)}
            </strong>
          </div>
        </article>
      </section>

      {/* Main Grid: Left = Add & List Transactions, Right = Fixed Plan & Analytics */}
      <div className="dashboard-main-grid">
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Quick Add Transaction Card */}
          <section className="liquid-card panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <Plus size={18} color="var(--accent-mint)" />
                  <span>เพิ่มการใช้จ่าย หรือรายรับเพิ่มเติม</span>
                </h2>
                <p className="panel-subtitle">
                  บันทึกรายการใช้จ่ายรายวันหรือรายรับเสริม ระบบจะคำนวณเงินคงเหลือทันที
                </p>
              </div>

              {/* Segmented Toggle */}
              <div
                style={{
                  display: "inline-flex",
                  background: "rgba(10, 14, 21, 0.8)",
                  padding: "4px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <button
                  id="toggle-tx-expense-btn"
                  type="button"
                  onClick={() => handleTxTypeSwitch("EXPENSE")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "9px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    background:
                      txType === "EXPENSE"
                        ? "rgba(253, 164, 175, 0.18)"
                        : "transparent",
                    color:
                      txType === "EXPENSE" ? "#fda4af" : "var(--text-secondary)",
                  }}
                >
                  รายจ่ายเพิ่มเติม
                </button>
                <button
                  id="toggle-tx-income-btn"
                  type="button"
                  onClick={() => handleTxTypeSwitch("INCOME")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "9px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    background:
                      txType === "INCOME"
                        ? "rgba(110, 231, 183, 0.18)"
                        : "transparent",
                    color:
                      txType === "INCOME" ? "#6ee7b7" : "var(--text-secondary)",
                  }}
                >
                  รายรับเพิ่มเติม
                </button>
              </div>
            </div>

            <form
              onSubmit={handleAddTransaction}
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 1fr 0.9fr",
                gap: "12px",
              }}
            >
              <div className="form-field">
                <label className="form-label" htmlFor="tx-title-input">
                  รายละเอียดรายการ
                </label>
                <input
                  id="tx-title-input"
                  className="epocket-input"
                  placeholder={
                    txType === "EXPENSE"
                      ? "เช่น ค่าอาหารกลางวัน, เติมน้ำมัน"
                      : "เช่น โบนัสพิเศษ, งานฟรีแลนซ์"
                  }
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="tx-category-select">
                  หมวดหมู่
                </label>
                <select
                  id="tx-category-select"
                  className="epocket-select"
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value as CategoryCode)}
                >
                  {(txType === "EXPENSE"
                    ? EXPENSE_CATEGORIES
                    : INCOME_CATEGORIES
                  ).map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="tx-amount-input">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  id="tx-amount-input"
                  type="number"
                  min="0.01"
                  step="any"
                  className="epocket-input"
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="tx-date-input">
                  วันที่ทำรายการ
                </label>
                <input
                  id="tx-date-input"
                  type="date"
                  className="epocket-input"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="tx-note-input">
                  บันทึกช่วยจำ (ถ้ามี)
                </label>
                <input
                  id="tx-note-input"
                  className="epocket-input"
                  placeholder="ระบุหมายเหตุเพิ่มเติม"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <button
                  id="submit-transaction-btn"
                  type="submit"
                  disabled={submittingTx}
                  className="btn-primary"
                  style={{ width: "100%", height: "42px" }}
                >
                  <Plus size={16} />
                  <span>
                    {submittingTx
                      ? "กำลังบันทึก..."
                      : txType === "EXPENSE"
                        ? "บันทึกรายจ่าย"
                        : "บันทึกรายรับ"}
                  </span>
                </button>
              </div>
            </form>
          </section>

          {/* Transaction History List */}
          <section className="liquid-card panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  รายการรับ-จ่ายเพิ่มเติมประจำเดือน ({dashboard.transactions.length})
                </h2>
                <p className="panel-subtitle">
                  รายการที่เกิดขึ้นนอกเหนือจากเงินเดือนและรายจ่ายคงที่รายเดือน
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative" }}>
                  <Search
                    size={14}
                    style={{
                      position: "absolute",
                      left: "11px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    id="tx-search-input"
                    className="epocket-input"
                    style={{
                      paddingLeft: "32px",
                      minHeight: "36px",
                      fontSize: "13px",
                      width: "180px",
                    }}
                    placeholder="ค้นหารายการ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  id="tx-filter-type-select"
                  className="epocket-select"
                  style={{
                    minHeight: "36px",
                    fontSize: "13px",
                    width: "130px",
                  }}
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(e.target.value as "ALL" | "EXPENSE" | "INCOME")
                  }
                >
                  <option value="ALL">ทั้งหมด</option>
                  <option value="EXPENSE">เฉพาะรายจ่าย</option>
                  <option value="INCOME">เฉพาะรายรับ</option>
                </select>
              </div>
            </div>

            <div className="item-list">
              {filteredTransactions.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "13.5px",
                    border: "1px dashed rgba(255,255,255,0.1)",
                    borderRadius: "14px",
                  }}
                >
                  ยังไม่มีรายการรับ-จ่ายเพิ่มเติมในเดือนนี้
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div key={tx.id} className="item-row">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          display: "grid",
                          placeItems: "center",
                          background:
                            tx.type === "INCOME"
                              ? "rgba(110, 231, 183, 0.12)"
                              : "rgba(253, 164, 175, 0.12)",
                          color:
                            tx.type === "INCOME"
                              ? "var(--status-healthy)"
                              : "var(--status-critical)",
                          flexShrink: 0,
                        }}
                      >
                        {tx.type === "INCOME" ? (
                          <ArrowUpRight size={17} />
                        ) : (
                          <ArrowDownRight size={17} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "var(--text-primary)",
                          }}
                        >
                          {tx.title}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            <span
                              className="category-dot"
                              style={{ background: tx.categoryColor }}
                            />
                            {tx.categoryLabel}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(tx.occurredAt).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          {tx.note && (
                            <>
                              <span>•</span>
                              <span>{tx.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexShrink: 0,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "15px",
                          color:
                            tx.type === "INCOME"
                              ? "var(--status-healthy)"
                              : "var(--status-critical)",
                        }}
                      >
                        {tx.type === "INCOME" ? "+" : "-"}
                        {formatBaht(tx.amountBaht)}
                      </strong>
                      <button
                        type="button"
                        onClick={() => openEditTransaction(tx)}
                        className="btn-ghost"
                        title="แก้ไขรายการ"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="btn-ghost"
                        title="ลบรายการ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Analytics & Fixed Baseline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Category Breakdown */}
          <section className="liquid-card panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <PieChart size={18} color="var(--accent-mint)" />
                  <span>สัดส่วนรายจ่ายแยกตามหมวดหมู่</span>
                </h2>
                <p className="panel-subtitle">
                  รวมรายจ่ายคงที่และรายจ่ายเพิ่มเติมของเดือนนี้
                </p>
              </div>
            </div>

            {dashboard.categoryBreakdown.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                }}
              >
                ยังไม่มีข้อมูลรายจ่ายในเดือนนี้
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {dashboard.categoryBreakdown.map((cat) => (
                  <div key={cat.category}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          fontWeight: 500,
                        }}
                      >
                        <span
                          className="category-dot"
                          style={{ background: cat.color }}
                        />
                        <span>{cat.label}</span>
                      </span>
                      <span>
                        <strong>{formatBaht(cat.totalAmountBaht)}</strong>{" "}
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: "12px",
                          }}
                        >
                          ({cat.percentage}%)
                        </span>
                      </span>
                    </div>
                    <div
                      className="progress-track"
                      style={{ height: "7px" }}
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, cat.percentage)}%`,
                          background: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Monthly Cashflow & Rollover Trend */}
          <section className="liquid-card panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <BarChart3 size={18} color="var(--accent-mint)" />
                  <span>แนวโน้มรายเดือน & ยอดเงินทบสะสม</span>
                </h2>
                <p className="panel-subtitle">
                  เปรียบเทียบรายรับรวม, รายจ่ายรวม และยอดเงินคงเหลือทบยอด
                </p>
              </div>
            </div>

            <div className="trend-chart">
              {dashboard.monthlyTrend.map((m) => {
                const incHeight = Math.max(
                  6,
                  Math.round((m.totalIncomeBaht / maxTrendValue) * 120),
                );
                const expHeight = Math.max(
                  6,
                  Math.round((m.totalExpenseBaht / maxTrendValue) * 120),
                );
                const balHeight = Math.max(
                  6,
                  Math.round(
                    (Math.max(0, m.totalAvailableBalanceBaht) / maxTrendValue) *
                      120,
                  ),
                );
                return (
                  <div key={m.yearMonth} className="trend-col">
                    <div className="trend-bars-wrap">
                      <div
                        className="trend-bar"
                        style={{
                          height: `${incHeight}px`,
                          background: "var(--status-healthy)",
                        }}
                        title={`รายรับรวม: ${formatBaht(m.totalIncomeBaht)}`}
                      />
                      <div
                        className="trend-bar"
                        style={{
                          height: `${expHeight}px`,
                          background: "var(--status-critical)",
                        }}
                        title={`รายจ่ายรวม: ${formatBaht(m.totalExpenseBaht)}`}
                      />
                      <div
                        className="trend-bar"
                        style={{
                          height: `${balHeight}px`,
                          background: "var(--accent-mint)",
                        }}
                        title={`คงเหลือสุทธิ (รวมยอดทบ): ${formatBaht(m.totalAvailableBalanceBaht)}`}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        fontWeight:
                          m.yearMonth === dashboard.selectedMonth ? 700 : 500,
                        color:
                          m.yearMonth === dashboard.selectedMonth
                            ? "var(--accent-mint)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {m.yearMonth}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color:
                          m.totalAvailableBalanceBaht >= 0
                            ? "var(--status-healthy)"
                            : "var(--status-critical)",
                      }}
                    >
                      {formatBaht(m.totalAvailableBalanceBaht, { compact: true })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "16px",
                marginTop: "14px",
                fontSize: "11.5px",
                color: "var(--text-secondary)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span
                  className="category-dot"
                  style={{ background: "var(--status-healthy)" }}
                />
                รายรับรวม
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span
                  className="category-dot"
                  style={{ background: "var(--status-critical)" }}
                />
                รายจ่ายรวม
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span
                  className="category-dot"
                  style={{ background: "var(--accent-mint)" }}
                />
                คงเหลือสุทธิ (รวมยอดทบ)
              </span>
            </div>
          </section>

          {/* Monthly Fixed Baseline Summary */}
          <section className="liquid-card panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  <Calendar size={18} color="var(--accent-mint)" />
                  <span>ฐานเงินเดือนและรายจ่ายคงที่ประจำเดือนนี้</span>
                </h2>
                <p className="panel-subtitle">
                  เงินเหลือตั้งต้น: {formatBaht(metrics.baselineRemainingBaht)} / เดือน
                </p>
              </div>
              <button
                type="button"
                onClick={openFixedPlanEditor}
                className="btn-ghost"
                style={{ color: "var(--accent-mint)", fontSize: "12.5px" }}
              >
                แก้ไขแผนคงที่
              </button>
            </div>

            <div className="item-list">
              {dashboard.monthFixedSnapshots.incomes.map((inc) => (
                <div key={inc.id} className="item-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      className="category-dot"
                      style={{ background: "var(--status-healthy)" }}
                    />
                    <span style={{ fontSize: "13.5px", fontWeight: 500 }}>
                      {inc.title}
                    </span>
                  </div>
                  <strong
                    style={{
                      fontSize: "13.5px",
                      color: "var(--status-healthy)",
                    }}
                  >
                    +{formatBaht(inc.amountBaht)}
                  </strong>
                </div>
              ))}

              {dashboard.monthFixedSnapshots.expenses.map((exp) => (
                <div key={exp.id} className="item-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      className="category-dot"
                      style={{ background: exp.categoryColor }}
                    />
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 500 }}>
                        {exp.title}
                      </div>
                      <div
                        style={{
                          fontSize: "11.5px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {exp.categoryLabel}
                        {exp.dueDay ? ` • ชำระทุกวันที่ ${exp.dueDay}` : ""}
                      </div>
                    </div>
                  </div>
                  <strong
                    style={{
                      fontSize: "13.5px",
                      color: "var(--status-critical)",
                    }}
                  >
                    -{formatBaht(exp.amountBaht)}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          {/* Monolith Hub Alert Logs */}
          {dashboard.recentAlerts.length > 0 && (
            <section className="liquid-card panel-card">
              <div className="panel-header">
                <h2 className="panel-title">
                  <Bell size={17} color="var(--status-warning)" />
                  <span>ประวัติการแจ้งเตือนไปยัง Monolith Hub</span>
                </h2>
              </div>
              <div className="item-list">
                {dashboard.recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="item-row"
                    style={{ fontSize: "12.5px" }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--status-warning)" }}>
                        [{alert.level}]
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        {alert.message}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {alert.sentToHub ? "ส่งเข้า Hub แล้ว" : "บันทึกในระบบ"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="modal-backdrop">
          <div className="liquid-glass modal-panel">
            <div className="panel-header">
              <h2 className="panel-title">แก้ไขรายการรับ-จ่าย</h2>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="btn-ghost"
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={handleSaveEditTransaction}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div className="form-field">
                <label className="form-label">ชื่อรายการ</label>
                <input
                  className="epocket-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label">หมวดหมู่</label>
                <select
                  className="epocket-select"
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as CategoryCode)
                  }
                >
                  {(editingTx.type === "EXPENSE"
                    ? EXPENSE_CATEGORIES
                    : INCOME_CATEGORIES
                  ).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  className="epocket-input"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label">หมายเหตุ</label>
                <input
                  className="epocket-input"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="btn-secondary"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={16} />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Plan Editor Modal */}
      {showFixedPlanModal && (
        <div className="modal-backdrop">
          <div className="liquid-glass modal-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  ปรับปรุงฐานเงินเดือนคงที่ & รายจ่ายคงที่รายเดือน
                </h2>
                <p className="panel-subtitle">
                  การแก้ไขจะมีผลกับเดือนที่เลือก ({formatThaiMonthLabel(dashboard.selectedMonth)}) และเดือนถัดไป
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFixedPlanModal(false)}
                className="btn-ghost"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSaveFixedPlan}
              style={{ display: "flex", flexDirection: "column", gap: "18px" }}
            >
              {/* Fixed Incomes */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ fontSize: "14px" }}>
                    รายการเงินเดือนและรายรับคงที่
                  </strong>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftIncomes((prev) => [
                        ...prev,
                        {
                          key: `inc-${Date.now()}`,
                          title: "รายรับคงที่เสริม",
                          amountBaht: "0",
                          isPrimarySalary: false,
                        },
                      ])
                    }
                    className="btn-secondary"
                    style={{ minHeight: "32px", padding: "4px 10px", fontSize: "12px" }}
                  >
                    + เพิ่มรายรับคงที่
                  </button>
                </div>
                <div className="item-list">
                  {draftIncomes.map((inc) => (
                    <div
                      key={inc.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.3fr 1fr auto",
                        gap: "8px",
                      }}
                    >
                      <input
                        className="epocket-input"
                        value={inc.title}
                        onChange={(e) =>
                          setDraftIncomes((prev) =>
                            prev.map((row) =>
                              row.key === inc.key
                                ? { ...row, title: e.target.value }
                                : row,
                            ),
                          )
                        }
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="epocket-input"
                        value={inc.amountBaht}
                        onChange={(e) =>
                          setDraftIncomes((prev) =>
                            prev.map((row) =>
                              row.key === inc.key
                                ? { ...row, amountBaht: e.target.value }
                                : row,
                            ),
                          )
                        }
                        required
                      />
                      {draftIncomes.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraftIncomes((prev) =>
                              prev.filter((r) => r.key !== inc.key),
                            )
                          }
                          className="btn-ghost"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fixed Expenses */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ fontSize: "14px" }}>
                    รายการรายจ่ายคงที่รายเดือน
                  </strong>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftExpenses((prev) => [
                        ...prev,
                        {
                          key: `exp-${Date.now()}`,
                          title: "",
                          category: "OTHER_EXPENSE",
                          amountBaht: "",
                          dueDay: "",
                        },
                      ])
                    }
                    className="btn-secondary"
                    style={{ minHeight: "32px", padding: "4px 10px", fontSize: "12px" }}
                  >
                    + เพิ่มรายจ่ายคงที่
                  </button>
                </div>
                <div className="item-list">
                  {draftExpenses.map((exp) => (
                    <div
                      key={exp.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1fr 0.8fr auto",
                        gap: "8px",
                      }}
                    >
                      <input
                        className="epocket-input"
                        placeholder="ชื่อรายจ่ายคงที่"
                        value={exp.title}
                        onChange={(e) =>
                          setDraftExpenses((prev) =>
                            prev.map((row) =>
                              row.key === exp.key
                                ? { ...row, title: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                      <select
                        className="epocket-select"
                        value={exp.category}
                        onChange={(e) =>
                          setDraftExpenses((prev) =>
                            prev.map((row) =>
                              row.key === exp.key
                                ? {
                                    ...row,
                                    category: e.target.value as CategoryCode,
                                  }
                                : row,
                            ),
                          )
                        }
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="epocket-input"
                        placeholder="จำนวนเงิน"
                        value={exp.amountBaht}
                        onChange={(e) =>
                          setDraftExpenses((prev) =>
                            prev.map((row) =>
                              row.key === exp.key
                                ? { ...row, amountBaht: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraftExpenses((prev) =>
                            prev.filter((r) => r.key !== exp.key),
                          )
                        }
                        className="btn-ghost"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowFixedPlanModal(false)}
                  className="btn-secondary"
                >
                  ยกเลิก
                </button>
                <button
                  id="save-fixed-plan-btn"
                  type="submit"
                  disabled={savingFixedPlan}
                  className="btn-primary"
                >
                  <Check size={16} />
                  <span>
                    {savingFixedPlan ? "กำลังบันทึก..." : "บันทึกแผนรายเดือน"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
