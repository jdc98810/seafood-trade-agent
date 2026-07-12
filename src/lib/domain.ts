// ドメイン共通の型・定数・表示ラベル

export const DOCUMENT_TYPES = [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
  "HEALTH_CERTIFICATE",
  "CERTIFICATE_OF_ORIGIN",
  "OTHER",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  COMMERCIAL_INVOICE: "Commercial Invoice",
  PACKING_LIST: "Packing List",
  BILL_OF_LADING: "Bill of Lading",
  HEALTH_CERTIFICATE: "Health Certificate",
  CERTIFICATE_OF_ORIGIN: "Certificate of Origin",
  OTHER: "その他書類",
};

// 抽出対象フィールド。書類ごとに現れるものだけ抽出される。
export const FIELD_NAMES = [
  "productName",
  "scientificName",
  "originCountry",
  "exporter",
  "importer",
  "manufacturer",
  "quantity",
  "packageCount",
  "netWeightKg",
  "grossWeightKg",
  "unitPrice",
  "totalAmount",
  "currency",
  "incoterms",
  "containerNo",
  "sealNo",
  "portOfLoading",
  "portOfDischarge",
  "etd",
  "eta",
  "vesselName",
  "blNo",
  "invoiceNo",
  "certificateNo",
  "transportCondition",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export const FIELD_LABELS_JA: Record<FieldName, string> = {
  productName: "商品名",
  scientificName: "学名",
  originCountry: "原産国",
  exporter: "輸出者",
  importer: "輸入者",
  manufacturer: "製造者・加工場",
  quantity: "数量",
  packageCount: "梱包数",
  netWeightKg: "Net Weight (kg)",
  grossWeightKg: "Gross Weight (kg)",
  unitPrice: "単価",
  totalAmount: "合計金額",
  currency: "通貨",
  incoterms: "Incoterms",
  containerNo: "Container No.",
  sealNo: "Seal No.",
  portOfLoading: "積出港",
  portOfDischarge: "揚港",
  etd: "ETD",
  eta: "ETA",
  vesselName: "船名",
  blNo: "B/L No.",
  invoiceNo: "Invoice No.",
  certificateNo: "証明書番号",
  transportCondition: "輸送条件",
};

export type IssueType =
  | "MISMATCH"
  | "MISSING_DOCUMENT"
  | "MISSING_FIELD"
  | "PLAUSIBILITY"
  | "INSUFFICIENT_EVIDENCE";

export type Severity = "RED" | "YELLOW" | "GREEN";

export const SEVERITY_LABELS_JA: Record<Severity, string> = {
  RED: "要エスカレーション",
  YELLOW: "要確認",
  GREEN: "軽微",
};

export const ISSUE_TYPE_LABELS_JA: Record<IssueType, string> = {
  MISMATCH: "不一致",
  MISSING_DOCUMENT: "不足書類",
  MISSING_FIELD: "記載なし",
  PLAUSIBILITY: "妥当性警告",
  INSUFFICIENT_EVIDENCE: "根拠不足",
};

// 1書類から抽出された結果（LLM出力 / fixture の共通形）
export interface ExtractionField {
  fieldName: FieldName;
  originalValue: string | null;
  pageNumber: number | null;
  evidenceText: string | null;
  confidence: number; // 0..1
}

export interface ExtractionResult {
  documentType: DocumentType;
  fields: ExtractionField[];
}

// ValidationIssue.sourceValues にJSONで保存する形
export interface SourceValue {
  documentType: DocumentType | string;
  value: string | null;
}

// VN→JP 冷凍水産物ルートの必要書類（ルールデータ、仕様書§11）
export const REQUIRED_DOCUMENTS_VN_JP: {
  documentType: DocumentType;
  requirementReason: string;
}[] = [
  { documentType: "COMMERCIAL_INVOICE", requirementReason: "税関申告・検疫届出の基礎資料" },
  { documentType: "PACKING_LIST", requirementReason: "数量・梱包確認および検疫届出添付" },
  { documentType: "BILL_OF_LADING", requirementReason: "貨物引取りおよび輸入申告に必要" },
  { documentType: "HEALTH_CERTIFICATE", requirementReason: "水産物の衛生証明（輸出国政府発行）" },
  { documentType: "CERTIFICATE_OF_ORIGIN", requirementReason: "原産地確認・関税率適用のため" },
];
