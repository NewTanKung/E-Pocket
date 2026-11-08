"use client";

import React, { useState } from "react";
import { ShieldAlert, ExternalLink, RefreshCw, UserCheck, Lock } from "lucide-react";

interface MonolithAccessGateProps {
  mode: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE";
  loginUrl?: string;
  hubUrl: string;
  message?: string;
  allowDevSimulation?: boolean;
}

export function MonolithAccessGate({
  mode,
  loginUrl,
  hubUrl,
  message,
  allowDevSimulation = false,
}: MonolithAccessGateProps) {
  const [loadingDev, setLoadingDev] = useState(false);
  const [devName, setDevName] = useState("คุณคมเดช (Monolith Account)");
  const [devEmail, setDevEmail] = useState("komdet@monolith.local");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDevSimulateLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingDev(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dev-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          name: devName,
          email: devEmail,
          role: "MEMBER",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "ไม่สามารถสร้าง Dev Session ได้");
      }
      window.location.reload();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setLoadingDev(false);
    }
  }

  return (
    <main
      id="main-content"
      style={{
        minHeight: "88dvh",
        display: "grid",
        placeItems: "center",
        padding: "28px 16px",
      }}
    >
      <div
        className="liquid-glass"
        style={{
          width: "min(100%, 490px)",
          borderRadius: "26px",
          padding: "32px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div className="brand-badge">
            {mode === "UNAUTHENTICATED" ? (
              <Lock size={20} />
            ) : (
              <ShieldAlert size={20} />
            )}
          </div>
          <div>
            <span className="monolith-tag">Monolith SSO Domain</span>
            <h1
              style={{
                fontSize: "21px",
                fontWeight: 700,
                marginTop: "4px",
              }}
            >
              {mode === "UNAUTHENTICATED"
                ? "ต้องใช้บัญชี Monolith เพื่อเข้าใช้งาน"
                : mode === "FORBIDDEN"
                  ? "ไม่มีสิทธิ์เข้าถึงบริการ E-Pocket"
                  : "ระบบยืนยันตัวตน Monolith ไม่พร้อมใช้งาน"}
            </h1>
          </div>
        </div>

        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            marginBottom: "22px",
            lineHeight: 1.65,
          }}
        >
          {message ||
            "ระบบจัดการการเงิน E-Pocket ทำงานอยู่ภายใต้ระบบบัญชีกลางของ Monolith บนโดเมนเดียวกัน กรุณาเข้าสู่ระบบด้วยบัญชีสมาชิก Monolith ก่อนเริ่มต้นวางแผนรายรับ-รายจ่าย"}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: allowDevSimulation ? "24px" : "0",
          }}
        >
          {mode === "UNAUTHENTICATED" && loginUrl && (
            <a
              id="monolith-sso-login-btn"
              href={loginUrl}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              <span>เข้าสู่ระบบผ่าน Monolith Hub</span>
              <ExternalLink size={16} />
            </a>
          )}

          {mode === "UNAVAILABLE" && (
            <button
              id="retry-hub-connection-btn"
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              <RefreshCw size={16} />
              <span>ลองเชื่อมต่อใหม่อีกครั้ง</span>
            </button>
          )}

          <a
            id="return-to-monolith-hub-btn"
            href={hubUrl}
            className="btn-secondary"
          >
            <span>กลับหน้าหลัก Monolith Hub</span>
          </a>
        </div>

        {allowDevSimulation && (
          <form
            onSubmit={handleDevSimulateLogin}
            style={{
              borderTop: "1px solid rgba(255,255,255,0.09)",
              paddingTop: "20px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "10px",
                fontSize: "12.5px",
                color: "var(--accent-mint)",
                fontWeight: 600,
              }}
            >
              <UserCheck size={15} />
              <span>โหมดจำลองบัญชี Monolith (Local Dev / Test)</span>
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "14px",
              }}
            >
              สำหรับทดสอบในสภาพแวดล้อม Local เมื่อยังไม่ได้เปิดเซิร์ฟเวอร์ Monolith Hub พอร์ต 3000:
            </p>

            {errorMsg && <div className="alert-banner-error">{errorMsg}</div>}

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              <div className="form-field">
                <label className="form-label" htmlFor="dev-sim-name">
                  ชื่อบัญชี Monolith
                </label>
                <input
                  id="dev-sim-name"
                  className="epocket-input"
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="dev-sim-email">
                  อีเมลบัญชี Monolith
                </label>
                <input
                  id="dev-sim-email"
                  type="email"
                  className="epocket-input"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              id="dev-simulate-monolith-btn"
              type="submit"
              disabled={loadingDev}
              className="btn-secondary"
              style={{
                width: "100%",
                borderColor: "rgba(164, 228, 216, 0.35)",
                color: "var(--accent-mint)",
              }}
            >
              <UserCheck size={16} />
              <span>
                {loadingDev
                  ? "กำลังเชื่อมบัญชี..."
                  : "เข้าใช้งานด้วยบัญชี Monolith จำลอง"}
              </span>
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
