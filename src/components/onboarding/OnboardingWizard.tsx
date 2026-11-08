"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  formatBaht,
  getRemainingDaysInMonth,
  getCurrentYearMonth,
  formatThaiMonthLabel,
  type CategoryCode,
} from "@/lib/finance-engine";
import type { DashboardDataDTO } from "@/lib/ledger";
import { EPocketSquareMark } from "@/components/common/EPocketLogo";

interface OnboardingWizardProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  hubUrl: string;
  onComplete: (dashboard: DashboardDataDTO) => void;
}

interface DraftFixedExpense {
  key: string;
  title: string;
  category: CategoryCode;
  amountBaht: string;
  dueDay: string;
}

interface DraftExtraIncome {
  key: string;
  title: string;
  amountBaht: string;
}

const PRESET_FIXED_EXPENSES: {
  title: string;
  category: CategoryCode;
  defaultAmount: number;
  dueDay: number;
}[] = [
  { title: "ค่าเช่าที่พัก / ผ่อนคอนโด", category: "HOUSING", defaultAmount: 8500, dueDay: 1 },
  { title: "ค่าไฟฟ้าและน้ำประปา", category: "UTILITIES", defaultAmount: 1800, dueDay: 15 },
  { title: "ค่าอินเทอร์เน็ตบ้านและมือถือ", category: "UTILITIES", defaultAmount: 1100, dueDay: 10 },
  { title: "ค่าเดินทางประจำเดือน / BTS", category: "TRANSPORT", defaultAmount: 2500, dueDay: 1 },
  { title: "ผ่อนชำระบัตรเครดิต / สินเชื่อ", category: "DEBT", defaultAmount: 3000, dueDay: 25 },
  { title: "บริการรายเดือน (Streaming / Cloud)", category: "SUBSCRIPTION", defaultAmount: 450, dueDay: 5 },
  { title: "เงินออม / ลงทุนประจำเดือน (DCA)", category: "SAVINGS", defaultAmount: 3000, dueDay: 1 },
];

export function OnboardingWizard({
  user,
  hubUrl,
  onComplete,
}: OnboardingWizardProps) {
  const [primarySalaryTitle, setPrimarySalaryTitle] = useState("เงินเดือนประจำ");
  const [primarySalaryBaht, setPrimarySalaryBaht] = useState("35000");
  const [additionalIncomes, setAdditionalIncomes] = useState<DraftExtraIncome[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<DraftFixedExpense[]>([
    {
      key: "exp-1",
      title: "ค่าเช่าที่พัก / ผ่อนคอนโด",
      category: "HOUSING",
      amountBaht: "8500",
      dueDay: "1",
    },
    {
      key: "exp-2",
      title: "ค่าน้ำ / ค่าไฟ / อินเทอร์เน็ต",
      category: "UTILITIES",
      amountBaht: "2200",
      dueDay: "15",
    },
  ]);
  const [warningThresholdPct, setWarningThresholdPct] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentYm = getCurrentYearMonth();
  const { totalDays, remainingDays } = getRemainingDaysInMonth(currentYm);

  const preview = useMemo(() => {
    const mainSalary = Math.max(0, Number(primarySalaryBaht) || 0);
    const extraFixedInc = additionalIncomes.reduce(
      (sum, item) => sum + Math.max(0, Number(item.amountBaht) || 0),
      0,
    );
    const totalFixedIncome = mainSalary + extraFixedInc;
    const totalFixedExpense = fixedExpenses.reduce(
      (sum, item) => sum + Math.max(0, Number(item.amountBaht) || 0),
      0,
    );
    const monthlyRemaining = totalFixedIncome - totalFixedExpense;
    const dailyAllowance =
      monthlyRemaining > 0 && remainingDays > 0
        ? monthlyRemaining / remainingDays
        : 0;
    const fixedExpensePct =
      totalFixedIncome > 0
        ? Math.min(100, Math.round((totalFixedExpense / totalFixedIncome) * 100))
        : 0;

    return {
      totalFixedIncome,
      totalFixedExpense,
      monthlyRemaining,
      dailyAllowance,
      fixedExpensePct,
    };
  }, [primarySalaryBaht, additionalIncomes, fixedExpenses, remainingDays]);

  function addFixedExpenseRow(preset?: {
    title: string;
    category: CategoryCode;
    defaultAmount: number;
    dueDay: number;
  }) {
    setFixedExpenses((prev) => [
      ...prev,
      {
        key: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: preset?.title || "",
        category: preset?.category || "OTHER_EXPENSE",
        amountBaht: preset ? String(preset.defaultAmount) : "",
        dueDay: preset ? String(preset.dueDay) : "",
      },
    ]);
  }

  function removeFixedExpenseRow(key: string) {
    setFixedExpenses((prev) => prev.filter((item) => item.key !== key));
  }

  function updateFixedExpenseRow(
    key: string,
    field: keyof DraftFixedExpense,
    value: string,
  ) {
    setFixedExpenses((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

  function addAdditionalIncomeRow() {
    setAdditionalIncomes((prev) => [
      ...prev,
      {
        key: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: "",
        amountBaht: "",
      },
    ]);
  }

  function removeAdditionalIncomeRow(key: string) {
    setAdditionalIncomes((prev) => prev.filter((item) => item.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const parsedSalary = Number(primarySalaryBaht);
    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      setErrorMsg("กรุณากรอกเงินเดือนคงที่ให้มากกว่า 0 บาท");
      return;
    }

    const cleanedExpenses = fixedExpenses
      .filter((item) => item.title.trim().length > 0 || Number(item.amountBaht) > 0)
      .map((item) => ({
        title: item.title.trim() || "รายจ่ายคงที่",
        category: item.category,
        amountBaht: Math.max(0, Number(item.amountBaht) || 0),
        dueDay:
          item.dueDay && Number(item.dueDay) >= 1 && Number(item.dueDay) <= 31
            ? Math.round(Number(item.dueDay))
            : null,
      }));

    const cleanedIncomes = additionalIncomes
      .filter((item) => item.title.trim().length > 0 && Number(item.amountBaht) > 0)
      .map((item) => ({
        title: item.title.trim(),
        amountBaht: Math.max(0, Number(item.amountBaht) || 0),
        isPrimarySalary: false,
      }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primarySalaryTitle: primarySalaryTitle.trim() || "เงินเดือนประจำ",
          primarySalaryBaht: parsedSalary,
          additionalFixedIncomes: cleanedIncomes,
          fixedExpenses: cleanedExpenses,
          warningThresholdPct,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถบันทึกข้อมูลเริ่มต้นได้");
      }
      onComplete(data.dashboard);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding-container">
      {/* Header Bar */}
      <header className="topbar liquid-glass">
        <div className="brand-cluster">
          <EPocketSquareMark size={44} />
          <div>
            <div className="brand-title">
              <span>E-Pocket</span>
              <span className="monolith-tag">Monolith Account</span>
            </div>
            <p className="brand-subtitle">
              ตั้งค่าฐานการเงินรายเดือนครั้งแรกสำหรับ {user.name || user.email}
            </p>
          </div>
        </div>
        <div className="topbar-controls">
          <a href={hubUrl} className="btn-secondary">
            กลับหน้า Monolith Hub
          </a>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="onboarding-grid">
        {/* Left Column: Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Step 1: Fixed Salary */}
          <section className="liquid-card panel-card">
            <div className="panel-header">
              <div>
                <h1 className="panel-title" style={{ fontSize: "18px" }}>
                  1. ป้อนเงินเดือนคงที่ของคุณ
                </h1>
                <p className="panel-subtitle">
                  ระบบจะใช้ยอดนี้เป็นฐานรายรับตั้งต้นของทุกเดือนโดยอัตโนมัติ
                </p>
              </div>
              <button
                id="onboarding-add-extra-fixed-income-btn"
                type="button"
                onClick={addAdditionalIncomeRow}
                className="btn-secondary"
              >
                <Plus size={15} />
                <span>เพิ่มรายรับคงที่อื่น</span>
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
              }}
            >
              <div className="form-field">
                <label className="form-label" htmlFor="primary-salary-title">
                  ชื่อรายการเงินเดือนหลัก
                </label>
                <input
                  id="primary-salary-title"
                  className="epocket-input"
                  value={primarySalaryTitle}
                  onChange={(e) => setPrimarySalaryTitle(e.target.value)}
                  placeholder="เช่น เงินเดือนประจำ"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="primary-salary-amount">
                  จำนวนเงินเดือนคงที่ (บาท/เดือน)
                </label>
                <input
                  id="primary-salary-amount"
                  type="number"
                  min="0"
                  step="any"
                  className="epocket-input"
                  value={primarySalaryBaht}
                  onChange={(e) => setPrimarySalaryBaht(e.target.value)}
                  placeholder="35000"
                  required
                />
              </div>
            </div>

            {additionalIncomes.length > 0 && (
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "14px",
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "12.5px",
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                  }}
                >
                  รายรับคงที่เพิ่มเติมรายเดือน (เช่น ค่าตำแหน่ง, ค่าเช่าที่ได้รับประจำ)
                </span>
                {additionalIncomes.map((inc) => (
                  <div
                    key={inc.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr auto",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      className="epocket-input"
                      placeholder="ชื่อรายรับคงที่"
                      value={inc.title}
                      onChange={(e) =>
                        setAdditionalIncomes((prev) =>
                          prev.map((row) =>
                            row.key === inc.key
                              ? { ...row, title: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="epocket-input"
                      placeholder="จำนวนเงิน (บาท)"
                      value={inc.amountBaht}
                      onChange={(e) =>
                        setAdditionalIncomes((prev) =>
                          prev.map((row) =>
                            row.key === inc.key
                              ? { ...row, amountBaht: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeAdditionalIncomeRow(inc.key)}
                      className="btn-ghost"
                      aria-label="ลบรายรับคงที่"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Step 2: Fixed Monthly Expenses */}
          <section className="liquid-card panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title" style={{ fontSize: "18px" }}>
                  2. ป้อนรายจ่ายคงที่รายเดือน
                </h2>
                <p className="panel-subtitle">
                  ระบุภาระค่าใช้จ่ายประจำที่ต้องจ่ายทุกเดือน เพื่อคำนวณเงินเหลือใช้จริง
                </p>
              </div>
              <button
                id="onboarding-add-fixed-expense-btn"
                type="button"
                onClick={() => addFixedExpenseRow()}
                className="btn-secondary"
              >
                <Plus size={15} />
                <span>เพิ่มรายการ</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={13} color="var(--accent-mint)" />
                <span>กดเพื่อเพิ่มรายการยอดนิยมอย่างรวดเร็ว:</span>
              </div>
              <div className="preset-chips">
                {PRESET_FIXED_EXPENSES.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => addFixedExpenseRow(preset)}
                    className="preset-chip"
                  >
                    + {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Expense Rows */}
            <div className="item-list">
              {fixedExpenses.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "26px 16px",
                    color: "var(--text-secondary)",
                    fontSize: "13.5px",
                    border: "1px dashed rgba(255,255,255,0.12)",
                    borderRadius: "14px",
                  }}
                >
                  ยังไม่มีรายการรายจ่ายคงที่ กดปุ่ม &ldquo;+ เพิ่มรายการ&rdquo; ด้านบนได้เลย
                </div>
              ) : (
                fixedExpenses.map((exp, idx) => (
                  <div
                    key={exp.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.3fr 1fr 0.9fr 0.55fr auto",
                      gap: "10px",
                      alignItems: "center",
                      padding: "12px",
                      borderRadius: "14px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <input
                      id={`fixed-exp-title-${idx}`}
                      className="epocket-input"
                      placeholder="ชื่อรายจ่ายคงที่"
                      value={exp.title}
                      onChange={(e) =>
                        updateFixedExpenseRow(exp.key, "title", e.target.value)
                      }
                    />
                    <select
                      id={`fixed-exp-cat-${idx}`}
                      className="epocket-select"
                      value={exp.category}
                      onChange={(e) =>
                        updateFixedExpenseRow(
                          exp.key,
                          "category",
                          e.target.value as CategoryCode,
                        )
                      }
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat.code} value={cat.code}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <input
                      id={`fixed-exp-amount-${idx}`}
                      type="number"
                      min="0"
                      step="any"
                      className="epocket-input"
                      placeholder="จำนวนเงิน (บาท)"
                      value={exp.amountBaht}
                      onChange={(e) =>
                        updateFixedExpenseRow(
                          exp.key,
                          "amountBaht",
                          e.target.value,
                        )
                      }
                    />
                    <input
                      id={`fixed-exp-dueday-${idx}`}
                      type="number"
                      min="1"
                      max="31"
                      className="epocket-input"
                      placeholder="วันที่จ่าย"
                      title="วันที่ครบกำหนดชำระของแต่ละเดือน (1-31)"
                      value={exp.dueDay}
                      onChange={(e) =>
                        updateFixedExpenseRow(exp.key, "dueDay", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeFixedExpenseRow(exp.key)}
                      className="btn-ghost"
                      aria-label="ลบรายการรายจ่ายคงที่"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Alert Threshold Setting */}
            <div
              style={{
                marginTop: "18px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: "13.5px", fontWeight: 600 }}>
                  เกณฑ์แจ้งเตือนผ่าน Monolith Hub Notification
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  แจ้งเตือนเมื่อเงินคงเหลือประจำเดือนต่ำกว่าสัดส่วนที่กำหนด
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  id="onboarding-warning-threshold"
                  type="range"
                  min={10}
                  max={50}
                  step={5}
                  value={warningThresholdPct}
                  onChange={(e) => setWarningThresholdPct(Number(e.target.value))}
                />
                <span
                  style={{
                    minWidth: "48px",
                    fontWeight: 700,
                    color: "var(--accent-mint)",
                  }}
                >
                  {warningThresholdPct}%
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Live Monthly Remaining Preview */}
        <aside
          className="liquid-glass panel-card"
          style={{ position: "sticky", top: "24px", borderRadius: "24px" }}
        >
          <div style={{ marginBottom: "16px" }}>
            <span className="monolith-tag">ผลคำนวณรายเดือนอัตโนมัติ</span>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                marginTop: "8px",
              }}
            >
              แต่ละเดือนคุณจะมีเงินเหลือเท่าไหร่?
            </h2>
            <p style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
              รอบเดือนปัจจุบัน: {formatThaiMonthLabel(currentYm)}
            </p>
          </div>

          {errorMsg && <div className="alert-banner-error">{errorMsg}</div>}

          {/* Big Highlight Box */}
          <div
            style={{
              padding: "20px",
              borderRadius: "18px",
              background:
                preview.monthlyRemaining >= 0
                  ? "linear-gradient(135deg, rgba(110, 231, 183, 0.14), rgba(164, 228, 216, 0.05))"
                  : "linear-gradient(135deg, rgba(253, 164, 175, 0.16), rgba(251, 146, 60, 0.06))",
              border:
                preview.monthlyRemaining >= 0
                  ? "1px solid rgba(110, 231, 183, 0.35)"
                  : "1px solid rgba(253, 164, 175, 0.4)",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                fontSize: "12.5px",
                color: "var(--text-secondary)",
                marginBottom: "4px",
              }}
            >
              เงินคงเหลือต่อเดือน (หลังหักรายจ่ายคงที่)
            </div>
            <div
              id="onboarding-preview-remaining"
              style={{
                fontSize: "34px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color:
                  preview.monthlyRemaining >= 0
                    ? "var(--status-healthy)"
                    : "var(--status-critical)",
              }}
            >
              {formatBaht(preview.monthlyRemaining)}
            </div>
            <div
              style={{
                marginTop: "10px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12.5px",
                color: "#d8e4e5",
              }}
            >
              {preview.monthlyRemaining >= 0 ? (
                <>
                  <CheckCircle2 size={15} color="var(--status-healthy)" />
                  <span>
                    เฉลี่ยใช้จ่ายได้วันละ{" "}
                    <strong>{formatBaht(preview.dailyAllowance)}</strong> (อีก{" "}
                    {remainingDays} วันในเดือนนี้)
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} color="var(--status-critical)" />
                  <span>รายจ่ายคงที่สูงกว่ารายรับคงที่ โปรดตรวจสอบรายการอีกครั้ง</span>
                </>
              )}
            </div>
          </div>

          {/* Breakdown Summary */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "20px",
              fontSize: "13.5px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                รวมเงินเดือนและรายรับคงที่
              </span>
              <strong style={{ color: "var(--status-healthy)" }}>
                +{formatBaht(preview.totalFixedIncome)}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                หักรายจ่ายคงที่รายเดือน ({fixedExpenses.length} รายการ)
              </span>
              <strong style={{ color: "var(--status-critical)" }}>
                -{formatBaht(preview.totalFixedExpense)}
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
                <span>สัดส่วนภาระรายจ่ายคงที่</span>
                <span>{preview.fixedExpensePct}% ของรายรับคงที่</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, preview.fixedExpensePct)}%`,
                    background:
                      preview.fixedExpensePct > 80
                        ? "var(--status-critical)"
                        : preview.fixedExpensePct > 60
                          ? "var(--status-warning)"
                          : "var(--accent-mint)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: "12px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: "12px",
                color: "var(--text-secondary)",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              <Calendar
                size={15}
                style={{ flexShrink: 0, marginTop: "2px" }}
                color="var(--accent-mint)"
              />
              <span>
                เมื่อขึ้นเดือนถัดไป ระบบจะคำนวณฐานเงินเดือนและรายจ่ายคงที่ชุดนี้ให้อัตโนมัติ
                พร้อม<strong>ทบยอดเงินคงเหลือสุทธิ (Rollover)</strong> ต่อเนื่องกันทุกเดือน ({totalDays}{" "}
                วันในเดือนนี้)
              </span>
            </div>
          </div>

          <button
            id="onboarding-submit-btn"
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ width: "100%", minHeight: "46px", fontSize: "14.5px" }}
          >
            <span>
              {submitting
                ? "กำลังสร้างสมุดบัญชีรายเดือน..."
                : "บันทึกและเข้าสู่แดชบอร์ด E-Pocket"}
            </span>
            <ArrowRight size={17} />
          </button>
        </aside>
      </form>
    </div>
  );
}
