import Link from "next/link";
import { notFound } from "next/navigation";
import { getShipmentDetail } from "@/lib/queries";
import {
  DOCUMENT_TYPE_LABELS,
  FIELD_LABELS_JA,
  FIELD_NAMES,
  type DocumentType,
  type FieldName,
} from "@/lib/domain";
import { normalizeField } from "@/lib/agents/normalization";

export const dynamic = "force-dynamic";

// 書類間比較画面（仕様書§6.3）: 決定論的な正規化値で一致/不一致を判定して表示する
export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await getShipmentDetail(id);
  if (!shipment) notFound();

  const activeDocs = shipment.documents.filter((d) => d.isActive);
  const docTypes = activeDocs.map((d) => d.documentType);

  const rows = FIELD_NAMES.map((fieldName) => {
    const values = activeDocs.map((doc) => {
      const f = doc.fields.find((x) => x.fieldName === fieldName && x.originalValue != null);
      return f
        ? {
            original: f.reviewStatus === "CORRECTED" ? (f.normalizedValue ?? f.originalValue) : f.originalValue,
            corrected: f.reviewStatus === "CORRECTED",
          }
        : null;
    });
    const present = values.filter((v) => v != null);
    if (present.length === 0) return null;

    const norms = [
      ...new Set(
        present.map((v) => normalizeField(fieldName as FieldName, v!.original) ?? v!.original ?? "")
      ),
    ];
    const verdict: "MATCH" | "MISMATCH" | "SINGLE" =
      present.length < 2 ? "SINGLE" : norms.length === 1 ? "MATCH" : "MISMATCH";
    return { fieldName, values, verdict };
  }).filter((r) => r != null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">書類間比較 — {shipment.id}</h1>
        <Link href={`/shipments/${shipment.id}`} className="ml-auto text-sm text-blue-700 hover:underline">
          ← 詳細へ戻る
        </Link>
      </div>

      {activeDocs.length === 0 ? (
        <p className="text-sm text-slate-500">書類がまだありません。詳細画面からアップロードしてください。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2">項目</th>
                {docTypes.map((t) => (
                  <th key={t} className="px-3 py-2">
                    {DOCUMENT_TYPE_LABELS[t as DocumentType] ?? t}
                  </th>
                ))}
                <th className="px-3 py-2">判定</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row!.fieldName}
                  className={`border-b border-slate-100 ${
                    row!.verdict === "MISMATCH" ? "bg-red-50" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {FIELD_LABELS_JA[row!.fieldName as FieldName] ?? row!.fieldName}
                  </td>
                  {row!.values.map((v, i) => (
                    <td key={i} className="px-3 py-2">
                      {v ? (
                        <span className={v.corrected ? "text-blue-700" : ""}>
                          {v.original}
                          {v.corrected && <span className="ml-1 text-[10px]">(修正済)</span>}
                        </span>
                      ) : (
                        <span className="text-slate-300">未記載</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-xs font-medium">
                    {row!.verdict === "MATCH" && <span className="text-emerald-700">一致</span>}
                    {row!.verdict === "MISMATCH" && <span className="text-red-700">⚠ 警告</span>}
                    {row!.verdict === "SINGLE" && <span className="text-slate-400">単一記載</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        判定は決定論的な正規化（単位・日付・表記ゆれの吸収）後の完全一致で行っています。商品名の表記差など、同一性の最終判断は人間が行ってください。
      </p>
    </div>
  );
}
