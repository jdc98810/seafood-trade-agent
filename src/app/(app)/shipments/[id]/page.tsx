import Link from "next/link";
import { notFound } from "next/navigation";
import { buildUnifiedFields, getShipmentDetail, type UnifiedField } from "@/lib/queries";
import {
  DOCUMENT_TYPE_LABELS,
  FIELD_LABELS_JA,
  ISSUE_TYPE_LABELS_JA,
  type DocumentType,
  type FieldName,
  type IssueType,
} from "@/lib/domain";
import { ConfidenceBadge, SeverityBadge, StatusBadge, UrgencyBadge } from "@/components/badges";
import { UploadForm } from "@/components/upload-form";
import {
  AdvanceButton,
  ApproveQuarantineButton,
  DeleteDocumentButton,
  DraftActions,
  FieldActions,
  GenerateEmailButton,
  IssueActions,
  ProceedToQuarantineButton,
  ResetShipmentButton,
  ResumeButton,
} from "@/components/action-buttons";

export const dynamic = "force-dynamic";

// 信頼度がこれ未満の抽出値は「要確認」として上部に表示する
const LOW_CONFIDENCE = 0.9;

function fieldLabel(name: string): string {
  return FIELD_LABELS_JA[name as FieldName] ?? name;
}

function FieldRow({ f, attention }: { f: UnifiedField; attention: boolean }) {
  return (
    <tr className={`border-b border-slate-100 align-top ${attention ? "bg-amber-50" : ""}`}>
      <td className="py-2 pr-2 text-xs text-slate-600">{fieldLabel(f.fieldName)}</td>
      <td className="py-2 pr-2">
        <div className="font-medium">{f.normalizedValue ?? f.originalValue}</div>
        {f.normalizedValue && f.normalizedValue !== f.originalValue && (
          <div className="text-xs text-slate-400">原文: {f.originalValue}</div>
        )}
        {f.reviewStatus === "CORRECTED" && (
          <span className="text-[11px] font-medium text-blue-700">人間が修正済み</span>
        )}
      </td>
      <td className="py-2 pr-2 text-xs">
        <details>
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
            {DOCUMENT_TYPE_LABELS[f.sourceDocumentType as DocumentType] ?? f.sourceDocumentType}
            {f.pageNumber ? ` p.${f.pageNumber}` : ""} / <ConfidenceBadge confidence={f.confidence} />
          </summary>
          <div className="mt-1 rounded bg-slate-50 p-2 text-slate-600">
            {f.evidenceText ? <>原文: “{f.evidenceText}”</> : "根拠テキストなし"}
            {f.otherSources.length > 0 && (
              <div className="mt-1 border-t border-slate-200 pt-1">
                他書類の値:{" "}
                {f.otherSources
                  .map(
                    (o) =>
                      `${DOCUMENT_TYPE_LABELS[o.documentType as DocumentType] ?? o.documentType}: ${o.originalValue}`
                  )
                  .join(" / ")}
              </div>
            )}
          </div>
        </details>
      </td>
      <td className="py-2">
        {attention && (
          <FieldActions fieldId={f.fieldId} current={f.normalizedValue ?? f.originalValue} />
        )}
      </td>
    </tr>
  );
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shipment = await getShipmentDetail(id);
  if (!shipment) notFound();

  const unified = buildUnifiedFields(shipment);
  const openIssues = shipment.issues.filter((i) => i.status === "OPEN");
  const resolvedCount = shipment.issues.filter((i) => i.status === "RESOLVED").length;
  const acceptedCount = shipment.issues.filter((i) => i.status === "ACCEPTED").length;
  const escalatedCount = shipment.issues.filter((i) => i.status === "ESCALATED").length;
  const otherIssues = shipment.issues.filter((i) => i.status !== "OPEN");

  // 人間の注意が必要なフィールド: 未解決問題に関係する項目 + 低信頼度の項目
  const issueFieldNames = new Set(openIssues.map((i) => i.fieldName).filter(Boolean));
  const attentionFields = unified.filter(
    (f) =>
      issueFieldNames.has(f.fieldName) ||
      (f.confidence != null && f.confidence < LOW_CONFIDENCE && f.reviewStatus !== "CORRECTED")
  );
  const attentionSet = new Set(attentionFields.map((f) => f.fieldName));
  const normalFields = unified.filter((f) => !attentionSet.has(f.fieldName));

  const receivedDocs = shipment.requiredDocuments.filter((r) => r.status === "RECEIVED").length;
  const missingDocs = shipment.requiredDocuments.filter((r) => r.status === "MISSING");
  const readyForGate = openIssues.length === 0 && shipment.status === "NEEDS_REVIEW";

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{shipment.id}</h1>
        <UrgencyBadge urgency={shipment.urgency} />
        <StatusBadge status={shipment.status} />
        <span className="text-sm text-slate-600">
          {shipment.route} / {shipment.product}
          {shipment.eta ? ` / ETA ${shipment.eta.toISOString().slice(0, 10)}` : ""}
        </span>
        <nav className="ml-auto flex gap-3 text-sm">
          <Link href={`/shipments/${shipment.id}/compare`} className="text-blue-700 hover:underline">
            書類間比較 →
          </Link>
          <Link href={`/shipments/${shipment.id}/progress`} className="text-blue-700 hover:underline">
            進捗・監査ログ →
          </Link>
        </nav>
      </div>

      {/* 案件総覧: いま何が済んでいて、何が残っているか */}
      <section
        className={`rounded-lg border p-4 shadow-sm ${
          readyForGate
            ? "border-emerald-300 bg-emerald-50"
            : openIssues.length > 0
              ? "border-amber-300 bg-amber-50"
              : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span className="font-bold">案件総覧</span>
          <span>
            書類:{" "}
            <span className="font-semibold">
              {receivedDocs} / {shipment.requiredDocuments.length}
            </span>
            {missingDocs.length > 0 && (
              <span className="text-amber-700">
                {" "}
                （不足:{" "}
                {missingDocs
                  .map((r) => DOCUMENT_TYPE_LABELS[r.documentType as DocumentType] ?? r.documentType)
                  .join("、")}
                ）
              </span>
            )}
          </span>
          <span>
            要対応:{" "}
            <span
              className={`font-semibold ${openIssues.length > 0 ? "text-amber-700" : "text-emerald-700"}`}
            >
              {openIssues.length}件
            </span>
          </span>
          <span className="text-slate-500">
            処理済み: 解消 {resolvedCount} / 受容 {acceptedCount}
            {escalatedCount > 0 ? ` / エスカレーション ${escalatedCount}` : ""}
          </span>
          <span className="ml-auto">
            {readyForGate ? (
              <ProceedToQuarantineButton shipmentId={shipment.id} />
            ) : openIssues.length > 0 ? (
              <span className="text-xs text-amber-800">
                右側の「要対応」をすべて処理すると、次の工程へ進めます
              </span>
            ) : null}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr_380px]">
        {/* 左: 書類 */}
        <section className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold">必要書類チェックリスト</h2>
            <ul className="space-y-1 text-sm">
              {shipment.requiredDocuments.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span>{r.status === "RECEIVED" ? "✅" : "⬜"}</span>
                  <span className={r.status === "RECEIVED" ? "" : "text-slate-500"}>
                    {DOCUMENT_TYPE_LABELS[r.documentType as DocumentType] ?? r.documentType}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold">書類アップロード</h2>
            <UploadForm shipmentId={shipment.id} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold">受領書類（{shipment.documents.length}件）</h2>
            <ul className="space-y-2">
              {shipment.documents.map((d) => (
                <li
                  key={d.id}
                  className={`rounded border p-2 text-xs ${
                    d.isActive ? "border-slate-200" : "border-slate-100 bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">
                      {DOCUMENT_TYPE_LABELS[d.documentType as DocumentType] ?? d.documentType}
                    </span>
                    <DeleteDocumentButton documentId={d.id} fileName={d.fileName} />
                  </div>
                  <div className="truncate text-slate-500" title={d.fileName}>
                    {d.fileName}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-500">
                    <span>v{d.version}</span>
                    <span>{d.isFinal ? "Final" : "Draft"}</span>
                    <span>{d.isActive ? "有効版" : "旧版（履歴）"}</span>
                    <span>{d.fields.length}項目</span>
                  </div>
                </li>
              ))}
              {shipment.documents.length === 0 && (
                <li className="text-xs text-slate-400">まだ書類がありません</li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-500">案件の管理</h2>
            <ResetShipmentButton shipmentId={shipment.id} />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              書類・指摘・草案をすべて削除し、書類受領前の状態に戻します。監査ログは保持されます。
            </p>
          </div>
        </section>

        {/* 中央: 統一Shipmentデータ（要確認項目を上に、正常項目は読み取り専用で折りたたみ） */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold">統一Shipmentデータ</h2>
          {unified.length === 0 ? (
            <p className="text-sm text-slate-400">書類をアップロードすると抽出結果が表示されます。</p>
          ) : (
            <>
              {attentionFields.length > 0 && (
                <>
                  <p className="mb-1 text-xs font-semibold text-amber-700">
                    ⚠ 要確認の項目（問題に関係する値・信頼度の低い値のみ表示しています）
                  </p>
                  <table className="mb-4 w-full text-sm">
                    <tbody>
                      {attentionFields.map((f) => (
                        <FieldRow key={f.fieldName} f={f} attention />
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <details open={attentionFields.length === 0}>
                <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800">
                  ✓ 問題のない項目（{normalFields.length}件）— 確認操作は不要です
                </summary>
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {normalFields.map((f) => (
                      <FieldRow key={f.fieldName} f={f} attention={false} />
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </section>

        {/* 右: 要対応 */}
        <section className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold">
              要対応{openIssues.length > 0 ? `（${openIssues.length}件）` : ""}
            </h2>
            {openIssues.length === 0 ? (
              <p className="text-sm text-emerald-700">✅ 対応が必要な問題はありません</p>
            ) : (
              <ul className="space-y-3">
                {openIssues.map((i) => (
                  <li key={i.id} className="rounded border border-slate-200 p-2">
                    <div className="mb-1 flex items-center gap-2">
                      <SeverityBadge severity={i.severity} />
                      <span className="text-xs text-slate-500">
                        {ISSUE_TYPE_LABELS_JA[i.issueType as IssueType] ?? i.issueType}
                      </span>
                    </div>
                    <p className="text-sm">{i.description}</p>
                    {i.recommendedAction && (
                      <p className="mt-1 text-xs text-slate-600">推奨: {i.recommendedAction}</p>
                    )}
                    <div className="mt-2">
                      <IssueActions issueId={i.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {otherIssues.length > 0 && (
              <details className="mt-2 text-xs text-slate-500">
                <summary className="cursor-pointer">処理済みの問題（{otherIssues.length}件）</summary>
                <ul className="mt-1 space-y-1">
                  {otherIssues.map((i) => (
                    <li key={i.id}>
                      [{i.status === "RESOLVED" ? "解消" : i.status === "ACCEPTED" ? "受容" : "エスカレーション"}]{" "}
                      {i.description}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold">次のアクション</h2>
            <div className="flex flex-col items-start gap-2">
              {shipment.status === "ESCALATED" ? (
                <ResumeButton shipmentId={shipment.id} />
              ) : (
                <>
                  {openIssues.length > 0 && <GenerateEmailButton shipmentId={shipment.id} />}
                  {shipment.status === "QUARANTINE_APPROVAL_REQUIRED" && (
                    <ApproveQuarantineButton shipmentId={shipment.id} />
                  )}
                  <AdvanceButton shipmentId={shipment.id} status={shipment.status} />
                </>
              )}
              {[
                "QUARANTINE_DRAFT_READY",
                "QUARANTINE_APPROVAL_REQUIRED",
                "READY_FOR_CUSTOMS_PREPARATION",
                "CUSTOMS_PACKAGE_READY",
                "CUSTOMS_APPROVAL_REQUIRED",
                "IMPORT_PERMITTED",
              ].includes(shipment.status) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <a
                    className="text-blue-700 underline"
                    href={`/api/shipments/${shipment.id}/package?kind=quarantine&format=json`}
                  >
                    検疫パッケージ (JSON)
                  </a>
                  <a
                    className="text-blue-700 underline"
                    href={`/api/shipments/${shipment.id}/package?kind=quarantine&format=csv`}
                  >
                    検疫パッケージ (CSV)
                  </a>
                  <a
                    className="text-blue-700 underline"
                    href={`/api/shipments/${shipment.id}/package?kind=customs&format=json`}
                  >
                    税関パッケージ (JSON)
                  </a>
                  <a
                    className="text-blue-700 underline"
                    href={`/api/shipments/${shipment.id}/package?kind=customs&format=csv`}
                  >
                    税関パッケージ (CSV)
                  </a>
                </div>
              )}
            </div>
          </div>

          {shipment.drafts.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-bold">連絡文草案（承認まで送信されません）</h2>
              <ul className="space-y-3">
                {shipment.drafts.map((d) => (
                  <li key={d.id} className="rounded border border-slate-200 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{d.subject}</span>
                      <span
                        className={`rounded px-1 text-[11px] ${
                          d.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : d.status === "REJECTED"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.status === "APPROVED" ? "承認済み" : d.status === "REJECTED" ? "却下" : "承認待ち"}
                      </span>
                    </div>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-sans text-slate-700">
                      {d.body}
                    </pre>
                    {d.status === "DRAFT" && (
                      <div className="mt-2">
                        <DraftActions draftId={d.id} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
