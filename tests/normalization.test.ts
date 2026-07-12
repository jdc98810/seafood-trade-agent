import { describe, expect, it } from "vitest";
import {
  normalizeCode,
  normalizeCountry,
  parseAmount,
  parseCount,
  parseDateISO,
  parseWeightKg,
} from "@/lib/agents/normalization";

describe("parseWeightKg", () => {
  it("カンマ・単位表記のゆれを吸収する", () => {
    expect(parseWeightKg("10,000 kg")).toBe(10000);
    expect(parseWeightKg("9,800 kg")).toBe(9800);
    expect(parseWeightKg("10500 kgs")).toBe(10500);
    expect(parseWeightKg("10.5 MT")).toBe(10500);
  });
  it("解析不能・空はnull", () => {
    expect(parseWeightKg(null)).toBeNull();
    expect(parseWeightKg("unknown")).toBeNull();
  });
});

describe("parseDateISO", () => {
  it("複数の日付形式をISOへ統一する", () => {
    expect(parseDateISO("2026-07-18")).toBe("2026-07-18");
    expect(parseDateISO("2026/7/18")).toBe("2026-07-18");
    expect(parseDateISO("July 18, 2026")).toBe("2026-07-18");
    expect(parseDateISO("18 July 2026")).toBe("2026-07-18");
    expect(parseDateISO("18/07/2026")).toBe("2026-07-18");
  });
  it("不正な日付はnull", () => {
    expect(parseDateISO("2026-13-99")).toBeNull();
    expect(parseDateISO("soon")).toBeNull();
  });
});

describe("normalizeCountry", () => {
  it("国名表記を統一する", () => {
    expect(normalizeCountry("Viet Nam")).toBe("Vietnam");
    expect(normalizeCountry("VIETNAM")).toBe("Vietnam");
    expect(normalizeCountry("vn")).toBe("Vietnam");
  });
});

describe("normalizeCode", () => {
  it("空白・ハイフンを除去して大文字化する", () => {
    expect(normalizeCode("temu 1234567")).toBe("TEMU1234567");
    expect(normalizeCode("TEMU-1234567")).toBe("TEMU1234567");
  });
});

describe("parseAmount / parseCount", () => {
  it("金額・数量を数値化する", () => {
    expect(parseAmount("USD 85,000.00")).toBe(85000);
    expect(parseAmount("USD 8.50 / kg")).toBe(8.5);
    expect(parseCount("500 cartons")).toBe(500);
  });
});
