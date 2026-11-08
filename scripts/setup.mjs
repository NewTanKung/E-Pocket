import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export function fillEnvironment(file, defaults) {
  const original = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const existing = parseEnv(original);
  const missing = Object.entries(defaults).filter(
    ([key]) => !(key in existing),
  );
  if (missing.length) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.appendFileSync(
      file,
      (original && !original.endsWith("\n") ? "\n" : "") +
        missing
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join("\n") +
        "\n",
    );
  }
  return { ...defaults, ...existing };
}

const database = fillEnvironment(".env", {
  DATABASE_URL:
    "postgresql://epocket:epocket_local_dev@127.0.0.1:55433/epocket",
});

fillEnvironment(".env.local", {
  DATABASE_URL: database.DATABASE_URL,
  APP_ENV: "development",
  HUB_URL: "http://localhost:3000",
  SERVICE_URL: "http://localhost:3001",
  MONOLITH_SERVICE_ID: "e-pocket",
  MONOLITH_SERVICE_TOKEN: "epocket_dev_service_token",
  ALLOW_DEV_MOCK_AUTH: "true",
});

console.log(
  "เติมค่า .env และ .env.local ที่ขาดเรียบร้อยแล้ว เริ่มฐานข้อมูลด้วย docker compose up -d --wait",
);
