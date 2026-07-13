# 水産物貿易 AI Agent — 本番用イメージ（SQLite同梱、デモモードで完結）
FROM node:22-slim

WORKDIR /app

# 依存関係（ビルドに devDependencies も必要）
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma Client 生成 → Next.js 本番ビルド
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV DEMO_MODE=true
ENV DATABASE_URL=file:./prisma/dev.db

EXPOSE 3000

# 起動時: マイグレーション適用 → 空DBならデモデータ投入 → サーバー起動
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/init-db.ts && npx next start -p ${PORT:-3000}"]
