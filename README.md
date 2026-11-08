# E-Pocket — ระบบจัดการการเงินส่วนบุคคลภายใต้ Monolith Hub

**E-Pocket** คือบริการจัดการการเงินส่วนบุคคล (Personal Finance & Monthly Cashflow Manager) ที่ออกแบบมาเพื่อทำงานภายใต้ระบบบัญชีเดียว (**Monolith Account / SSO**) บนโดเมนเดียวกันกับ [`NewTanKung/Monolith`](https://github.com/NewTanKung/Monolith)

## ฟีเจอร์หลัก

1. **บังคับใช้บัญชี Monolith (Monolith SSO Integration)**
   - ตรวจสอบสิทธิ์ฝั่ง Server ทุกหน้าและทุก API ด้วย `@monolith/auth-client/server` (`getServiceSession`, `createHubLoginUrl`, `HubAuthError`)
   - ใช้คุกกี้ `monolith_session` ร่วมกันภายใต้ `SESSION_COOKIE_DOMAIN` เดียวกันกับ Monolith Hub
   - ปฏิเสธการเข้าถึงแบบ Guest (`user: null`) และส่งต่อไปยังหน้าล็อกอินของ Monolith Hub อัตโนมัติ

2. **การตั้งค่าเริ่มต้นครั้งแรก (First-Time Onboarding)**
   - ป้อน **เงินเดือนคงที่** (และรายรับคงที่เสริมรายเดือนหากมี)
   - ป้อน **รายจ่ายคงที่รายเดือน** แยกตามหมวดหมู่ (เช่น ค่าที่พัก, ค่าน้ำ/ไฟ/อินเทอร์เน็ต, ผ่อนชำระ, ค่าเดินทาง, บริการรายเดือน, เงินออมประจำ)
   - คำนวณและแสดงผลทันทีว่า **แต่ละเดือนมีเงินเหลือใช้จ่ายเท่าไหร่** และเฉลี่ยใช้วันละเท่าไหร่

3. **ระบบทบยอดเงินคงเหลือข้ามเดือนอัตโนมัติ (Continuous Rollover Balance)**
   - เมื่อขึ้นเดือนใหม่ ระบบสร้างสมุดบัญชีรายเดือน (`MonthlySheet`) จากฐานเงินเดือนและรายจ่ายคงที่ให้อัตโนมัติ
   - นำยอดเงินคงเหลือสุทธิจากเดือนก่อนหน้าทบเข้าสู่เดือนถัดไป (`Carry-Over Balance`) ต่อเนื่องกัน

4. **บันทึกการใช้จ่ายและรายรับเพิ่มเติมระหว่างเดือน**
   - เพิ่ม แก้ไข และลบรายการ **รายจ่ายเพิ่มเติม** หรือ **รายรับเพิ่มเติม** ได้ตลอดเวลา
   - ค้นหาและกรองรายการตามประเภทหรือคำค้นหา

5. **หน้าแดชบอร์ดบอกสถานะสุขภาพการเงิน & แจ้งเตือนเข้า Monolith Hub**
   - **4 การ์ดสรุปยอดหลัก**: ยอดเงินคงเหลือสุทธิ (รวมยอดทบ), เงินเหลือเฉพาะเดือนนี้, รายรับรวมเดือนนี้ และรายจ่ายรวมเดือนนี้
   - **สถานะสุขภาพการเงิน (Financial Status Badge)**: `ปกติ (HEALTHY)`, `ใกล้ถึงเกณฑ์เฝ้าระวัง (WARNING)`, `ใช้เกินรายรับเดือนนี้ (OVERSPENT_MONTH)` และ `ยอดเงินสะสมติดลบ (CRITICAL)` พร้อมแถบ Progress Bar และงบใช้จ่ายได้เฉลี่ยต่อวัน (**Daily Safe-to-Spend**)
   - **กราฟวิเคราะห์**: สัดส่วนรายจ่ายแยกตามหมวดหมู่ (Category Breakdown) และกราฟเปรียบเทียบแนวโน้มรายเดือน (Monthly Cashflow & Rollover Trend)
   - **Monolith Hub Notifications**: ส่งแจ้งเตือนอัตโนมัติไปยัง `POST /api/notifications` ของ Monolith Hub เมื่อเงินคงเหลือต่ำกว่าเกณฑ์หรือใช้จ่ายเกินงบ

---

## การเริ่มต้นใช้งาน (Local Development)

```sh
npm install
npm run setup
docker compose up -d --wait
npm run db:migrate
npm run dev
```

- **E-Pocket**: `http://localhost:3001`
- **Monolith Hub**: `http://localhost:3000`

### การตั้งค่าเชื่อมต่อกับ Monolith Hub (`Admin -> บริการ`)

1. เข้าสู่หน้า `/admin` บน **Monolith Hub** แล้วสร้างบริการใหม่:
   - **โหมด**: `SSO`
   - **URL**: `http://localhost:3001` (หรือ `https://epocket.example.com` ใน Production)
   - **สิทธิ์ขั้นต่ำ**: `MEMBER`
2. สร้าง **Service Token** โดยเปิดสิทธิ์ `session:read` และ `notifications:write`
3. นำค่าที่ได้มาใส่ใน `.env.local` (หรือ Worker Secrets ใน Production):

| ตัวแปรสภาพแวดล้อม | คำอธิบาย |
| --- | --- |
| `DATABASE_URL` | Connection string ของ PostgreSQL สำหรับ E-Pocket |
| `HUB_URL` | URL ของ Monolith Hub เช่น `http://localhost:3000` หรือ `https://hub.example.com` |
| `SERVICE_URL` | URL ของ E-Pocket เช่น `http://localhost:3001` หรือ `https://epocket.example.com` |
| `MONOLITH_SERVICE_ID` | รหัสหรือ Slug ของบริการที่ตั้งไว้ใน Monolith Hub |
| `MONOLITH_SERVICE_TOKEN` | Service Token ที่สร้างจากหน้า Admin ของ Monolith Hub |
| `APP_ENV` | `development` หรือ `production` |

---

## คำสั่งตรวจสอบและสร้างระบบ

| คำสั่ง | หน้าที่ |
| --- | --- |
| `npm run setup` | เติมค่า `.env` และ `.env.local` สำหรับการพัฒนาในเครื่อง |
| `npm run dev` | เปิดเซิร์ฟเวอร์พัฒนาที่พอร์ต `3001` |
| `npm run db:migrate` | รัน Prisma migration บนฐานข้อมูล PostgreSQL |
| `npm test` | รันชุดทดสอบการคำนวณการเงิน, การทบยอด, การเชื่อมฐานข้อมูล และ Monolith SSO |
| `npm run check` | ตรวจสอบ ESLint, TypeScript, Tests และสร้าง Production Build |
| `npm run cf:build` | สร้างชุดไฟล์สำหรับ Cloudflare Workers ผ่าน OpenNext |
| `npm run cf:check` | ทดสอบ Wrangler dry-run สำหรับ Cloudflare Workers |
