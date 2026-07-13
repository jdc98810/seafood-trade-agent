// 起動時初期化: DBが空ならデモ案件とサンプル書類を投入する（本番デモ用）。
// 既にデータがあれば何もしない（再起動でユーザーデータを消さない）。

import { execSync } from "child_process";
import { prisma } from "../src/lib/db";

async function main() {
  const count = await prisma.shipment.count();
  await prisma.$disconnect();
  if (count > 0) {
    console.log(`DB初期化スキップ（既存Shipment: ${count}件）`);
    return;
  }
  console.log("空のDBを検出。デモデータを投入します…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  execSync("npx tsx scripts/generate-samples.ts", { stdio: "inherit" });
  execSync("npx tsx scripts/populate-demo.ts", { stdio: "inherit" });
  console.log("デモデータ投入完了。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
