// Intake Agent（仕様書§7.2）
// ファイル名からの書類種別推定（決定論的）と Draft/Final 判定。
// ファイル名で判定できない場合は LLM 分類（extraction側）に委ねる。

import type { DocumentType } from "@/lib/domain";

const FILENAME_PATTERNS: [RegExp, DocumentType][] = [
  [/invoice|inv\b|ci_/i, "COMMERCIAL_INVOICE"],
  [/packing|pkl|pl_/i, "PACKING_LIST"],
  [/\bbl\b|b_l|lading|waybill|bill_?of_?lading/i, "BILL_OF_LADING"],
  [/health|sanitary|hc_/i, "HEALTH_CERTIFICATE"],
  [/origin|coo|c_o/i, "CERTIFICATE_OF_ORIGIN"],
];

export function classifyByFileName(fileName: string): DocumentType | null {
  for (const [pattern, type] of FILENAME_PATTERNS) {
    if (pattern.test(fileName)) return type;
  }
  return null;
}

/** ファイル名に draft / 仮 が含まれる場合は Draft 扱い */
export function isFinalByFileName(fileName: string): boolean {
  return !/draft|仮|下書き/i.test(fileName);
}
