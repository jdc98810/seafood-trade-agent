import Link from "next/link";

// 製品ホームページ（ランディング）: 製品紹介 + 実務担当者向け/管理者向けガイド

function SectionTitle({ en, ja }: { en: string; ja: string }) {
  return (
    <div className="mb-10">
      <h2 className="text-3xl font-bold tracking-tight text-slate-900">{ja}</h2>
      <p className="mt-1 text-sm font-semibold text-blue-600">{en}</p>
    </div>
  );
}

const FEATURE_CHIPS = [
  "書類間の不一致をAIで検出する",
  "不足書類を提出前に把握する",
  "抽出値に原文の根拠を保持する",
  "輸出者向け修正依頼メールを草案化する",
  "検疫・税関向け提出資料を準備する",
  "すべての操作を監査ログに残す",
];

const GUIDE_STEPS = [
  {
    step: "STEP 1",
    title: "ダッシュボードで案件を確認する",
    body: "すべての輸入案件を緊急度・進捗状態・問題件数つきで一覧できます。⚠マークの付いた案件から優先して開いてください。",
    img: "/guide/dashboard.png",
    alt: "Shipment Dashboard",
  },
  {
    step: "STEP 2",
    title: "書類をアップロードすると、AIが抽出・検証する",
    body: "Invoice・Packing List・B/L・Health Certificate等のPDFをまとめてアップロード。AIが種別を判定し、項目を抽出し、書類間の不一致（例: 重量 10,000 kg と 9,800 kg）や不足書類を自動で指摘します。各値には参照元書類・ページ・原文・信頼度が付きます。",
    img: "/guide/detail.png",
    alt: "Shipment詳細画面",
  },
  {
    step: "STEP 3",
    title: "書類間比較で違いをひと目で確認する",
    body: "全項目を書類横断で並べ、正規化後の完全一致判定で「一致 / 警告 / 単一記載」を表示。日付や単位の表記ゆれは自動で吸収されます。",
    img: "/guide/compare.png",
    alt: "書類間比較画面",
  },
  {
    step: "STEP 4",
    title: "承認・修正・エスカレーションは、あなたが決める",
    body: "AIが作った英文の修正依頼メール草案を確認して承認（送信はメールソフトから手動で）。修正版書類が届けば自動で再検証され、問題は「解消」になります。すべての操作と状態変化はAudit Logに記録されます。",
    img: "/guide/progress.png",
    alt: "進捗・監査ログ画面",
  },
];

export default function HomePage() {
  return (
    <div className="bg-white text-slate-900">
      {/* ナビゲーション */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-5">
          <span className="text-lg font-bold text-white">🐟 SeaTrade AI</span>
          <nav className="ml-auto flex items-center gap-6 text-sm text-slate-200">
            <a href="#about" className="hover:text-white">
              製品紹介
            </a>
            <a href="#guide" className="hover:text-white">
              ご利用ガイド
            </a>
            <a href="#admin" className="hover:text-white">
              管理者向け
            </a>
            <Link
              href="/dashboard"
              className="rounded-full bg-blue-500 px-4 py-1.5 font-semibold text-white transition-colors hover:bg-blue-400"
            >
              アプリを開く
            </Link>
          </nav>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#050f24] via-[#0b2a5b] to-[#123f8f]">
        {/* 装飾: 海流をイメージした曲線 */}
        <svg
          className="pointer-events-none absolute -right-24 -top-32 h-[42rem] w-[42rem] opacity-40"
          viewBox="0 0 600 600"
          fill="none"
          aria-hidden
        >
          <path
            d="M-40 480 C 160 420, 240 160, 470 120 S 760 220, 700 40"
            stroke="url(#g1)"
            strokeWidth="120"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-36">
          <p className="text-sm font-semibold tracking-wide text-blue-300">
            水産物国際貿易のためのAIワークフローAgent
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl">
            書類確認から申請準備まで、
            <br />
            AIが案件を前へ進める
          </h1>
          <p className="mt-6 max-w-2xl leading-relaxed text-slate-300">
            一つのShipmentに、Invoice・Packing List・B/L・Health Certificate…。
            複数の書類に散らばった情報をAIが整理し、不一致と不足を提出前に検出。
            担当者は、根拠つきで提示された内容の承認・修正・エスカレーションに集中できます。
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-blue-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 transition-colors hover:bg-blue-400"
            >
              アプリを開く →
            </Link>
            <a
              href="#guide"
              className="rounded-full border border-slate-500 px-7 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-white hover:text-white"
            >
              ご利用ガイドを見る
            </a>
          </div>
        </div>

        {/* 機能チップ */}
        <div className="relative border-t border-white/10 bg-white/5">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 py-5">
            {FEATURE_CHIPS.map((c) => (
              <span
                key={c}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-slate-200"
              >
                <span className="mr-1.5 text-blue-400">●</span>
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 製品紹介 */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-24">
        <SectionTitle en="Our Approach" ja="OCRではなく、案件を前進させるWorkflow Agent" />
        <p className="mb-12 max-w-3xl leading-relaxed text-slate-600">
          本システムは書類を読み取って終わりではありません。
          「書類受領 → 情報抽出 → 正規化 → 不足・不一致検出 → 修正依頼 → 提出資料草案 →
          人間承認 → 進捗追跡 → 保存」まで、輸入案件のワークフロー全体を支援します。
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: "🔍",
              title: "根拠つきの書類理解",
              body: "AIが抽出したすべての値に、参照元書類・ページ番号・原文テキスト・信頼度を保持。「この値はどこから来たのか」に常に答えられます。書類に無い値を推測して埋めることはありません。",
            },
            {
              icon: "⚖️",
              title: "決定論的な検証",
              body: "重量・数量・Container No.・原産国の一致確認、不足書類チェック、金額の検算やETD/ETAの妥当性確認は、AIではなくルールベースのコードが実行。同じ入力には必ず同じ結果を返します。",
            },
            {
              icon: "🤝",
              title: "Human-in-the-loop",
              body: "メール送信・行政申請・HS Code決定は行いません。AIは草案と推奨を提示するだけ。承認・修正・エスカレーションの判断はすべて人間が行い、その履歴は監査ログに残ります。",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-2xl">
                {f.icon}
              </div>
              <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ワークフロー */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle en="Workflow" ja="10の工程を、ひとつの流れに" />
          <div className="flex flex-wrap items-center gap-y-3">
            {[
              "書類受領",
              "情報抽出",
              "データ正規化",
              "不足・不一致確認",
              "輸出者修正対応",
              "検疫提出準備",
              "税関申告準備",
              "輸入許可",
              "納品",
              "保存",
            ].map((s, i, arr) => (
              <span key={s} className="flex items-center">
                <span className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                  <span className="mr-1.5 text-xs font-bold text-blue-500">{i + 1}</span>
                  {s}
                </span>
                {i < arr.length - 1 && <span className="mx-1.5 text-blue-300">→</span>}
              </span>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-500">
            各工程の状態遷移はすべて記録され、進捗画面でいつでも「いまどこにいるか」を確認できます。
          </p>
        </div>
      </section>

      {/* ご利用ガイド（実務担当者向け） */}
      <section id="guide" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-24">
        <SectionTitle en="User Guide" ja="ご利用ガイド — 実務担当者向け" />
        <div className="space-y-20">
          {GUIDE_STEPS.map((g, i) => (
            <div
              key={g.step}
              className={`flex flex-col items-center gap-10 lg:flex-row ${
                i % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              <div className="lg:w-2/5">
                <p className="text-sm font-bold text-blue-600">{g.step}</p>
                <h3 className="mt-2 text-xl font-bold">{g.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{g.body}</p>
              </div>
              <div className="lg:w-3/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.img}
                  alt={g.alt}
                  className="w-full rounded-xl border border-slate-200 shadow-lg"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-16 rounded-2xl bg-blue-50 p-8 text-sm leading-relaxed text-slate-700">
          より詳しい操作手順・FAQ・用語集は、同梱の
          <span className="mx-1 rounded bg-white px-2 py-0.5 font-mono text-xs">
            docs/ユーザーガイド.md
          </span>
          をご覧ください。
        </div>
      </section>

      {/* 管理者向けガイド */}
      <section id="admin" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl scroll-mt-16 px-6">
          <SectionTitle en="Admin Guide" ja="社内担当者向けガイド — セットアップと運用" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <h3 className="mb-3 text-lg font-bold">① セットアップ</h3>
              <p className="mb-4 text-sm text-slate-600">
                Node.js 22+ が入っていれば5分で起動できます。APIキーは不要です。
              </p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`npm install
npx prisma migrate dev   # DB作成
npm run db:seed          # デモ案件投入
npm run dev              # http://localhost:3000`}
              </pre>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <h3 className="mb-3 text-lg font-bold">② デモモードと実LLMの切替</h3>
              <p className="mb-4 text-sm text-slate-600">
                デフォルトはデモモード（fixture抽出・オフライン動作）。実運用ではOpenAI互換の任意のLLMを
                <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">.env</span>
                で設定します。
              </p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`DEMO_MODE=false
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=deepseek-chat`}
              </pre>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <h3 className="mb-3 text-lg font-bold">③ 人間確認センターの運用</h3>
              <p className="mb-4 text-sm text-slate-600">
                全案件の「判断待ち」を横断表示します。高優先度（赤）から処理し、
                判断に迷うものはエスカレーションで専門担当者へ。承認権限の分離は次期バージョンで対応予定です。
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/guide/review.png"
                alt="人間確認センター"
                className="w-full rounded-lg border border-slate-200 shadow"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <h3 className="mb-3 text-lg font-bold">④ データ管理・品質保証</h3>
              <ul className="space-y-3 text-sm leading-relaxed text-slate-600">
                <li>
                  <span className="font-semibold text-slate-800">監査ログ:</span>{" "}
                  すべての状態遷移・承認・修正が WorkflowEvent として保存され、削除できません。
                </li>
                <li>
                  <span className="font-semibold text-slate-800">データリセット:</span>{" "}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                    npm run db:seed
                  </span>{" "}
                  で初期デモ状態に戻せます（全データ削除を伴うため本番では使用しないこと）。
                </li>
                <li>
                  <span className="font-semibold text-slate-800">テスト:</span>{" "}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                    npm test
                  </span>{" "}
                  で検証ルール・状態遷移・正規化の26件の単体テストを実行できます。
                </li>
                <li>
                  <span className="font-semibold text-slate-800">セキュリティ:</span>{" "}
                  APIキーはサーバー側の .env のみに置き、Gitには含めません。
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-[#050f24] py-14 text-slate-400">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-lg font-bold text-white">🐟 SeaTrade AI</p>
              <p className="mt-1 text-sm">水産物国際貿易 書類確認・申請準備支援 AI Agent</p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              アプリを開く →
            </Link>
          </div>
          <p className="mt-10 border-t border-white/10 pt-6 text-xs leading-relaxed">
            本システムは Human-in-the-loop を原則とし、外部へのメール送信・行政システムへの申請・HS
            Codeの最終決定は行いません。重要な判断はすべて担当者の承認を必要とします。
            <br />© 2026 SeaTrade AI — MVP
          </p>
        </div>
      </footer>
    </div>
  );
}
