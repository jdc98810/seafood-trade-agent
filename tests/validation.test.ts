import { describe, expect, it } from "vitest";
import { validateShipment, type ValidationInput } from "@/lib/agents/validation";

const REQUIRED = [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
  "HEALTH_CERTIFICATE",
  "CERTIFICATE_OF_ORIGIN",
];

function doc(documentType: string, fields: Record<string, string | null>) {
  return {
    documentType,
    fields: Object.entries(fields).map(([fieldName, originalValue]) => ({
      fieldName,
      originalValue,
    })),
  };
}

// 仕様書§12のデモ案件を模したベース入力
function demoInput(): ValidationInput {
  return {
    requiredDocumentTypes: REQUIRED,
    expectedEtd: "2026-07-18",
    expectedEta: "2026-07-24",
    documents: [
      doc("COMMERCIAL_INVOICE", {
        invoiceNo: "ABC-INV-2026-0712",
        productName: "Frozen Vannamei Shrimp",
        originCountry: "Vietnam",
        netWeightKg: "10,000 kg",
        unitPrice: "USD 8.50 / kg",
        totalAmount: "USD 85,000.00",
        containerNo: "TEMU1234567",
        sealNo: "VN998877",
      }),
      doc("PACKING_LIST", {
        packageCount: "500",
        netWeightKg: "9,800 kg",
        grossWeightKg: "10,500 kg",
        originCountry: "Vietnam",
        containerNo: "TEMU1234567",
        sealNo: "VN998877",
      }),
      doc("BILL_OF_LADING", {
        blNo: "OCEA-VNJP-556677",
        containerNo: "TEMU1234567",
        sealNo: "VN998877",
        portOfLoading: "Ho Chi Minh City",
        portOfDischarge: "Tokyo",
        grossWeightKg: "10,500 kgs",
        productName: "Frozen Shrimp",
      }),
      doc("HEALTH_CERTIFICATE", {
        certificateNo: "VN-HC-2026-88231",
        scientificName: "Litopenaeus vannamei",
        netWeightKg: "10,000 kg",
        productName: "Frozen Vannamei Shrimp",
        originCountry: "Vietnam",
        sealNo: null, // 意図的な記載なし
      }),
    ],
  };
}

describe("validateShipment — 仕様書§12 デモ案件", () => {
  const issues = validateShipment(demoInput());

  it("Net Weight不一致（10,000 vs 9,800）をREDで検出する", () => {
    const issue = issues.find((i) => i.issueType === "MISMATCH" && i.fieldName === "netWeightKg");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("RED"); // 2%差は1%閾値超
    expect(issue!.sourceValues.length).toBe(3);
  });

  it("Certificate of Origin不足を検出する", () => {
    const issue = issues.find(
      (i) => i.issueType === "MISSING_DOCUMENT" && i.description.includes("Certificate of Origin")
    );
    expect(issue).toBeDefined();
  });

  it("Health CertificateのSeal No.記載なしを検出する", () => {
    const issue = issues.find(
      (i) =>
        i.issueType === "MISSING_FIELD" &&
        i.fieldName === "sealNo" &&
        i.sourceValues[0]?.documentType === "HEALTH_CERTIFICATE"
    );
    expect(issue).toBeDefined();
  });

  it("商品名の表記差（Vannamei Shrimp vs Shrimp）は要確認（YELLOW）", () => {
    const issue = issues.find((i) => i.fieldName === "productName");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("YELLOW"); // 共通トークンあり → 同一商品の可能性
  });

  it("一致している項目（Container No.等）はIssueにしない", () => {
    expect(issues.find((i) => i.fieldName === "containerNo")).toBeUndefined();
    expect(issues.find((i) => i.fieldName === "originCountry")).toBeUndefined();
  });

  it("金額計算（8.50 × 10,000 = 85,000）は問題なし", () => {
    expect(issues.find((i) => i.fieldName === "totalAmount")).toBeUndefined();
  });
});

describe("validateShipment — 個別ルール", () => {
  it("重量差1%以下はYELLOW", () => {
    const issues = validateShipment({
      requiredDocumentTypes: [],
      documents: [
        doc("COMMERCIAL_INVOICE", { netWeightKg: "10,000 kg" }),
        doc("PACKING_LIST", { netWeightKg: "9,950 kg" }),
      ],
    });
    const issue = issues.find((i) => i.fieldName === "netWeightKg");
    expect(issue?.severity).toBe("YELLOW");
  });

  it("値が1書類にしかない場合は不一致と判定しない", () => {
    const issues = validateShipment({
      requiredDocumentTypes: [],
      documents: [
        doc("COMMERCIAL_INVOICE", { netWeightKg: "10,000 kg" }),
        doc("BILL_OF_LADING", { blNo: "X" }),
      ],
    });
    expect(issues.find((i) => i.issueType === "MISMATCH")).toBeUndefined();
  });

  it("ETAがETDより前ならRED", () => {
    const issues = validateShipment({
      requiredDocumentTypes: [],
      documents: [],
      expectedEtd: "2026-07-24",
      expectedEta: "2026-07-18",
    });
    const issue = issues.find((i) => i.issueType === "PLAUSIBILITY" && i.fieldName === "eta");
    expect(issue?.severity).toBe("RED");
  });

  it("単価×重量と合計金額の不一致を検出する", () => {
    const issues = validateShipment({
      requiredDocumentTypes: [],
      documents: [
        doc("COMMERCIAL_INVOICE", {
          unitPrice: "USD 8.50 / kg",
          netWeightKg: "10,000 kg",
          totalAmount: "USD 90,000.00",
        }),
      ],
    });
    const issue = issues.find((i) => i.fieldName === "totalAmount");
    expect(issue?.issueType).toBe("PLAUSIBILITY");
    expect(issue?.severity).toBe("RED");
  });

  it("検算に必要な値が無い場合は不一致ではなく根拠不足にする", () => {
    const issues = validateShipment({
      requiredDocumentTypes: [],
      documents: [
        doc("COMMERCIAL_INVOICE", { totalAmount: "USD 85,000.00", netWeightKg: null, unitPrice: null }),
      ],
    });
    const issue = issues.find((i) => i.fieldName === "totalAmount");
    expect(issue?.issueType).toBe("INSUFFICIENT_EVIDENCE");
    expect(issue?.severity).toBe("GREEN");
  });

  it("Container No.形式違反を警告する", () => {
    const issues = validateShipment({
      requiredDocumentTypes: [],
      documents: [doc("BILL_OF_LADING", { containerNo: "TEM1234567", blNo: "X", sealNo: "Y", portOfLoading: "A", portOfDischarge: "B" })],
    });
    const issue = issues.find((i) => i.issueType === "PLAUSIBILITY" && i.fieldName === "containerNo");
    expect(issue).toBeDefined();
  });

  it("単位・カンマ表記が違っても実質同値なら一致扱い", () => {
    const issues = validateShipment({
      requiredDocumentTypes: [],
      documents: [
        doc("COMMERCIAL_INVOICE", { grossWeightKg: "10,500 kg" }),
        doc("BILL_OF_LADING", { grossWeightKg: "10500 kgs" }),
      ],
    });
    expect(issues.find((i) => i.fieldName === "grossWeightKg")).toBeUndefined();
  });
});
