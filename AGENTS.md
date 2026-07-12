<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 水産物貿易 AI Agent (Seafood Trade Documentation AI Agent)

唯一の参照元（仕様書）: `D:\桌面\2026s\水産物貿易_AI_Agent_プロジェクト仕様書_日本語.md`

## 重要制約
- PC向けWebアプリ / UI言語は日本語
- Human-in-the-loop: 外部メール送信・行政申請・HS Code最終決定はAIが自動実行しない
- すべての抽出値に根拠（evidenceText / pageNumber / confidence）を保持する
- 一致確認・算術・状態遷移は決定論的コード（`src/lib/agents/validation.ts`）。LLMは分類・抽出・説明・草案のみ
- 値が無い場合は「不一致」ではなく「根拠不足 (INSUFFICIENT_EVIDENCE)」

## 技術
- Next.js App Router + TypeScript + Tailwind / Prisma + SQLite / Zod
- LLM: OpenAI互換Provider（env: LLM_BASE_URL / LLM_API_KEY / LLM_MODEL）
- `DEMO_MODE=true`（デフォルト）: fixtures/ のデータで全フロー動作、APIキー不要

## コマンド
- `npm run dev` — 開発サーバー
- `npm run db:seed` — VN-JP-001 デモ案件投入
- `npm run samples` — sample-documents/ に4種のサンプルPDF生成
- `npx vitest run` — 単体テスト（validation / state-machine / normalization）
