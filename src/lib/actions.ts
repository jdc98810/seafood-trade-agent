"use server";

// Server Actions: 人間の操作（承認・修正・エスカレーション）とアップロードの入口。
// 重要操作はすべて WorkflowEvent（監査ログ）に残す。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { processDocumentUpload, revalidateShipment } from "@/lib/workflow/pipeline";
import { transitionShipment, recordEvent } from "@/lib/workflow/service";
import { generateSupplierEmail, type IssueForDraft } from "@/lib/agents/action";
import { REQUIRED_DOCUMENTS_VN_JP, type IssueType, type SourceValue } from "@/lib/domain";

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

export interface NewShipmentInput {
  id: string;
  exportCountry: string;
  importCountry: string;
  product: string;
  scientificName?: string;
  quantity?: string;
  expectedNetWeight?: string;
  etd?: string;
  eta?: string;
  urgency: string;
}

/** 新規案件の作成。必要書類はVN→JP水産物ルートの標準セットを適用する（MVP）。 */
export async function createShipmentAction(
  input: NewShipmentInput
): Promise<{ ok: boolean; message: string }> {
  const id = input.id.trim().toUpperCase();
  if (!id) return { ok: false, message: "案件IDを入力してください。" };
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(id)) {
    return { ok: false, message: "案件IDは英数字とハイフンで入力してください（例: VN-JP-003）。" };
  }
  if (!input.product.trim()) return { ok: false, message: "商品名を入力してください。" };
  if (!input.exportCountry.trim() || !input.importCountry.trim()) {
    return { ok: false, message: "輸出国と輸入国を入力してください。" };
  }
  const existing = await prisma.shipment.findUnique({ where: { id } });
  if (existing) return { ok: false, message: `案件ID「${id}」は既に存在します。` };

  const etd = input.etd ? new Date(input.etd) : null;
  const eta = input.eta ? new Date(input.eta) : null;
  if (etd && eta && etd >= eta) {
    return { ok: false, message: "ETAはETDより後の日付にしてください。" };
  }

  await prisma.shipment.create({
    data: {
      id,
      route: `${input.exportCountry.trim()} → ${input.importCountry.trim()}`,
      product: input.product.trim(),
      scientificName: input.scientificName?.trim() || null,
      quantity: input.quantity?.trim() || null,
      expectedNetWeight: input.expectedNetWeight?.trim() || null,
      etd,
      eta,
      purpose: "Sale",
      transport: "Sea",
      status: "DOCUMENTS_RECEIVING",
      urgency: ["HIGH", "NORMAL", "LOW"].includes(input.urgency) ? input.urgency : "NORMAL",
      requiredDocuments: {
        create: REQUIRED_DOCUMENTS_VN_JP.map((r) => ({
          documentType: r.documentType,
          requirementReason: r.requirementReason,
          status: "MISSING",
        })),
      },
      events: {
        create: {
          fromState: null,
          toState: "DOCUMENTS_RECEIVING",
          actor: ACTOR,
          reason: "案件を作成しました。書類の受領待ち。",
        },
      },
    },
  });
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true, message: id };
}

/** 書類の削除。有効版を消した場合は直前の版を有効に戻し、再検証する。 */
export async function deleteDocumentAction(
  documentId: string
): Promise<{ ok: boolean; message: string }> {
  const doc = await prisma.tradeDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false, message: "書類が見つかりません。" };

  await prisma.extractedField.deleteMany({ where: { documentId } });
  await prisma.tradeDocument.delete({ where: { id: documentId } });

  // 有効版を消した場合、残っている最新版を有効に戻す
  if (doc.isActive) {
    const prev = await prisma.tradeDocument.findFirst({
      where: { shipmentId: doc.shipmentId, documentType: doc.documentType },
      orderBy: { version: "desc" },
    });
    if (prev) {
      await prisma.tradeDocument.update({ where: { id: prev.id }, data: { isActive: true } });
    } else {
      // 同種の書類が無くなった → チェックリストを未受領に戻す
      await prisma.requiredDocument.updateMany({
        where: { shipmentId: doc.shipmentId, documentType: doc.documentType },
        data: { status: "MISSING" },
      });
    }
  }

  await recordEvent(doc.shipmentId, "DOCUMENT_DELETED", ACTOR, `書類を削除: ${doc.fileName}（v${doc.version}）`);
  await revalidateShipment(doc.shipmentId, ACTOR);
  refresh(doc.shipmentId);
  return { ok: true, message: `${doc.fileName} を削除しました。` };
}

/**
 * 案件のリセット: 書類・抽出値・指摘・草案・承認を削除し、書類受領前の状態に戻す。
 * 監査ログ（WorkflowEvent）は削除しない。
 */
export async function resetShipmentAction(shipmentId: string): Promise<void> {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  await prisma.$transaction([
    prisma.extractedField.deleteMany({ where: { document: { shipmentId } } }),
    prisma.tradeDocument.deleteMany({ where: { shipmentId } }),
    prisma.validationIssue.deleteMany({ where: { shipmentId } }),
    prisma.communicationDraft.deleteMany({ where: { shipmentId } }),
    prisma.approvalRequest.deleteMany({ where: { shipmentId } }),
    prisma.requiredDocument.updateMany({
      where: { shipmentId },
      data: { status: "MISSING", humanConfirmed: false },
    }),
    prisma.shipment.update({ where: { id: shipmentId }, data: { status: "DOCUMENTS_RECEIVING" } }),
    prisma.workflowEvent.create({
      data: {
        shipmentId,
        fromState: shipment.status,
        toState: "DOCUMENTS_RECEIVING",
        actor: ACTOR,
        reason: "案件をリセットしました（書類・指摘・草案を削除。監査ログは保持）。",
      },
    }),
  ]);
  refresh(shipmentId);
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
  await prisma.approvalRequest.create({
    data: {
      shipmentId,
      approvalType: "SUBMISSION_PACKAGE",
      title: "税関・通関業者向け申告資料の承認",
      priority: "NORMAL",
    },
  });
  refresh(shipmentId);
}

/** 税関資料承認 → 輸入許可（実際の申告は通関業者経由で人間が行う） */
export async function approveCustomsPackageAction(shipmentId: string): Promise<void> {
  await prisma.approvalRequest.updateMany({
    where: { shipmentId, approvalType: "SUBMISSION_PACKAGE", status: "PENDING" },
    data: { status: "APPROVED", reviewedBy: ACTOR, reviewedAt: new Date() },
  });
  await transitionShipment(shipmentId, "IMPORT_PERMITTED", ACTOR, "税関申告資料を承認。輸入許可を確認しました。");
  refresh(shipmentId);
}

export async function arrangeDeliveryAction(shipmentId: string): Promise<void> {
  await transitionShipment(shipmentId, "DELIVERY_ARRANGED", ACTOR, "コンテナ引取り・納品を手配しました。");
  refresh(shipmentId);
}

export async function markDeliveredAction(shipmentId: string): Promise<void> {
  await transitionShipment(shipmentId, "DELIVERED", ACTOR, "納品が完了しました。");
  refresh(shipmentId);
}

export async function archiveShipmentAction(shipmentId: string): Promise<void> {
  await transitionShipment(shipmentId, "ARCHIVED", ACTOR, "案件を保存（アーカイブ）しました。");
  refresh(shipmentId);
}

// ---------- Gmail連携 ----------

/** Gmailの添付PDFを案件に取り込み、抽出・検証パイプラインへ流す */
export async function importGmailAttachmentAction(
  shipmentId: string,
  messageId: string,
  attachmentId: string,
  filename: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!filename.toLowerCase().endsWith(".pdf")) {
      return { ok: false, message: "PDFの添付のみ取り込めます。" };
    }
    const { getAttachment } = await import("@/lib/google");
    const buffer = await getAttachment(messageId, attachmentId);
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return { ok: false, message: "ファイルサイズ上限(20MB)を超えています。" };
    }
    await recordEvent(shipmentId, "GMAIL_IMPORT", ACTOR, `Gmailから書類を取り込み: ${filename}`);
    const r = await processDocumentUpload(shipmentId, filename, buffer);
    refresh(shipmentId);
    return { ok: true, message: `${filename} → ${r.documentType}（${r.fieldCount}項目抽出）` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "取り込みに失敗しました。" };
  }
}

/** AIによる草案の修正（指示例: 「もっと丁寧な英語に」「日本語に翻訳して」） */
export async function refineDraftAction(
  draftId: string,
  instruction: string
): Promise<{ ok: boolean; message: string; subject?: string; body?: string }> {
  try {
    const draft = await prisma.communicationDraft.findUniqueOrThrow({ where: { id: draftId } });
    const { isDemoMode, completeJSON } = await import("@/lib/llm/provider");
    if (isDemoMode()) {
      return { ok: false, message: "デモモードではAI修正は使えません（.envでLLMを設定してください）。" };
    }
    const { z } = await import("zod");
    const schema = z.object({ subject: z.string(), body: z.string() });
    const refined = await completeJSON(
      schema,
      `You are a professional trade-operations assistant. Revise the given business email according to the user's instruction.
Rules:
- Keep ALL factual content (numbers, document names, values) EXACTLY unchanged unless the instruction explicitly says otherwise.
- Do not add new claims or commitments.
- Output JSON {"subject": "...", "body": "..."} only.`,
      `Instruction: ${instruction}\n\n--- Current email ---\nSubject: ${draft.subject}\n\n${draft.body}`
    );
    await prisma.communicationDraft.update({
      where: { id: draftId },
      data: { subject: refined.subject, body: refined.body, status: "DRAFT" },
    });
    await recordEvent(
      draft.shipmentId,
      "DRAFT_REFINED",
      ACTOR,
      `AIに草案修正を指示: ${instruction}`
    );
    refresh(draft.shipmentId);
    return { ok: true, message: "修正しました。", subject: refined.subject, body: refined.body };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "AI修正に失敗しました。" };
  }
}

/** 手動編集した草案の保存 */
export async function updateDraftAction(
  draftId: string,
  subject: string,
  body: string
): Promise<void> {
  const draft = await prisma.communicationDraft.update({
    where: { id: draftId },
    data: { subject, body, status: "DRAFT" },
  });
  await recordEvent(draft.shipmentId, "DRAFT_EDITED", ACTOR, `草案を手動編集: ${subject}`);
  refresh(draft.shipmentId);
}

/** Gmail経由で草案を送信する（人間の明示操作からのみ呼ばれる） */
export async function sendDraftViaGmailAction(
  draftId: string,
  to: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      return { ok: false, message: "宛先メールアドレスが正しくありません。" };
    }
    const draft = await prisma.communicationDraft.findUniqueOrThrow({ where: { id: draftId } });
    const { sendEmail } = await import("@/lib/google");
    await sendEmail(to.trim(), subject, body);
    await prisma.communicationDraft.update({
      where: { id: draftId },
      data: { subject, body, status: "SENT" },
    });
    await prisma.approvalRequest.updateMany({
      where: { shipmentId: draft.shipmentId, approvalType: "COMMUNICATION_DRAFT", status: "PENDING" },
      data: { status: "APPROVED", reviewedBy: ACTOR, reviewedAt: new Date() },
    });
    await recordEvent(
      draft.shipmentId,
      "EMAIL_SENT",
      ACTOR,
      `Gmailで送信: ${subject} → ${to.trim()}`
    );
    if (draft.recipientType === "SUPPLIER") {
      const s = await prisma.shipment.findUniqueOrThrow({ where: { id: draft.shipmentId } });
      if (s.status === "NEEDS_REVIEW") {
        await transitionShipment(draft.shipmentId, "WAITING_FOR_SUPPLIER", ACTOR, "輸出者へ確認依頼を送信。回答待ち。");
      }
    }
    refresh(draft.shipmentId);
    return { ok: true, message: `${to.trim()} へ送信しました。` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "送信に失敗しました。" };
  }
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
