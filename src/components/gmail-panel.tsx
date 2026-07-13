"use client";

// Gmail連携パネル（右側スライドオーバー）
// - 受信トレイ: メール一覧 → 添付PDFを案件へ取り込み
// - メール作成: 草案の編集・AI修正・Gmail送信

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importGmailAttachmentAction,
  refineDraftAction,
  sendDraftViaGmailAction,
  updateDraftAction,
} from "@/lib/actions";

interface DraftLite {
  id: string;
  subject: string;
  body: string;
  status: string;
}

interface MessageSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

interface MessageDetail extends MessageSummary {
  bodyText: string;
  attachments: { attachmentId: string; filename: string; mimeType: string; size: number }[];
}

type Status = { configured: boolean; connected: boolean; email: string | null };

export function GmailPanel({
  shipmentId,
  drafts,
}: {
  shipmentId: string;
  drafts: DraftLite[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"inbox" | "compose">("inbox");
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!open || status) return;
    fetch("/api/google/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false, email: null }));
  }, [open, status]);

  // 承認待ち/下書きの草案があれば作成タブを初期表示
  useEffect(() => {
    if (open && drafts.some((d) => d.status === "DRAFT")) setTab("compose");
  }, [open, drafts]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
      >
        ✉ Gmail
      </button>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-label="Gmailパネル">
          {/* 背景 */}
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          {/* パネル本体 */}
          <div className="absolute right-0 top-0 flex h-full w-[420px] max-w-full flex-col bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <span className="font-bold">✉ Gmail連携</span>
              {status?.connected && (
                <span className="truncate text-xs text-slate-500">{status.email}</span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="ml-auto text-slate-400 hover:text-slate-700"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            {!status ? (
              <p className="p-6 text-sm text-slate-500">読み込み中…</p>
            ) : (
              <>
                <div className="flex border-b border-slate-200 text-sm">
                  {(
                    [
                      ["inbox", "受信トレイ"],
                      ["compose", "メール作成"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`flex-1 py-2.5 font-medium ${
                        tab === key
                          ? "border-b-2 border-blue-600 text-blue-700"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {tab === "inbox" ? (
                    !status.configured ? (
                      <SetupGuide />
                    ) : !status.connected ? (
                      <ConnectPrompt shipmentId={shipmentId} />
                    ) : (
                      <InboxTab shipmentId={shipmentId} />
                    )
                  ) : (
                    <ComposeTab
                      drafts={drafts}
                      canSend={status.configured && status.connected}
                      shipmentId={shipmentId}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ConnectPrompt({ shipmentId }: { shipmentId: string }) {
  return (
    <div className="p-6 text-center">
      <p className="mb-4 text-sm text-slate-600">
        Googleアカウントでログインすると、受信メールからの書類取り込みと、草案のGmail送信ができます。
      </p>
      <a
        href={`/api/google/auth?returnTo=/shipments/${shipmentId}`}
        className="inline-block rounded bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
      >
        Googleでログイン
      </a>
    </div>
  );
}

function SetupGuide() {
  return (
    <div className="space-y-3 p-6 text-sm leading-relaxed text-slate-600">
      <p className="font-semibold text-slate-800">Gmail連携が未設定です</p>
      <p>
        Google Cloud で OAuth クライアントを作成し、
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env</code>
        に以下を設定してください（手順は docs/Gmail連携設定.md）:
      </p>
      <pre className="rounded bg-slate-900 p-3 text-xs text-slate-100">
{`GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback`}
      </pre>
      <p>設定後にサーバーを再起動すると、ここにログインボタンが表示されます。</p>
    </div>
  );
}

// ---------- 受信トレイ ----------

function InboxTab({ shipmentId }: { shipmentId: string }) {
  const [query, setQuery] = useState("has:attachment");
  const [messages, setMessages] = useState<MessageSummary[] | null>(null);
  const [selected, setSelected] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, startImport] = useTransition();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(
    (q: string) => {
      setMessages(null);
      setError(null);
      fetch(`/api/google/messages?q=${encodeURIComponent(q)}`)
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          setMessages(j.messages);
        })
        .catch((e) => setError(e.message));
    },
    []
  );

  useEffect(() => load("has:attachment"), [load]);

  if (selected) {
    return (
      <div className="space-y-3 p-4 text-sm">
        <button className="text-xs text-blue-700 hover:underline" onClick={() => setSelected(null)}>
          ← 一覧へ戻る
        </button>
        <div>
          <p className="font-bold">{selected.subject || "(件名なし)"}</p>
          <p className="text-xs text-slate-500">
            {selected.from} / {selected.date}
          </p>
        </div>
        {selected.attachments.length > 0 && (
          <div className="rounded border border-slate-200 p-2">
            <p className="mb-1 text-xs font-semibold text-slate-600">添付ファイル</p>
            <ul className="space-y-1.5">
              {selected.attachments.map((a) => (
                <li key={a.attachmentId} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate" title={a.filename}>
                    📎 {a.filename}
                  </span>
                  <span className="text-slate-400">{(a.size / 1024).toFixed(0)} KB</span>
                  {a.filename.toLowerCase().endsWith(".pdf") && (
                    <button
                      disabled={importing}
                      onClick={() =>
                        startImport(async () => {
                          setImportMsg(null);
                          const r = await importGmailAttachmentAction(
                            shipmentId,
                            selected.id,
                            a.attachmentId,
                            a.filename
                          );
                          setImportMsg(r.message);
                          if (r.ok) router.refresh();
                        })
                      }
                      className="rounded bg-blue-700 px-2 py-1 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      {importing ? "取込中…" : "案件へ取り込む"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {importMsg && <p className="mt-2 text-xs text-emerald-700">{importMsg}</p>}
          </div>
        )}
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">
          {selected.bodyText || selected.snippet}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-4">
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs"
          placeholder="Gmail検索（例: from:abc has:attachment）"
        />
        <button className="rounded bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-700">
          検索
        </button>
      </form>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {!messages && !error && <p className="text-xs text-slate-400">読み込み中…</p>}
      <ul className="divide-y divide-slate-100">
        {messages?.map((m) => (
          <li key={m.id}>
            <button
              className="w-full py-2.5 text-left hover:bg-blue-50/50"
              onClick={() => {
                fetch(`/api/google/messages/${m.id}`)
                  .then(async (r) => {
                    const j = await r.json();
                    if (!r.ok) throw new Error(j.error);
                    setSelected(j);
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              <p className="truncate text-xs font-semibold">{m.subject || "(件名なし)"}</p>
              <p className="truncate text-[11px] text-slate-500">{m.from}</p>
              <p className="truncate text-[11px] text-slate-400">{m.snippet}</p>
            </button>
          </li>
        ))}
        {messages?.length === 0 && (
          <li className="py-4 text-center text-xs text-slate-400">該当するメールがありません</li>
        )}
      </ul>
    </div>
  );
}

// ---------- メール作成（草案の編集・AI修正・送信） ----------

function ComposeTab({
  drafts,
  canSend,
  shipmentId,
}: {
  drafts: DraftLite[];
  canSend: boolean;
  shipmentId: string;
}) {
  const editable = drafts.filter((d) => d.status !== "SENT");
  const [draftId, setDraftId] = useState(editable[0]?.id ?? "");
  const current = drafts.find((d) => d.id === draftId);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [instruction, setInstruction] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const d = drafts.find((x) => x.id === draftId);
    if (d) {
      setSubject(d.subject);
      setBody(d.body);
    }
  }, [draftId, drafts]);

  if (editable.length === 0) {
    return (
      <p className="p-6 text-sm text-slate-500">
        編集できる草案がありません。詳細画面の「輸出者向け確認メール草案を作成」で草案を作ってください。
      </p>
    );
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      {editable.length > 1 && (
        <select
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        >
          {editable.map((d) => (
            <option key={d.id} value={d.id}>
              {d.subject}
            </option>
          ))}
        </select>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">宛先</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="supplier@example.com"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">件名</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">本文</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs leading-relaxed"
        />
      </div>

      {/* AI修正ダイアログ */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="mb-1.5 text-xs font-semibold text-blue-800">🤖 AIに修正を依頼</p>
        <div className="flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="例: もっと丁寧な英語に / 日本語に翻訳 / 簡潔に"
            className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !pending && instruction.trim()) {
                e.preventDefault();
                (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click();
              }
            }}
          />
          <button
            disabled={pending || !instruction.trim()}
            onClick={() =>
              startTransition(async () => {
                setMsg(null);
                // 手動編集を先に保存してからAIへ
                await updateDraftAction(draftId, subject, body);
                const r = await refineDraftAction(draftId, instruction.trim());
                setMsgOk(r.ok);
                setMsg(r.message);
                if (r.ok && r.subject && r.body) {
                  setSubject(r.subject);
                  setBody(r.body);
                  setInstruction("");
                }
              })
            }
            className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {pending ? "修正中…" : "修正"}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateDraftAction(draftId, subject, body);
              setMsgOk(true);
              setMsg("草案を保存しました。");
              router.refresh();
            })
          }
          className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          保存
        </button>
        {canSend ? (
          <button
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`このメールを ${to || "(宛先未入力)"} へ送信しますか？`)) return;
              startTransition(async () => {
                const r = await sendDraftViaGmailAction(draftId, to, subject, body);
                setMsgOk(r.ok);
                setMsg(r.message);
                if (r.ok) router.refresh();
              });
            }}
            className="ml-auto rounded bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {pending ? "処理中…" : "Gmailで送信"}
          </button>
        ) : (
          <a
            href={`/api/google/auth?returnTo=/shipments/${shipmentId}`}
            className="ml-auto rounded border border-slate-300 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50"
            title="送信にはGmail接続が必要です"
          >
            送信にはGoogleログインが必要
          </a>
        )}
      </div>
      {msg && <p className={`text-xs ${msgOk ? "text-emerald-700" : "text-red-700"}`}>{msg}</p>}
      <p className="text-[11px] leading-relaxed text-slate-400">
        送信はこのボタンを押したときのみ実行されます（AIが自動送信することはありません）。送信履歴は監査ログに記録されます。
      </p>
    </div>
  );
}
