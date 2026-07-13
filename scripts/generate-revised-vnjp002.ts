// VN-JP-002 の修正版書類（輸出者からの返送を想定）:
//   - Bill of Lading: Seal No. を VN112233 に訂正
//   - Health Certificate: 梱包数を 1,250 cartons に訂正
// 実LLM抽出で再検証 → 該当Issueが自動で「解消」になることを確認する用。

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

function kv(ctx: Ctx, label: string, value: string) {
  ctx.page.drawText(label, { x: 50, y: ctx.y, size: 9, font: ctx.font, color: GRAY });
  ctx.page.drawText(value, { x: 200, y: ctx.y, size: 9.5, font: ctx.bold, color: BLACK });
  ctx.y -= 16;
}

function sectionTitle(ctx: Ctx, title: string) {
  ctx.y -= 6;
  ctx.page.drawText(title, { x: 50, y: ctx.y, size: 10.5, font: ctx.bold, color: NAVY });
  ctx.y -= 4;
  ctx.page.drawLine({ start: { x: 50, y: ctx.y }, end: { x: 545, y: ctx.y }, thickness: 0.5, color: GRAY });
  ctx.y -= 14;
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
const IMPORTER = "Tokyo Marine Foods Co., Ltd.";

async function main() {
  // 修正版 B/L（Seal No. 訂正）
  {
    const { doc, ctx } = await newDoc();
    header(ctx, "HAI LONG CONTAINER LINES", "Head Office: 88 Nguyen Hue Blvd, District 1, Ho Chi Minh City, Vietnam", "BILL OF LADING (REVISED)");
    kv(ctx, "B/L No.:", "HLCU-VNJP-889900");
    kv(ctx, "Booking No.:", "BKG-2026-45521");
    kv(ctx, "Remark:", "Reissued to correct Seal No.");
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
    kv(ctx, "Container No.:", "TCLU7654321");
    kv(ctx, "Seal No.:", "VN112233"); // 訂正済み
    kv(ctx, "Reefer Setting:", "-18 degrees C (Frozen)");
    kv(ctx, "Freight:", "Prepaid");
    footer(ctx, "Reissued in exchange for the original B/L dated 2026-07-20.");
    await fs.writeFile(path.join(OUT, "Bill_of_Lading_VN-JP-002_revised.pdf"), await doc.save());
  }

  // 修正版 Health Certificate（梱包数訂正）
  {
    const { doc, ctx } = await newDoc();
    header(
      ctx,
      "NATIONAL AGRO-FORESTRY-FISHERIES QUALITY ASSURANCE DEPARTMENT",
      "Socialist Republic of Viet Nam — Branch 4, Ho Chi Minh City",
      "HEALTH CERTIFICATE (REVISED)"
    );
    kv(ctx, "Certificate No.:", "VN-HC-2026-90455-R1");
    kv(ctx, "Date of Issue:", "July 22, 2026");
    kv(ctx, "Remark:", "Replaces VN-HC-2026-90455 (correction of package count)");
    sectionTitle(ctx, "PRODUCT IDENTIFICATION");
    kv(ctx, "Product:", "Frozen Pangasius Fillets (Well-Trimmed)");
    kv(ctx, "Scientific Name:", "Pangasius hypophthalmus");
    kv(ctx, "Country of Origin:", "Vietnam");
    kv(ctx, "Net Weight:", "12,500 kg");
    kv(ctx, "Number of Packages:", "1,250 cartons"); // 訂正済み
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
      "This is to certify that the fishery products described above are fit for human consumption.",
      { x: 50, y: ctx.y, size: 9, font: ctx.font, color: BLACK }
    );
    footer(ctx, "Official stamp and signature of competent authority.");
    await fs.writeFile(path.join(OUT, "Health_Certificate_VN-JP-002_revised.pdf"), await doc.save());
  }

  console.log("修正版を生成: Bill_of_Lading_VN-JP-002_revised.pdf / Health_Certificate_VN-JP-002_revised.pdf");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
