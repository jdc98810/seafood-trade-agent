// Validation Agent（仕様書§7.6 / §11）
// LLMを一切使わない決定論的ルール。値が無い場合は「不一致」ではなく「根拠不足」。

import type { DocumentType, IssueType, Severity, SourceValue } from "@/lib/domain";
import { DOCUMENT_TYPE_LABELS, FIELD_LABELS_JA } from "@/lib/domain";
import {
  normalizeCode,
  normalizeCountry,
  normalizeText,
  parseAmount,
  parseCount,
  parseDateISO,
  parseWeightKg,
} from "./normalization";

export interface DocForValidation {
  documentType: string;
  fields: {
    fieldName: string;
    originalValue: string | null;
  }[];
}

export interface ValidationInput {
  requiredDocumentTypes: string[];
  documents: DocForValidation[]; // isActive な書類のみ渡す
  expectedEtd?: string | null; // ISO
  expectedEta?: string | null; // ISO
}

export interface IssueDraft {
  issueType: IssueType;
  severity: Severity;
  fieldName: string | null;
  description: string;
  sourceValues: SourceValue[];
  recommendedAction: string;
}

function docLabel(t: string): string {
  return DOCUMENT_TYPE_LABELS[t as DocumentType] ?? t;
}

function fieldValue(doc: DocForValidation, fieldName: string): string | null {
  const f = doc.fields.find((x) => x.fieldName === fieldName);
  return f?.originalValue ?? null;
}

/** 各書類に現れた値を集める（記載のある書類のみ） */
function collect(
  docs: DocForValidation[],
  fieldName: string
): { documentType: string; original: string }[] {
  const out: { documentType: string; original: string }[] = [];
  for (const d of docs) {
    const v = fieldValue(d, fieldName);
    if (v != null && v.trim() !== "") out.push({ documentType: d.documentType, original: v });
  }
  return out;
}

// ---------- 完全性確認 ----------

function checkMissingDocuments(input: ValidationInput): IssueDraft[] {
  const present = new Set(input.documents.map((d) => d.documentType));
  return input.requiredDocumentTypes
    .filter((t) => !present.has(t))
    .map((t) => ({
      issueType: "MISSING_DOCUMENT" as const,
      severity: "YELLOW" as const,
      fieldName: null,
      description: `${docLabel(t)} が未受領です。`,
      sourceValues: [],
      recommendedAction: `${docLabel(t)} の発行状況を輸出者へ確認し、提出資料確定前にコピーを依頼してください。`,
    }));
}

// 書類種別ごとに記載が期待される必須項目（ルールデータ）
const EXPECTED_FIELDS: Record<string, string[]> = {
  COMMERCIAL_INVOICE: ["invoiceNo", "productName", "netWeightKg", "totalAmount", "originCountry"],
  PACKING_LIST: ["packageCount", "netWeightKg", "grossWeightKg"],
  BILL_OF_LADING: ["blNo", "containerNo", "sealNo", "portOfLoading", "portOfDischarge"],
  HEALTH_CERTIFICATE: ["certificateNo", "scientificName", "sealNo", "netWeightKg"],
};

function checkMissingFields(input: ValidationInput): IssueDraft[] {
  const issues: IssueDraft[] = [];
  for (const doc of input.documents) {
    const expected = EXPECTED_FIELDS[doc.documentType] ?? [];
    for (const fn of expected) {
      if (fieldValue(doc, fn) == null) {
        const label = FIELD_LABELS_JA[fn as keyof typeof FIELD_LABELS_JA] ?? fn;
        issues.push({
          issueType: "MISSING_FIELD",
          severity: "YELLOW",
          fieldName: fn,
          description: `${docLabel(doc.documentType)} に ${label} の記載がありません。`,
          sourceValues: [{ documentType: doc.documentType, value: null }],
          recommendedAction: `${docLabel(doc.documentType)} へ ${label} を追記できるか輸出者へ確認してください。`,
        });
      }
    }
  }
  return issues;
}

// ---------- 一致性確認 ----------

interface ConsistencyRule {
  fieldName: string;
  normalize: (v: string) => string | null;
  // 正規化後の相異なる値が2つ以上ある場合の重大度
  severity: (values: string[]) => Severity;
  format?: (v: string) => string;
}

function weightSeverity(values: string[]): Severity {
  const nums = values.map(Number).filter((n) => !Number.isNaN(n));
  if (nums.length >= 2) {
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    if (max > 0 && (max - min) / max > 0.01) return "RED"; // 1%超の差は重大
  }
  return "YELLOW";
}

const CONSISTENCY_RULES: ConsistencyRule[] = [
  {
    fieldName: "netWeightKg",
    normalize: (v) => {
      const n = parseWeightKg(v);
      return n == null ? null : String(n);
    },
    severity: weightSeverity,
    format: (v) => `${Number(v).toLocaleString()} kg`,
  },
  {
    fieldName: "grossWeightKg",
    normalize: (v) => {
      const n = parseWeightKg(v);
      return n == null ? null : String(n);
    },
    severity: weightSeverity,
    format: (v) => `${Number(v).toLocaleString()} kg`,
  },
  {
    fieldName: "quantity",
    normalize: (v) => {
      const n = parseCount(v);
      return n == null ? null : String(n);
    },
    severity: () => "YELLOW",
  },
  {
    fieldName: "packageCount",
    normalize: (v) => {
      const n = parseCount(v);
      return n == null ? null : String(n);
    },
    severity: () => "YELLOW",
  },
  { fieldName: "containerNo", normalize: (v) => normalizeCode(v), severity: () => "RED" },
  { fieldName: "sealNo", normalize: (v) => normalizeCode(v), severity: () => "RED" },
  { fieldName: "originCountry", normalize: (v) => normalizeCountry(v), severity: () => "RED" },
  { fieldName: "invoiceNo", normalize: (v) => normalizeCode(v), severity: () => "YELLOW" },
];

function checkConsistency(input: ValidationInput): IssueDraft[] {
  const issues: IssueDraft[] = [];
  for (const rule of CONSISTENCY_RULES) {
    const entries = collect(input.documents, rule.fieldName);
    if (entries.length < 2) continue; // 比較対象が1つ以下 → 判定しない（根拠不足でも不一致でもない）

    const normalized = entries.map((e) => ({ ...e, norm: rule.normalize(e.original) }));
    const distinct = [...new Set(normalized.filter((e) => e.norm != null).map((e) => e.norm))];
    if (distinct.length <= 1) continue;

    const label = FIELD_LABELS_JA[rule.fieldName as keyof typeof FIELD_LABELS_JA] ?? rule.fieldName;
    const lines = normalized
      .map((e) => `${docLabel(e.documentType)}: ${e.original}`)
      .join(" / ");
    issues.push({
      issueType: "MISMATCH",
      severity: rule.severity(distinct as string[]),
      fieldName: rule.fieldName,
      description: `${label} が書類間で一致していません。（${lines}）`,
      sourceValues: normalized.map((e) => ({ documentType: e.documentType, value: e.original })),
      recommendedAction: `正しい${label}を輸出者へ確認し、必要に応じて該当書類の修正版を依頼してください。`,
    });
  }

  // 商品同一性（表記が違っても同一商品の可能性がある → 要確認どまり）
  const productEntries = collect(input.documents, "productName");
  if (productEntries.length >= 2) {
    const norms = productEntries.map((e) => ({ ...e, norm: normalizeText(e.original) ?? "" }));
    const distinct = [...new Set(norms.map((e) => e.norm))];
    if (distinct.length > 1) {
      // トークン共通性: すべての表記が少なくとも1語を共有していれば YELLOW、共有ゼロなら RED
      const tokenSets = distinct.map((s) => new Set(s.split(" ")));
      const shared = [...tokenSets[0]].some((t) => tokenSets.every((set) => set.has(t)));
      issues.push({
        issueType: "MISMATCH",
        severity: shared ? "YELLOW" : "RED",
        fieldName: "productName",
        description: `商品名の表記が書類間で異なります。（${norms
          .map((e) => `${docLabel(e.documentType)}: ${e.original}`)
          .join(" / ")}）同一商品かどうか確認が必要です。`,
        sourceValues: norms.map((e) => ({ documentType: e.documentType, value: e.original })),
        recommendedAction:
          "各書類の商品名が同一商品を指しているか確認し、必要であれば統一表記の修正版を依頼してください。",
      });
    }
  }

  return issues;
}

// ---------- 妥当性確認 ----------

const CONTAINER_NO_PATTERN = /^[A-Z]{4}\d{7}$/;

function checkPlausibility(input: ValidationInput): IssueDraft[] {
  const issues: IssueDraft[] = [];

  // ETD / ETA の順序
  const etds = collect(input.documents, "etd").map((e) => parseDateISO(e.original)).filter(Boolean);
  const etd = input.expectedEtd ?? etds[0] ?? null;
  const eta = input.expectedEta ?? null;
  if (etd && eta && etd >= eta) {
    issues.push({
      issueType: "PLAUSIBILITY",
      severity: "RED",
      fieldName: "eta",
      description: `ETA（${eta}）がETD（${etd}）より前または同日になっています。`,
      sourceValues: [
        { documentType: "SHIPMENT", value: etd },
        { documentType: "SHIPMENT", value: eta },
      ],
      recommendedAction: "スケジュール情報の入力誤りがないか確認してください。",
    });
  }

  // Container No. 形式（ISO 6346 簡易チェック: 英4+数7）
  for (const e of collect(input.documents, "containerNo")) {
    const norm = normalizeCode(e.original);
    if (norm && !CONTAINER_NO_PATTERN.test(norm)) {
      issues.push({
        issueType: "PLAUSIBILITY",
        severity: "YELLOW",
        fieldName: "containerNo",
        description: `${docLabel(e.documentType)} の Container No.「${e.original}」が標準形式（英字4桁+数字7桁）と一致しません。`,
        sourceValues: [{ documentType: e.documentType, value: e.original }],
        recommendedAction: "Container No. の記載誤りがないか確認してください。",
      });
    }
  }

  // 単価 × 重量 ≒ 合計金額（Invoice内、単価が /kg の場合）
  const invoice = input.documents.find((d) => d.documentType === "COMMERCIAL_INVOICE");
  if (invoice) {
    const unit = parseAmount(fieldValue(invoice, "unitPrice"));
    const total = parseAmount(fieldValue(invoice, "totalAmount"));
    const weight = parseWeightKg(fieldValue(invoice, "netWeightKg"));
    if (unit != null && total != null && weight != null) {
      const expected = unit * weight;
      if (Math.abs(expected - total) / total > 0.005) {
        issues.push({
          issueType: "PLAUSIBILITY",
          severity: "RED",
          fieldName: "totalAmount",
          description: `Invoiceの単価（${unit}）× Net Weight（${weight} kg）= ${expected.toLocaleString()} が合計金額（${total.toLocaleString()}）と一致しません。`,
          sourceValues: [
            { documentType: "COMMERCIAL_INVOICE", value: String(unit) },
            { documentType: "COMMERCIAL_INVOICE", value: String(total) },
          ],
          recommendedAction: "単価・数量・合計金額のいずれかに誤りがないか輸出者へ確認してください。",
        });
      }
    } else if (total != null && (unit == null || weight == null)) {
      issues.push({
        issueType: "INSUFFICIENT_EVIDENCE",
        severity: "GREEN",
        fieldName: "totalAmount",
        description:
          "合計金額の検算に必要な単価または重量が抽出できていないため、金額の妥当性を確認できません。",
        sourceValues: [{ documentType: "COMMERCIAL_INVOICE", value: String(total) }],
        recommendedAction: "Invoiceの単価・重量欄を確認し、抽出値を人間が補完してください。",
      });
    }
  }

  return issues;
}

/** すべてのルールを実行して Issue 一覧を返す（決定論的・副作用なし） */
export function validateShipment(input: ValidationInput): IssueDraft[] {
  return [
    ...checkMissingDocuments(input),
    ...checkMissingFields(input),
    ...checkConsistency(input),
    ...checkPlausibility(input),
  ];
}
