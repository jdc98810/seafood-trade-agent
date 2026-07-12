// ページ表示用のデータ組み立て（読み取り専用）

import { prisma } from "@/lib/db";
import { FIELD_NAMES } from "@/lib/domain";

export async function getDashboardShipments() {
  const shipments = await prisma.shipment.findMany({
    orderBy: [{ urgency: "asc" }, { eta: "asc" }],
    include: {
      issues: { where: { status: "OPEN" } },
      approvalRequests: { where: { status: "PENDING" } },
      requiredDocuments: true,
    },
  });
  return shipments;
}

export type ShipmentDetail = NonNullable<Awaited<ReturnType<typeof getShipmentDetail>>>;

export async function getShipmentDetail(id: string) {
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: [{ documentType: "asc" }, { version: "desc" }],
        include: { fields: true },
      },
      issues: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      requiredDocuments: true,
      approvalRequests: { orderBy: { createdAt: "desc" } },
      drafts: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
}

export interface UnifiedField {
  fieldName: string;
  fieldId: string; // ExtractedField.id（修正・確認操作用）
  normalizedValue: string | null;
  originalValue: string | null;
  sourceDocumentType: string;
  sourceFileName: string;
  pageNumber: number | null;
  evidenceText: string | null;
  confidence: number | null;
  reviewStatus: string;
  otherSources: { documentType: string; originalValue: string | null }[];
}

/**
 * 統一Shipmentデータ（詳細画面・中央カラム）:
 * 各フィールドについて、人間確認済み > 信頼度の順で代表値を選ぶ。
 * 有効版（isActive）の書類のみ対象。
 */
export function buildUnifiedFields(detail: ShipmentDetail): UnifiedField[] {
  const activeDocs = detail.documents.filter((d) => d.isActive);
  const out: UnifiedField[] = [];
  for (const fieldName of FIELD_NAMES) {
    const candidates = activeDocs.flatMap((doc) =>
      doc.fields
        .filter((f) => f.fieldName === fieldName && f.originalValue != null)
        .map((f) => ({ doc, f }))
    );
    if (candidates.length === 0) continue;
    const score = (c: (typeof candidates)[number]) => {
      if (c.f.reviewStatus === "CORRECTED") return 3;
      if (c.f.reviewStatus === "CONFIRMED") return 2;
      return c.f.confidence ?? 0;
    };
    candidates.sort((a, b) => score(b) - score(a));
    const best = candidates[0];
    out.push({
      fieldName,
      fieldId: best.f.id,
      normalizedValue: best.f.normalizedValue,
      originalValue: best.f.originalValue,
      sourceDocumentType: best.doc.documentType,
      sourceFileName: best.doc.fileName,
      pageNumber: best.f.pageNumber,
      evidenceText: best.f.evidenceText,
      confidence: best.f.confidence,
      reviewStatus: best.f.reviewStatus,
      otherSources: candidates.slice(1).map((c) => ({
        documentType: c.doc.documentType,
        originalValue: c.f.originalValue,
      })),
    });
  }
  return out;
}

export async function getReviewQueue() {
  const [approvals, issues] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { status: "PENDING" },
      include: { shipment: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.validationIssue.findMany({
      where: { status: "OPEN" },
      include: { shipment: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { approvals, issues };
}
