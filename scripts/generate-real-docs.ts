// VN-JP-002（Frozen Pangasius Fillets）用のリアルな書類一式を生成する。
// 5書類すべて揃っている代わりに、実務でありがちな2つの誤りを意図的に含む:
//   - B/L の Seal No. が VN112234（他書類は VN112233）← 転記ミス
//   - Health Certificate の梱包数が 1,200 cartons（他書類は 1,250）← 記載ミス
// DEMO_MODE=false での実LLM抽出テスト用（テキスト型PDF）。

import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const OUT = path.join(process.cwd(), "sample-documents", "VN-JP-002");

const NAVY = rgb(0.08, 0.15, 0.32);
const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.1, 0.1, 0.1);

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function header(ctx: Ctx, company: string, address: string, docTitle: string) {
  ctx.page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: NAVY });
  ctx.page.drawText(company, { x: 50, y: 818, size: 13, font: ctx.bold, color: rgb(1, 1, 1) });
  ctx.page.drawText(address, { x: 50, y: 806, size: 7.5, font: ctx.font, color: rgb(0.8, 0.85, 0.95) });
  ctx.page.drawText(docTitle, { x: 50, y: 765, size: 20, font: ctx.bold, color: NAVY });
  ctx.page.drawLine({ start: { x: 50, y: 757 }, end: { x: 545, y: 757 }, thickness: 1.2, color: NAVY });
  ctx.y = 735;
}

function kv(ctx: Ctx, label: string, value: string, x = 50, labelWidth = 150) {
  ctx.page.drawText(label, { x, y: ctx.y, size: 9, font: ctx.font, color: GRAY });
  ctx.page.drawText(value, { x: x + labelWidth, y: ctx.y, size: 9.5, font: ctx.bold, color: BLACK });
  ctx.y -= 16;
}

function sectionTitle(ctx: Ctx, title: string) {
  ctx.y -= 6;
  ctx.page.drawText(title, { x: 50, y: ctx.y, size: 10.5, font: ctx.bold, color: NAVY });
  ctx.y -= 4;
  ctx.page.drawLine({ start: { x: 50, y: ctx.y }, end: { x: 545, y: ctx.y }, thickness: 0.5, color: GRAY });
  ctx.y -= 14;
}

function tableRow(ctx: Ctx, cols: [string, number][], boldRow = false) {
  for (const [text, x] of cols) {
    ctx.page.drawText(text, { x, y: ctx.y, size: 9, font: boldRow ? ctx.bold : ctx.font, color: BLACK });
  }
  ctx.y -= 15;
}

function footer(ctx: Ctx, note: string) {
  ctx.page.drawText(note, { x: 50, y: 60, size: 8, font: ctx.font, color: GRAY });
  ctx.page.drawText("*** SAMPLE DOCUMENT FOR DEMO PURPOSES ONLY ***", {
    x: 50, y: 40, size: 7.5, font: ctx.font, color: rgb(0.65, 0.65, 0.65),
  });
}

async function newDoc(): Promise<{ doc: PDFDocument; ctx: Ctx }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, ctx: { page, font, bold, y: 735 } };
}

const EXPORTER = "SAIGON AQUA PRODUCTS JSC";
const EXPORTER_ADDR = "Lot 15, Tan Thuan Export Processing Zone, District 7, Ho Chi Minh City, Vietnam";
const IMPORTER = "Tokyo Marine Foods Co., Ltd.";
const IMPORTER_ADDR = "2-8-1 Toyosu, Koto-ku, Tokyo 135-0061, Japan";

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  // ---------- Commercial Invoice ----------
  {
    const { doc, ctx } = await newDoc();
    header(ctx, EXPORTER, EXPORTER_ADDR, "COMMERCIAL INVOICE");
    kv(ctx, "Invoice No.:", "SAP-INV-2026-0715");
    kv(ctx, "Invoice Date:", "July 15, 2026");
    kv(ctx, "Payment Terms:", "T/T 30 days after B/L date");
    sectionTitle(ctx, "PARTIES");
    kv(ctx, "Seller / Exporter:", EXPORTER);
    kv(ctx, "", EXPORTER_ADDR);
    kv(ctx, "Buyer / Importer:", IMPORTER);
    kv(ctx, "", IMPORTER_ADDR);
    sectionTitle(ctx, "GOODS");
    tableRow(ctx, [["Description", 50], ["Quantity", 280], ["Unit Price", 380], ["Amount", 480]], true);
    tableRow(ctx, [
      ["Frozen Pangasius Fillets (Well-Trimmed)", 50],
      ["1,250 cartons", 280],
      ["USD 3.20 / kg", 380],
      ["USD 40,000.00", 480],
    ]);
    tableRow(ctx, [["Scientific Name: Pangasius hypophthalmus", 50]]);
    tableRow(ctx, [["Packing: 10 kg net per carton (IQF, 1 x 10 kg bulk)", 50]]);
    ctx.y -= 4;
    kv(ctx, "Total Net Weight:", "12,500 kg");
    kv(ctx, "Total Gross Weight:", "13,750 kg");
    kv(ctx, "Total Amount:", "USD 40,000.00 (CIF Osaka)");
    kv(ctx, "Trade Terms:", "CIF Osaka, Incoterms 2020");
    kv(ctx, "Country of Origin:", "Vietnam");
    sectionTitle(ctx, "SHIPMENT");
    kv(ctx, "Container No.:", "TCLU7654321");
    kv(ctx, "Seal No.:", "VN112233");
    kv(ctx, "Port of Loading:", "Cat Lai Port, Ho Chi Minh City, Vietnam");
    kv(ctx, "Port of Discharge:", "Osaka, Japan");
    kv(ctx, "ETD:", "July 20, 2026");
    footer(ctx, "Bank: Vietcombank HCMC Branch / SWIFT: BFTVVNVX / A/C: 007-137-0088-xxx");
    await fs.writeFile(path.join(OUT, "Commercial_Invoice_VN-JP-002.pdf"), await doc.save());
  }

  // ---------- Packing List ----------
  {
    const { doc, ctx } = await newDoc();
    header(ctx, EXPORTER, EXPORTER_ADDR, "PACKING LIST");
    kv(ctx, "Ref. Invoice No.:", "SAP-INV-2026-0715");
    kv(ctx, "Date:", "July 15, 2026");
    sectionTitle(ctx, "PARTIES");
    kv(ctx, "Shipper:", EXPORTER);
    kv(ctx, "Consignee:", IMPORTER);
    sectionTitle(ctx, "PACKING DETAILS");
    tableRow(ctx, [["Commodity", 50], ["Cartons", 300], ["Net Wt.", 390], ["Gross Wt.", 470]], true);
    tableRow(ctx, [
      ["Frozen Pangasius Fillets (Well-Trimmed)", 50],
      ["1,250", 300],
      ["12,500 kg", 390],
      ["13,750 kg", 470],
    ]);
    ctx.y -= 4;
    kv(ctx, "Total Packages:", "1,250 cartons");
    kv(ctx, "Total Net Weight:", "12,500 kg");
    kv(ctx, "Total Gross Weight:", "13,750 kg");
    kv(ctx, "Packing:", "10 kg net per carton, PE liner in master carton");
    kv(ctx, "Country of Origin:", "Vietnam");
    kv(ctx, "Storage:", "Keep frozen at -18 degrees C or below");
    sectionTitle(ctx, "SHIPMENT");
    kv(ctx, "Container No.:", "TCLU7654321");
    kv(ctx, "Seal No.:", "VN112233");
    kv(ctx, "Marks & Nos.:", "TMF / OSAKA / C/No. 1-1250");
    footer(ctx, "Shipping marks as per attached specification.");
    await fs.writeFile(path.join(OUT, "Packing_List_VN-JP-002.pdf"), await doc.save());
  }

  // ---------- Bill of Lading（Seal No. 転記ミス: VN112234）----------
  {
    const { doc, ctx } = await newDoc();
    header(ctx, "HAI LONG CONTAINER LINES", "Head Office: 88 Nguyen Hue Blvd, District 1, Ho Chi Minh City, Vietnam", "BILL OF LADING");
    kv(ctx, "B/L No.:", "HLCU-VNJP-889900");
    kv(ctx, "Booking No.:", "BKG-2026-45521");
    sectionTitle(ctx, "PARTIES");
    kv(ctx, "Shipper:", EXPORTER);
    kv(ctx, "Consignee:", IMPORTER);
    kv(ctx, "Notify Party:", "Same as Consignee");
    sectionTitle(ctx, "VOYAGE");
    kv(ctx, "Ocean Vessel / Voy.:", "PACIFIC HARMONY V.031N");
    kv(ctx, "Port of Loading:", "Cat Lai Port, Ho Chi Minh City, Vietnam");
    kv(ctx, "Port of Discharge:", "Osaka, Japan");
    kv(ctx, "Shipped on Board:", "2026-07-20");
    sectionTitle(ctx, "CARGO");
    kv(ctx, "Description of Goods:", "Frozen Pangasius Fillets, 1,250 cartons");
    kv(ctx, "No. of Packages:", "1,250 cartons");
    kv(ctx, "Gross Weight:", "13,750 kgs");
    kv(ctx, "Measurement:", "28.500 CBM");
    kv(ctx, "Container No.:", "TCLU7654321");
    kv(ctx, "Seal No.:", "VN112234"); // ← 意図的な転記ミス
    kv(ctx, "Reefer Setting:", "-18 degrees C (Frozen)");
    kv(ctx, "Freight:", "Prepaid");
    footer(ctx, "One (1) of three (3) original Bills of Lading. Carrier's standard terms apply.");
    await fs.writeFile(path.join(OUT, "Bill_of_Lading_VN-JP-002.pdf"), await doc.save());
  }

  // ---------- Health Certificate（梱包数の記載ミス: 1,200）----------
  {
    const { doc, ctx } = await newDoc();
    header(
      ctx,
      "NATIONAL AGRO-FORESTRY-FISHERIES QUALITY ASSURANCE DEPARTMENT",
      "Socialist Republic of Viet Nam — Branch 4, Ho Chi Minh City",
      "HEALTH CERTIFICATE"
    );
    kv(ctx, "Certificate No.:", "VN-HC-2026-90455");
    kv(ctx, "Date of Issue:", "July 17, 2026");
    sectionTitle(ctx, "PRODUCT IDENTIFICATION");
    kv(ctx, "Product:", "Frozen Pangasius Fillets (Well-Trimmed)");
    kv(ctx, "Scientific Name:", "Pangasius hypophthalmus");
    kv(ctx, "Country of Origin:", "Vietnam");
    kv(ctx, "Net Weight:", "12,500 kg");
    kv(ctx, "Number of Packages:", "1,200 cartons"); // ← 意図的な記載ミス
    sectionTitle(ctx, "ORIGIN & PROCESSING");
    kv(ctx, "Exporter:", EXPORTER);
    kv(ctx, "Processing Plant:", "Saigon Aqua Plant No.3, Approval No. DL-451");
    kv(ctx, "Consignee:", IMPORTER);
    sectionTitle(ctx, "TRANSPORT");
    kv(ctx, "Container No.:", "TCLU7654321");
    kv(ctx, "Seal No.:", "VN112233");
    kv(ctx, "Transport Condition:", "Frozen, at -18 degrees C or below");
    ctx.y -= 8;
    ctx.page.drawText(
      "This is to certify that the fishery products described above were processed in an approved",
      { x: 50, y: ctx.y, size: 9, font: ctx.font, color: BLACK }
    );
    ctx.y -= 13;
    ctx.page.drawText(
      "establishment, subjected to official controls, and found fit for human consumption.",
      { x: 50, y: ctx.y, size: 9, font: ctx.font, color: BLACK }
    );
    footer(ctx, "Official stamp and signature of competent authority.");
    await fs.writeFile(path.join(OUT, "Health_Certificate_VN-JP-002.pdf"), await doc.save());
  }

  // ---------- Certificate of Origin ----------
  {
    const { doc, ctx } = await newDoc();
    header(
      ctx,
      "VIETNAM CHAMBER OF COMMERCE AND INDUSTRY (VCCI)",
      "Ho Chi Minh City Branch — 171 Vo Thi Sau Street, District 3",
      "CERTIFICATE OF ORIGIN (FORM B)"
    );
    kv(ctx, "Reference No.:", "VN-CO-2026-33112");
    kv(ctx, "Date of Issue:", "July 16, 2026");
    sectionTitle(ctx, "PARTIES");
    kv(ctx, "Exporter:", EXPORTER);
    kv(ctx, "", EXPORTER_ADDR);
    kv(ctx, "Importer:", IMPORTER);
    kv(ctx, "", IMPORTER_ADDR);
    sectionTitle(ctx, "GOODS");
    kv(ctx, "Description:", "Frozen Pangasius Fillets (Well-Trimmed)");
    kv(ctx, "Quantity:", "1,250 cartons");
    kv(ctx, "Net Weight:", "12,500 kg");
    kv(ctx, "Invoice No. & Date:", "SAP-INV-2026-0715, July 15, 2026");
    kv(ctx, "Country of Origin:", "Vietnam");
    sectionTitle(ctx, "DECLARATION");
    ctx.page.drawText(
      "The undersigned hereby declares that the above goods were wholly produced in Viet Nam.",
      { x: 50, y: ctx.y, size: 9, font: ctx.font, color: BLACK }
    );
    footer(ctx, "Certified by VCCI Ho Chi Minh City Branch.");
    await fs.writeFile(path.join(OUT, "Certificate_of_Origin_VN-JP-002.pdf"), await doc.save());
  }

  console.log(`VN-JP-002 の書類一式を ${OUT} に生成しました:`);
  console.log("- Commercial_Invoice_VN-JP-002.pdf");
  console.log("- Packing_List_VN-JP-002.pdf");
  console.log("- Bill_of_Lading_VN-JP-002.pdf   (Seal No. VN112234 ← 意図的な転記ミス)");
  console.log("- Health_Certificate_VN-JP-002.pdf (1,200 cartons ← 意図的な記載ミス)");
  console.log("- Certificate_of_Origin_VN-JP-002.pdf");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
