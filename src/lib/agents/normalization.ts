// Normalization Agent（仕様書§7.4）
// 決定論的な正規化関数群。原文値は呼び出し側で必ず保持する。

import type { FieldName } from "@/lib/domain";

/** "10,000 kg" / "10500 kgs" / "9,800KG" → 10000 (kg) */
export function parseWeightKg(value: string | null): number | null {
  if (!value) return null;
  const m = value.replace(/,/g, "").match(/([\d.]+)\s*(kgs?|kilograms?|mt|tons?)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] ?? "kg").toLowerCase();
  if (unit === "mt" || unit.startsWith("ton")) return n * 1000;
  return n;
}

/** "USD 85,000.00" / "8.50" → 数値 */
export function parseAmount(value: string | null): number | null {
  if (!value) return null;
  const m = value.replace(/,/g, "").match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isNaN(n) ? null : n;
}

/** "500 cartons" / "500" → 500 */
export function parseCount(value: string | null): number | null {
  if (!value) return null;
  const m = value.replace(/,/g, "").match(/(\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/** "July 18, 2026" / "2026-07-18" / "18/07/2026" → "2026-07-18" (ISO) */
export function parseDateISO(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // ISO / スラッシュ区切り (yyyy-mm-dd, yyyy/mm/dd)
  let m = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return toISO(+m[1], +m[2], +m[3]);
  // dd/mm/yyyy（欧州式を想定）
  m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return toISO(+m[3], +m[2], +m[1]);
  // "July 18, 2026" / "18 July 2026"
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  m = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = months[m[1].slice(0, 3).toLowerCase()];
    if (mo) return toISO(+m[3], mo, +m[2]);
  }
  m = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (m) {
    const mo = months[m[2].slice(0, 3).toLowerCase()];
    if (mo) return toISO(+m[3], mo, +m[1]);
  }
  return null;
}

function toISO(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const COUNTRY_ALIASES: Record<string, string> = {
  "viet nam": "Vietnam",
  vietnam: "Vietnam",
  vn: "Vietnam",
  "socialist republic of viet nam": "Vietnam",
  japan: "Japan",
  jp: "Japan",
  taiwan: "Taiwan",
  tw: "Taiwan",
};

export function normalizeCountry(value: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return COUNTRY_ALIASES[key] ?? value.trim();
}

/** Container/Seal No.: 空白除去 + 大文字化 */
export function normalizeCode(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** 商品名: 小文字化・記号除去（同一性判定の素材。最終判断は人間） */
export function normalizeText(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ");
}

/** フィールドごとの正規化。表示用の normalizedValue 文字列を返す。 */
export function normalizeField(fieldName: FieldName, originalValue: string | null): string | null {
  if (originalValue == null) return null;
  switch (fieldName) {
    case "netWeightKg":
    case "grossWeightKg": {
      const kg = parseWeightKg(originalValue);
      return kg == null ? null : `${kg} kg`;
    }
    case "unitPrice":
    case "totalAmount": {
      const n = parseAmount(originalValue);
      return n == null ? null : String(n);
    }
    case "quantity":
    case "packageCount": {
      const n = parseCount(originalValue);
      return n == null ? null : String(n);
    }
    case "etd":
    case "eta":
      return parseDateISO(originalValue);
    case "originCountry":
      return normalizeCountry(originalValue);
    case "containerNo":
    case "sealNo":
      return normalizeCode(originalValue);
    default:
      return originalValue.trim();
  }
}
