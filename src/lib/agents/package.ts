// Submission Package Agent（仕様書§7.8）
// 検疫所向け・税関向けの提出準備パッケージを JSON / CSV で組み立てる。
// 実際の行政システムへは接続しない。HS Code等の最終判断は人間が行う。

import { FIELD_LABELS_JA, type FieldName } from "@/lib/domain";

export interface UnifiedFieldView {
  fieldName: string;
  normalizedValue: string | null;
  originalValue: string | null;
  sourceDocumentType: string;
  pageNumber: number | null;
  evidenceText: string | null;
  confidence: number | null;
  reviewStatus: string;
}

export interface PackageInput {
  shipment: {
    id: string;
    route: string;
    product: string;
    scientificName: string | null;
    etd: string | null;
    eta: string | null;
    status: string;
  };
  unifiedFields: UnifiedFieldView[];
  documents: { documentType: string; fileName: string; version: number; isFinal: boolean }[];
  openIssues: { issueType: string; severity: string; description: string }[];
}

export function buildSubmissionPackage(kind: "QUARANTINE" | "CUSTOMS", input: PackageInput) {
  return {
    packageType: kind,
    generatedAt: new Date().toISOString(),
    note:
      kind === "QUARANTINE"
        ? "食品等輸入届出の準備用資料です。最終的な届出内容は人間が確認・確定してください。"
        : "輸入申告の準備用資料です。HS Code・関税・法令適用の最終判断は人間が行ってください。",
    shipment: input.shipment,
    fields: input.unifiedFields.map((f) => ({
      field: FIELD_LABELS_JA[f.fieldName as FieldName] ?? f.fieldName,
      value: f.normalizedValue ?? f.originalValue,
      source: f.sourceDocumentType,
      page: f.pageNumber,
      evidence: f.evidenceText,
      confidence: f.confidence,
      reviewStatus: f.reviewStatus,
    })),
    attachedDocuments: input.documents,
    outstandingIssues: input.openIssues,
    hsCode: { value: null, note: "未確定（人間による最終決定が必要）" },
  };
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function packageToCSV(pkg: ReturnType<typeof buildSubmissionPackage>): string {
  const rows: string[][] = [["項目", "値", "参照元書類", "ページ", "根拠テキスト", "信頼度", "確認状況"]];
  for (const f of pkg.fields) {
    rows.push([
      f.field,
      f.value ?? "",
      f.source,
      f.page == null ? "" : String(f.page),
      f.evidence ?? "",
      f.confidence == null ? "" : String(f.confidence),
      f.reviewStatus,
    ]);
  }
  // ExcelでUTF-8として開けるようBOMを付ける
  return "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}
