"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createShipmentAction, type NewShipmentInput } from "@/lib/actions";

const input =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const label = "mb-1 block text-xs font-semibold text-slate-600";

// 新規案件の作成フォーム
export default function NewShipmentPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NewShipmentInput>({
    id: "",
    exportCountry: "",
    importCountry: "Japan",
    product: "",
    scientificName: "",
    quantity: "",
    expectedNetWeight: "",
    etd: "",
    eta: "",
    urgency: "NORMAL",
  });

  function set<K extends keyof NewShipmentInput>(key: K, value: NewShipmentInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createShipmentAction(form);
      if (r.ok) {
        router.push(`/shipments/${r.message}`);
      } else {
        setError(r.message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">新規案件の作成</h1>
        <Link href="/dashboard" className="ml-auto text-sm text-blue-700 hover:underline">
          ← ダッシュボードへ戻る
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>案件ID *</label>
            <input
              className={input}
              placeholder="例: VN-JP-003"
              value={form.id}
              onChange={(e) => set("id", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>輸出国 *</label>
            <input
              className={input}
              placeholder="例: Vietnam"
              value={form.exportCountry}
              onChange={(e) => set("exportCountry", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>輸入国 *</label>
            <input
              className={input}
              value={form.importCountry}
              onChange={(e) => set("importCountry", e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>商品名 *</label>
            <input
              className={input}
              placeholder="例: Frozen Vannamei Shrimp"
              value={form.product}
              onChange={(e) => set("product", e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>学名（任意）</label>
            <input
              className={input}
              placeholder="例: Litopenaeus vannamei"
              value={form.scientificName}
              onChange={(e) => set("scientificName", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>数量（任意）</label>
            <input
              className={input}
              placeholder="例: 500 cartons"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>予定Net Weight（任意）</label>
            <input
              className={input}
              placeholder="例: 10,000 kg"
              value={form.expectedNetWeight}
              onChange={(e) => set("expectedNetWeight", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>ETD（任意）</label>
            <input
              type="date"
              className={input}
              value={form.etd}
              onChange={(e) => set("etd", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>ETA（任意）</label>
            <input
              type="date"
              className={input}
              value={form.eta}
              onChange={(e) => set("eta", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>緊急度</label>
            <select
              className={input}
              value={form.urgency}
              onChange={(e) => set("urgency", e.target.value)}
            >
              <option value="HIGH">緊急</option>
              <option value="NORMAL">通常</option>
              <option value="LOW">低</option>
            </select>
          </div>
        </div>

        <p className="rounded bg-blue-50 p-3 text-xs leading-relaxed text-slate-600">
          必要書類チェックリストには水産物輸入の標準セット（Commercial Invoice / Packing List /
          B/L / Health Certificate / Certificate of Origin）が適用されます。
          ルート・品目別のルールライブラリは今後の拡張で対応予定です。
        </p>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {pending ? "作成中…" : "案件を作成"}
          </button>
          <Link
            href="/dashboard"
            className="rounded border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
