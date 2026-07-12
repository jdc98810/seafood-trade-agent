"use server";

// Server Actions: 人間の操作（承認・修正・エスカレーション）とアップロードの入口。
// 重要操作はすべて WorkflowEvent（監査ログ）に残す。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { processDocumentUpload, revalidateShipment } from "@/lib/workflow/pipeline";
import { transitionShipment, recordEvent } from "@/lib/workflow/service";
import { generateSupplierEmail, type IssueForDraft } from "@/lib/agents/action";
import type { IssueType, SourceValue } from "@/lib/domain";

const ACTOR = "担当者"; // MVP: 認証なしの単一ユーザー

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function refresh(shipmentId: string) {
  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath(`/shipments/${shipmentId}`);
}

export async function uploadDocumentAction(
  shipmentId: string,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return { ok: false, message: "ファイルが選択されていません。" };
    const results: string[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        return { ok: false, message: `PDFのみ対応しています: ${file.name}` };
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return { ok: false, message: `ファイルサイズ上限(20MB)を超えています: ${file.name}` };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const r = await processDocumentUpload(shipmentId, file.name, buffer);
      results.push(`${file.name} → ${r.documentType}（${r.fieldCount}項目抽出）`);
    }
    refresh(shipmentId);
    return { ok: true, message: results.join(" / ") };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "アップロードに失敗しました。" };
  }
}

export async function confirmFieldAction(fieldId: string): Promise<void> {
  const field = await prisma.extractedField.update({
    where: { id: fieldId },
    data: { reviewStatus: "CONFIRMED" },
    include: { document: true },
  });
  await recordEvent(
    field.document.shipmentId,
    "FIELD_CONFIRMED",
    ACTOR,
    `${field.fieldName} の抽出値「${field.originalValue}」を確認済みにしました`
  );
  refresh(field.document.shipmentId);
}

export async function correctFieldAction(fieldId: string, newValue: string): Promise<void> {
  const before = await prisma.extractedField.findUniqueOrThrow({
    where: { id: fieldId },
    include: { document: true },
  });
  await prisma.extractedField.update({
    where: { id: fieldId },
    data: { normalizedValue: newValue, reviewStatus: "CORRECTED" },
  });
  await recordEvent(
    before.document.shipmentId,
    "FIELD_CORRECTED",
    ACTOR,
    `${before.fieldName} を「${before.originalValue}」から「${newValue}」へ修正しました`
  );
  await revalidateShipment(before.document.shipmentId, ACTOR);
  refresh(before.document.shipmentId);
}

export async function acceptIssueAction(issueId: string): Promise<void> {
  const issue = await prisma.validationIssue.update({
    where: { id: issueId },
    data: { status: "ACCEPTED" },
  });
  await recordEvent(
    issue.shipmentId,
    "ISSUE_ACCEPTED",
    ACTOR,
    `問題を差異として受容: ${issue.description}`
  );
  refresh(issue.shipmentId);
}

export async function escalateIssueAction(issueId: string): Promise<void> {
  const issue = await prisma.validationIssue.update({
    where: { id: issueId },
    data: { status: "ESCALATED" },
  });
  await transitionShipment(
    issue.shipmentId,
    "ESCALATED",
    ACTOR,
    `専門担当者へエスカレーション: ${issue.description}`
  );
  refresh(issue.shipmentId);
}

/** エスカレーション解除（確認へ戻す） */
export async function resumeFromEscalationAction(shipmentId: string): Promise<void> {
  await transitionShipment(shipmentId, "NEEDS_REVIEW", ACTOR, "エスカレーション対応完了。確認へ戻します。");
  refresh(shipmentId);
}

export async function generateSupplierEmailAction(shipmentId: string): Promise<void> {
  const shipment = await prisma.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    include: {
      issues: { where: { status: "OPEN" } },
      documents: { where: { isActive: true }, include: { fields: true } },
    },
  });

  const exporter =
    shipment.documents
      .flatMap((d) => d.fields)
      .find((f) => f.fieldName === "exporter" && f.originalValue)?.originalValue ??
    "Supplier";

  const issues: IssueForDraft[] = shipment.issues.map((i) => ({
    issueType: i.issueType as IssueType,
    fieldName: i.fieldName,
    description: i.description,
    sourceValues: i.sourceValues ? (JSON.parse(i.sourceValues) as SourceValue[]) : [],
    recommendedAction: i.recommendedAction,
  }));

  const draft = await generateSupplierEmail({
    shipmentId,
    exporterName: exporter.replace(/ Co\.,? ?Ltd\.?.*$/i, ""),
    issues,
  });

  await prisma.communicationDraft.create({
    data: {
      shipmentId,
      language: draft.language,
      recipientType: draft.recipientType,
      subject: draft.subject,
      body: draft.body,
    },
  });
  await prisma.approvalRequest.create({
    data: {
      shipmentId,
      approvalType: "COMMUNICATION_DRAFT",
      title: "輸出者向け確認依頼メール草案の承認",
      priority: shipment.urgency === "HIGH" ? "HIGH" : "NORMAL",
    },
  });
  await recordEvent(shipmentId, "DRAFT_GENERATED", "agent", `輸出者向けメール草案を作成: ${draft.subject}`);
  refresh(shipmentId);
}

export async function approveDraftAction(draftId: string): Promise<void> {
  const draft = await prisma.communicationDraft.update({
    where: { id: draftId },
    data: { status: "APPROVED" },
  });
  await prisma.approvalRequest.updateMany({
    where: { shipmentId: draft.shipmentId, approvalType: "COMMUNICATION_DRAFT", status: "PENDING" },
    data: { status: "APPROVED", reviewedBy: ACTOR, reviewedAt: new Date() },
  });
  await recordEvent(
    draft.shipmentId,
    "DRAFT_APPROVED",
    ACTOR,
    `メール草案を承認（本システムは送信しません。メールソフトからの手動送信をお願いします）: ${draft.subject}`
  );
  if (draft.recipientType === "SUPPLIER") {
    const s = await prisma.shipment.findUniqueOrThrow({ where: { id: draft.shipmentId } });
    if (s.status === "NEEDS_REVIEW") {
      await transitionShipment(draft.shipmentId, "WAITING_FOR_SUPPLIER", ACTOR, "輸出者への確認依頼を承認。回答待ち。");
    }
  }
  refresh(draft.shipmentId);
}

export async function rejectDraftAction(draftId: string): Promise<void> {
  const draft = await prisma.communicationDraft.update({
    where: { id: draftId },
    data: { status: "REJECTED" },
  });
  await prisma.approvalRequest.updateMany({
    where: { shipmentId: draft.shipmentId, approvalType: "COMMUNICATION_DRAFT", status: "PENDING" },
    data: { status: "EDITED", reviewedBy: ACTOR, reviewedAt: new Date() },
  });
  await recordEvent(draft.shipmentId, "DRAFT_REJECTED", ACTOR, `メール草案を却下: ${draft.subject}`);
  refresh(draft.shipmentId);
}

/** Gate: 未解決の問題が無ければ検疫準備へ進める */
export async function proceedToQuarantineAction(
  shipmentId: string
): Promise<{ ok: boolean; message: string }> {
  const open = await prisma.validationIssue.count({
    where: { shipmentId, status: "OPEN", severity: { in: ["RED", "YELLOW"] } },
  });
  if (open > 0) {
    return {
      ok: false,
      message: `未解決の問題が ${open} 件あります。解消または受容してから進めてください。`,
    };
  }
  await transitionShipment(shipmentId, "READY_FOR_QUARANTINE_PREPARATION", ACTOR, "人間確認完了。検疫準備へ進みます。");
  await transitionShipment(shipmentId, "QUARANTINE_DRAFT_READY", "agent", "検疫所向け提出準備パッケージを生成しました。");
  await transitionShipment(shipmentId, "QUARANTINE_APPROVAL_REQUIRED", "agent", "検疫提出資料の人間承認をお願いします。");
  await prisma.approvalRequest.create({
    data: {
      shipmentId,
      approvalType: "SUBMISSION_PACKAGE",
      title: "検疫所向け提出準備パッケージの承認",
      priority: "NORMAL",
    },
  });
  refresh(shipmentId);
  return { ok: true, message: "検疫提出準備パッケージを作成しました。承認をお願いします。" };
}

/** 検疫パッケージ承認 → 税関準備へ */
export async function approveQuarantinePackageAction(shipmentId: string): Promise<void> {
  await prisma.approvalRequest.updateMany({
    where: { shipmentId, approvalType: "SUBMISSION_PACKAGE", status: "PENDING" },
    data: { status: "APPROVED", reviewedBy: ACTOR, reviewedAt: new Date() },
  });
  await transitionShipment(shipmentId, "READY_FOR_CUSTOMS_PREPARATION", ACTOR, "検疫提出資料を承認しました。");
  await transitionShipment(shipmentId, "CUSTOMS_PACKAGE_READY", "agent", "税関・通関業者向け資料を生成しました。");
  await transitionShipment(shipmentId, "CUSTOMS_APPROVAL_REQUIRED", "agent", "税関申告資料の人間承認をお願いします。");
  refresh(shipmentId);
}

/** 汎用の承認リクエスト処理（確認センター用） */
export async function resolveApprovalAction(
  approvalId: string,
  decision: "APPROVED" | "ESCALATED"
): Promise<void> {
  const approval = await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: { status: decision, reviewedBy: ACTOR, reviewedAt: new Date() },
  });
  await recordEvent(
    approval.shipmentId,
    decision === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_ESCALATED",
    ACTOR,
    `${approval.title} → ${decision === "APPROVED" ? "承認" : "エスカレーション"}`
  );
  if (decision === "ESCALATED") {
    await transitionShipment(approval.shipmentId, "ESCALATED", ACTOR, approval.title);
  }
  refresh(approval.shipmentId);
}
