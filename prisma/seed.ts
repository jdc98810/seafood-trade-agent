// デモ案件の投入（仕様書§12）。再実行可能（全削除→再作成）。
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { REQUIRED_DOCUMENTS_VN_JP } from "../src/lib/domain";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // 依存順に全削除
  await prisma.extractedField.deleteMany();
  await prisma.tradeDocument.deleteMany();
  await prisma.validationIssue.deleteMany();
  await prisma.requiredDocument.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.communicationDraft.deleteMany();
  await prisma.workflowEvent.deleteMany();
  await prisma.shipment.deleteMany();

  // メインのデモ案件（仕様書§12.1）
  await prisma.shipment.create({
    data: {
      id: "VN-JP-001",
      route: "Vietnam → Japan",
      product: "Frozen Vannamei Shrimp",
      scientificName: "Litopenaeus vannamei",
      purpose: "Sale",
      transport: "Sea",
      quantity: "500 cartons",
      expectedNetWeight: "10,000 kg",
      containerNo: "TEMU1234567",
      sealNo: "VN998877",
      etd: new Date("2026-07-18"),
      eta: new Date("2026-07-24"),
      transportCondition: "Frozen / -18°C",
      status: "DOCUMENTS_RECEIVING",
      urgency: "HIGH",
      requiredDocuments: {
        create: REQUIRED_DOCUMENTS_VN_JP.map((r) => ({
          documentType: r.documentType,
          requirementReason: r.requirementReason,
          status: "MISSING",
          confidence: 0.9,
        })),
      },
      events: {
        create: {
          fromState: null,
          toState: "DOCUMENTS_RECEIVING",
          actor: "agent",
          reason: "案件作成。書類の受領待ち。",
        },
      },
    },
  });

  // 実LLM抽出デモ用の第2案件（書類は sample-documents/VN-JP-002/ に一式あり）
  await prisma.shipment.create({
    data: {
      id: "VN-JP-002",
      route: "Vietnam → Japan",
      product: "Frozen Pangasius Fillets",
      scientificName: "Pangasius hypophthalmus",
      purpose: "Sale",
      transport: "Sea",
      quantity: "1,250 cartons",
      expectedNetWeight: "12,500 kg",
      containerNo: "TCLU7654321",
      etd: new Date("2026-07-20"),
      eta: new Date("2026-07-27"),
      transportCondition: "Frozen / -18°C",
      status: "DOCUMENTS_RECEIVING",
      urgency: "NORMAL",
      requiredDocuments: {
        create: REQUIRED_DOCUMENTS_VN_JP.map((r) => ({
          documentType: r.documentType,
          requirementReason: r.requirementReason,
          status: "MISSING",
          confidence: 0.9,
        })),
      },
      events: {
        create: {
          fromState: null,
          toState: "DOCUMENTS_RECEIVING",
          actor: "agent",
          reason: "案件作成。書類の受領待ち。",
        },
      },
    },
  });

  // ダッシュボード表示用のサブ案件（仕様書§6.1）
  await prisma.shipment.create({
    data: {
      id: "TW-JP-003",
      route: "Taiwan → Japan",
      product: "Frozen Squid",
      status: "QUARANTINE_APPROVAL_REQUIRED",
      urgency: "NORMAL",
      eta: new Date("2026-07-26"),
      events: {
        create: {
          fromState: null,
          toState: "QUARANTINE_APPROVAL_REQUIRED",
          actor: "agent",
          reason: "デモ用サブ案件（提出準備完了・承認待ち）。",
        },
      },
      approvalRequests: {
        create: {
          approvalType: "SUBMISSION_PACKAGE",
          title: "食品等輸入届出書草案の確認",
          status: "PENDING",
          priority: "NORMAL",
        },
      },
    },
  });

  await prisma.shipment.create({
    data: {
      id: "JP-VN-007",
      route: "Japan → Vietnam",
      product: "Mackerel",
      status: "DOCUMENTS_RECEIVING",
      urgency: "LOW",
      etd: new Date("2026-07-29"),
      events: {
        create: {
          fromState: null,
          toState: "DOCUMENTS_RECEIVING",
          actor: "agent",
          reason: "デモ用サブ案件（書類1件不足）。",
        },
      },
      requiredDocuments: {
        create: [
          {
            documentType: "COMMERCIAL_INVOICE",
            requirementReason: "輸出申告の基礎資料",
            status: "MISSING",
          },
        ],
      },
    },
  });

  console.log("Seed完了: VN-JP-001 / VN-JP-002 / TW-JP-003 / JP-VN-007");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
