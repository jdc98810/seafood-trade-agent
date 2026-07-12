// 4種のサンプル貿易書類PDFを生成する（仕様書§12）。
// 意図的な問題:
//   - Packing List の Net Weight = 9,800 kg（他書類は 10,000 kg）
//   - Health Certificate に Seal No. の記載なし
//   - Certificate of Origin は生成しない（不足書類）
// テキスト型PDF（英語）なので、unpdf + LLM の実抽出でも処理できる。

import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT_DIR = path.join(process.cwd(), "sample-documents");

interface Line {
  text: string;
  bold?: boolean;
  size?: number;
  gapBefore?: number;
}

async function createDocumentPdf(title: string, lines: Line[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(title, { x: 50, y: 780, size: 18, font: fontBold, color: rgb(0.1, 0.15, 0.3) });
  page.drawLine({
    start: { x: 50, y: 770 },
    end: { x: 545, y: 770 },
    thickness: 1.5,
    color: rgb(0.1, 0.15, 0.3),
  });

  let y = 740;
  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    page.drawText(line.text, {
      x: 50,
      y,
      size: line.size ?? 10.5,
      font: line.bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 18;
  }

  page.drawText("*** SAMPLE DOCUMENT FOR DEMO PURPOSES ONLY ***", {
    x: 50,
    y: 40,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return doc.save();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const invoice = await createDocumentPdf("COMMERCIAL INVOICE", [
    { text: "Invoice No.: ABC-INV-2026-0712", bold: true },
    { text: "Date: July 10, 2026" },
    { text: "Seller: ABC Seafood Co., Ltd., Ho Chi Minh City, Vietnam", gapBefore: 10 },
    { text: "Buyer: Nihon Suisan Trading K.K., Tokyo, Japan" },
    { text: "Description of Goods: Frozen Vannamei Shrimp (HOSO)", gapBefore: 14, bold: true },
    { text: "Country of Origin: Vietnam" },
    { text: "Quantity: 500 cartons" },
    { text: "Total Net Weight: 10,000 kg" },
    { text: "Total Gross Weight: 10,500 kg" },
    { text: "Unit Price: USD 8.50 per kg", gapBefore: 10 },
    { text: "Total Amount: USD 85,000.00", bold: true },
    { text: "Trade Terms: CIF Tokyo, Incoterms 2020" },
    { text: "Container No.: TEMU1234567", gapBefore: 10 },
    { text: "Seal No.: VN998877" },
    { text: "Port of Loading: Ho Chi Minh City, Vietnam" },
    { text: "Port of Discharge: Tokyo, Japan" },
    { text: "ETD: July 18, 2026" },
  ]);
  await fs.writeFile(path.join(OUT_DIR, "Commercial_Invoice_VN-JP-001.pdf"), invoice);

  const packingList = await createDocumentPdf("PACKING LIST", [
    { text: "Ref. Invoice No.: ABC-INV-2026-0712", bold: true },
    { text: "Date: July 10, 2026" },
    { text: "Shipper: ABC Seafood Co., Ltd.", gapBefore: 10 },
    { text: "Consignee: Nihon Suisan Trading K.K." },
    { text: "Commodity: Frozen Shrimp", gapBefore: 14, bold: true },
    { text: "Country of Origin: Vietnam" },
    { text: "Number of Packages: 500 cartons" },
    { text: "Total: 500 cartons" },
    // 意図的な不一致: 他書類は 10,000 kg
    { text: "Total Net Weight: 9,800 kg", bold: true },
    { text: "Total Gross Weight: 10,500 kg" },
    { text: "Container No.: TEMU1234567", gapBefore: 10 },
    { text: "Seal No.: VN998877" },
    { text: "Packing: 20 kg net per carton, plastic bag in master carton", gapBefore: 10 },
  ]);
  await fs.writeFile(path.join(OUT_DIR, "Packing_List_VN-JP-001.pdf"), packingList);

  const bl = await createDocumentPdf("BILL OF LADING", [
    { text: "B/L No.: OCEA-VNJP-556677", bold: true },
    { text: "Shipper: ABC Seafood Co., Ltd.", gapBefore: 10 },
    { text: "Consignee: Nihon Suisan Trading K.K." },
    { text: "Notify Party: Same as Consignee" },
    { text: "Ocean Vessel: OCEAN STAR V.026E", gapBefore: 14 },
    { text: "Port of Loading: Ho Chi Minh City, Vietnam" },
    { text: "Port of Discharge: Tokyo, Japan" },
    { text: "Shipped on Board Date: 2026-07-18" },
    { text: "Description of Goods: Frozen Shrimp, 500 cartons", gapBefore: 14, bold: true },
    { text: "No. of Packages: 500 cartons" },
    { text: "Gross Weight: 10,500 kgs" },
    { text: "Container No.: TEMU1234567", gapBefore: 10 },
    { text: "Seal No.: VN998877" },
    { text: "Temperature: Maintain at -18°C (Frozen)" },
    { text: "Freight: Prepaid", gapBefore: 10 },
  ]);
  await fs.writeFile(path.join(OUT_DIR, "Bill_of_Lading_VN-JP-001.pdf"), bl);

  // 意図的な問題: Seal No. の記載なし
  const health = await createDocumentPdf("HEALTH CERTIFICATE", [
    { text: "Certificate No.: VN-HC-2026-88231", bold: true },
    { text: "Issuing Authority: National Agro-Forestry-Fisheries Quality Assurance Department", size: 9 },
    { text: "Date of Issue: July 11, 2026" },
    { text: "Product: Frozen Vannamei Shrimp", gapBefore: 14, bold: true },
    { text: "Scientific Name: Litopenaeus vannamei" },
    { text: "Country of Origin: Vietnam" },
    { text: "Exporter: ABC Seafood Co., Ltd.", gapBefore: 10 },
    { text: "Processing Establishment: ABC Seafood Processing Plant No.2, Approval No. DL-123" },
    { text: "Net Weight: 10,000 kg", gapBefore: 10 },
    { text: "Number of Packages: 500 cartons" },
    { text: "Container No.: TEMU1234567" },
    { text: "Storage and Transport Condition: Frozen, at -18°C or below" },
    {
      text: "This is to certify that the above product is fit for human consumption.",
      gapBefore: 14,
    },
  ]);
  await fs.writeFile(path.join(OUT_DIR, "Health_Certificate_VN-JP-001.pdf"), health);

  console.log(`サンプルPDFを ${OUT_DIR} に生成しました:`);
  console.log("- Commercial_Invoice_VN-JP-001.pdf (Net Weight 10,000 kg)");
  console.log("- Packing_List_VN-JP-001.pdf (Net Weight 9,800 kg ← 意図的な不一致)");
  console.log("- Bill_of_Lading_VN-JP-001.pdf");
  console.log("- Health_Certificate_VN-JP-001.pdf (Seal No. なし ← 意図的な欠落)");
  console.log("- Certificate of Origin は意図的に生成しません（不足書類のデモ用）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
