# 水産物貿易 書類確認・申請準備支援 AI Agent

水産物国際貿易の書類（Invoice / Packing List / B/L / Health Certificate 等）をAIが受け取り、
**情報抽出 → 正規化 → 不足・不一致検出 → 修正依頼草案 → 提出資料準備 → 人間承認 → 進捗管理 → 保存**
までを支援する Human-in-the-loop 型ワークフローWebアプリ（MVP）。

仕様書: `../水産物貿易_AI_Agent_プロジェクト仕様書_日本語.md`

## セットアップ

```bash
npm install
npx prisma migrate dev   # SQLite DB作成
npm run db:seed          # デモ案件 VN-JP-001 等を投入
npm run samples          # sample-documents/ にサンプルPDF生成（生成済み）
npm run dev              # http://localhost:3000
```

APIキーは不要です（デフォルトで `DEMO_MODE=true`）。

## デモ手順（5分）

1. **Dashboard** で `VN-JP-001`（Vietnam → Japan / 冷凍エビ）を開く
2. 左カラムから `sample-documents/` の4つのPDFをまとめてアップロード
   - 自動で分類・抽出・正規化・検証が走る
3. 右カラムの **Agentの指摘** を確認:
   - ⚠ Net Weight 不一致（Invoice 10,000 kg vs Packing List 9,800 kg）
   - ⚠ Certificate of Origin 不足
   - ⚠ Health Certificate に Seal No. 記載なし
4. **書類間比較** 画面で不一致をハイライト表示
5. **輸出者向け確認メール草案を作成** → 内容確認 → **承認**（状態が「輸出者回答待ち」へ）
6. 修正版 `Packing_List_VN-JP-001_revised.pdf` をアップロード
   → v2として版管理され、重量不一致が自動で「解消」になる
7. 残りの問題を **差異を受容** または **エスカレーション**
8. **検疫提出準備へ進める** → パッケージ（JSON/CSV）出力 → 承認 → 税関 → 輸入許可 → 納品 → 保存
9. **進捗・監査ログ** 画面で全操作の履歴（Audit Log）を確認

## 実LLMを使う場合

`.env` を編集（OpenAI互換ならどのプロバイダでも可）:

```
DEMO_MODE=false
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=deepseek-chat
```

PDFは `unpdf` でテキスト化してからLLMに渡すため、vision非対応の安価なモデルで動作します。
出力はZodで検証し、失敗時は1回再試行。それでも失敗した場合は「抽出失敗」として人間確認に回します（値の推測はしません）。

## アーキテクチャ

```
Next.js (App Router) UI — 日本語
  ↓ Server Actions
Workflow Orchestrator (src/lib/workflow/pipeline.ts)
  ├── Intake        書類分類・Draft/Final判定・版管理     (決定論的 + LLM)
  ├── Extraction    項目抽出 + 根拠(evidence/page/信頼度)  (LLM / fixtures)
  ├── Normalization 単位・日付・国名・コード統一            (決定論的)
  ├── Validation    一致性・完全性・妥当性チェック          (決定論的のみ)
  ├── Action        修正依頼メール草案                     (テンプレート + LLM)
  └── Package       検疫・税関向け提出準備パッケージ        (決定論的)
  ↓
Prisma + SQLite（全状態遷移を WorkflowEvent として監査ログ化）
```

- 状態遷移は `src/lib/workflow/state-machine.ts` の白名单でのみ許可
- 値が無い場合は「不一致」ではなく「根拠不足 (INSUFFICIENT_EVIDENCE)」
- 外部メール送信・行政システム接続・HS Code最終決定は行わない（人間の責務）

## テスト

```bash
npm test   # vitest: validation規則 / 状態機 / 正規化（26件）
```
