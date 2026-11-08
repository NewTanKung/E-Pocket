import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "E-Pocket — ระบบจัดการการเงินรายเดือนภายใต้ Monolith",
  description:
    "คำนวณรายรับ-รายจ่ายคงที่รายเดือน ติดตามการใช้จ่ายเพิ่มเติม และทบยอดเงินคงเหลือต่อเนื่องภายใต้บัญชี Monolith เดียวกัน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark">
      <body>
        <div className="epocket-backdrop" aria-hidden="true">
          <div className="epocket-orbit epocket-orbit-one" />
          <div className="epocket-orbit epocket-orbit-two" />
          <div className="epocket-grain" />
        </div>
        {children}
      </body>
    </html>
  );
}
