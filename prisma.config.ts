import { defineConfig } from "prisma/config";

// Prisma 7: 接続URLはschemaではなくここで指定する
try {
  process.loadEnvFile(); // .env を読む (Node 20.12+)
} catch {
  // .env が無い場合はデフォルトを使う
}

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
