// ホームページのガイド用スクリーンショットを撮る（ローカルのEdgeをheadlessで使用）。
// 前提: dev サーバーが http://localhost:3000 で起動済み、populate-demo.ts 実行済み。

import { promises as fs } from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "guide");

const SHOTS: { name: string; url: string }[] = [
  { name: "dashboard", url: "/dashboard" },
  { name: "detail", url: "/shipments/VN-JP-001" },
  { name: "compare", url: "/shipments/VN-JP-001/compare" },
  { name: "progress", url: "/shipments/VN-JP-001/progress" },
  { name: "review", url: "/review" },
];

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  for (const shot of SHOTS) {
    await page.goto(BASE + shot.url, { waitUntil: "networkidle0", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 800));
    const file = path.join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file as `${string}.png` });
    console.log(`✓ ${shot.url} → public/guide/${shot.name}.png`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
