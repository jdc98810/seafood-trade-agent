// デモ・スクリーンショット用: VN-JP-001 に4書類を投入し、メール草案まで作る。
// 実行前に `npm run db:seed` でクリーンな状態にしてから使う。

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import { processDocumentUpload } from "../src/lib/workflow/pipeline";
import { generateSupplierEmail, type IssueForDraft } from "../src/lib/agents/action";
import type { IssueType, SourceValue } from "../src/lib/domain";

const SAMPLES = path.join(process.cwd(), "sample-documents");
const FILES = [
  "Commercial_Invoice_VN-JP-001.pdf",
  "Packing_List_VN-JP-001.pdf",
  "Bill_of_Lading_VN-JP-001.pdf",
  "Health_Certificate_VN-JP-001.pdf",
];

async function main() {
  for (const f of FILES) {
    const buf = await fs.readFile(path.join(SAMPLES, f));
    const r = await processDocumentUpload("VN-JP-001", f, buf);
    console.log(`${f} → ${r.documentType} (${r.fieldCount}項目)`);
  }

  // メール草案（actions.ts の generateSupplierEmailAction と同じ流れ。revalidatePathは不要）
  const shipment = await prisma.shipment.findUniqueOrThrow({
    where: { id: "VN-JP-001" },
    include: { issues: { where: { status: "OPEN" } } },
  });
  const issues: IssueForDraft[] = shipment.issues.map((i) => ({
    issueType: i.issueType as IssueType,
    fieldName: i.fieldName,
    description: i.description,
    sourceValues: i.sourceValues ? (JSON.parse(i.sourceValues) as SourceValue[]) : [],
    recommendedAction: i.recommendedAction,
  }));
  const draft = await generateSupplierEmail({
    shipmentId: "VN-JP-001",
    exporterName: "ABC Seafood",
    issues,
  });
  await prisma.communicationDraft.create({
    data: {
      shipmentId: "VN-JP-001",
      language: draft.language,
      recipientType: draft.recipientType,
      subject: draft.subject,
      body: draft.body,
    },
  });
  await prisma.approvalRequest.create({
    data: {
      shipmentId: "VN-JP-001",
      approvalType: "COMMUNICATION_DRAFT",
      title: "輸出者向け確認依頼メール草案の承認",
      priority: "HIGH",
    },
  });
  console.log("メール草案を作成しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
