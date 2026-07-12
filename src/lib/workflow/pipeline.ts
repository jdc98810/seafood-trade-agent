// Workflow Orchestrator（仕様書§7.1）
// 書類受領 → 抽出 → 正規化 → 検証 → 状態遷移 を1本につなぐ。

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import type { FieldName } from "@/lib/domain";
import { classifyByFileName, isFinalByFileName } from "@/lib/agents/intake";
import { extractDocument } from "@/lib/agents/extraction";
import { normalizeField, parseDateISO } from "@/lib/agents/normalization";
import { validateShipment, type IssueDraft } from "@/lib/agents/validation";
import { isWorkflowState, canTransition, type WorkflowState } from "./state-machine";
import { transitionShipment } from "./service";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/** 現在状態から目標状態まで、白名单上の合法パスを順に辿る（各遷移を監査ログに残す） */
async function advanceTo(
  shipmentId: string,
  targets: WorkflowState[],
  actor: string,
  reason: string
): Promise<void> {
  for (const target of targets) {
    const s = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    if (!isWorkflowState(s.status)) return;
    if (s.status === target) continue;
    if (canTransition(s.status, target)) {
      await transitionShipment(shipmentId, target, actor, reason);
    }
  }
}

/**
 * 書類アップロード処理:
 * Intake（分類・版管理）→ 抽出 → 正規化 → 保存 → 再検証 → 状態遷移
 */
export async function processDocumentUpload(
  shipmentId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ documentId: string; documentType: string; fieldCount: number }> {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

  // 修正版受領の場合は状態を戻す
  if (shipment.status === "WAITING_FOR_SUPPLIER") {
    await transitionShipment(shipmentId, "CORRECTION_RECEIVED", "agent", `修正版書類を受領: ${fileName}`);
  }

  // ファイル保存
  const dir = path.join(UPLOAD_DIR, shipmentId);
  await fs.mkdir(dir, { recursive: true });
  const savedPath = path.join(dir, `${Date.now()}_${fileName}`);
  await fs.writeFile(savedPath, buffer);

  await advanceTo(
    shipmentId,
    ["DOCUMENTS_RECEIVED", "EXTRACTION_IN_PROGRESS"],
    "agent",
    `書類受領: ${fileName}`
  );

  // 抽出（DEMO_MODE: fixture / LLMモード: unpdf + LLM）
  const result = await extractDocument(fileName, buffer);

  // 版管理: 同種の既存有効版があれば非活性化して version+1
  const existing = await prisma.tradeDocument.findMany({
    where: { shipmentId, documentType: result.documentType, isActive: true },
  });
  const version = existing.length > 0 ? Math.max(...existing.map((d) => d.version)) + 1 : 1;
  if (existing.length > 0) {
    await prisma.tradeDocument.updateMany({
      where: { shipmentId, documentType: result.documentType, isActive: true },
      data: { isActive: false },
    });
  }

  const doc = await prisma.tradeDocument.create({
    data: {
      shipmentId,
      documentType: result.documentType,
      fileName,
      filePath: savedPath,
      version,
      isActive: true,
      isFinal: isFinalByFileName(fileName),
      extractionStatus: "COMPLETE",
      fields: {
        create: result.fields.map((f) => ({
          fieldName: f.fieldName,
          originalValue: f.originalValue,
          normalizedValue: normalizeField(f.fieldName as FieldName, f.originalValue),
          pageNumber: f.pageNumber,
          evidenceText: f.evidenceText,
          confidence: f.confidence,
        })),
      },
    },
  });

  // 必要書類チェックリストの更新
  await prisma.requiredDocument.updateMany({
    where: { shipmentId, documentType: result.documentType },
    data: { status: "RECEIVED" },
  });

  await advanceTo(
    shipmentId,
    ["EXTRACTION_COMPLETE", "NORMALIZATION_COMPLETE"],
    "agent",
    `${fileName} の抽出・正規化が完了（${result.fields.length}項目）`
  );

  await revalidateShipment(shipmentId, "agent");

  return {
    documentId: doc.id,
    documentType: result.documentType,
    fieldCount: result.fields.length,
  };
}

function issueKey(i: {
  issueType: string;
  fieldName: string | null;
  description: string;
}): string {
  return `${i.issueType}|${i.fieldName ?? ""}|${i.description}`;
}

/**
 * 再検証: 決定論的ルールを実行し、Issueを差分更新する。
 * - 再検出されなかった OPEN Issue → RESOLVED
 * - 新しく検出された問題 → OPEN で作成（既存の受容済み等は再作成しない）
 */
export async function revalidateShipment(shipmentId: string, actor: string): Promise<void> {
  await advanceTo(shipmentId, ["VALIDATION_IN_PROGRESS"], actor, "検証を開始");

  const shipment = await prisma.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    include: {
      documents: { where: { isActive: true }, include: { fields: true } },
      requiredDocuments: true,
      issues: true,
    },
  });

  const drafts: IssueDraft[] = validateShipment({
    requiredDocumentTypes: shipment.requiredDocuments.map((r) => r.documentType),
    documents: shipment.documents.map((d) => ({
      documentType: d.documentType,
      fields: d.fields.map((f) => ({
        fieldName: f.fieldName,
        // 人間が修正した値は修正後の値で検証する
        originalValue: f.reviewStatus === "CORRECTED" ? f.normalizedValue : f.originalValue,
      })),
    })),
    expectedEtd: shipment.etd ? shipment.etd.toISOString().slice(0, 10) : null,
    expectedEta: shipment.eta ? shipment.eta.toISOString().slice(0, 10) : null,
  });

  const freshKeys = new Set(drafts.map(issueKey));
  const existingByKey = new Map(shipment.issues.map((i) => [issueKey(i), i]));

  // 解消された OPEN Issue
  for (const issue of shipment.issues) {
    if (issue.status === "OPEN" && !freshKeys.has(issueKey(issue))) {
      await prisma.validationIssue.update({
        where: { id: issue.id },
        data: { status: "RESOLVED" },
      });
    }
  }

  // 新規 Issue（同一内容が既にあれば作らない: 受容済み・エスカレーション済みを尊重）
  for (const draft of drafts) {
    if (!existingByKey.has(issueKey(draft))) {
      await prisma.validationIssue.create({
        data: {
          shipmentId,
          issueType: draft.issueType,
          severity: draft.severity,
          fieldName: draft.fieldName,
          description: draft.description,
          sourceValues: JSON.stringify(draft.sourceValues),
          recommendedAction: draft.recommendedAction,
        },
      });
    }
  }

  const openCount = await prisma.validationIssue.count({
    where: { shipmentId, status: "OPEN", severity: { in: ["RED", "YELLOW"] } },
  });

  if (openCount > 0) {
    await advanceTo(
      shipmentId,
      ["NEEDS_REVIEW"],
      actor,
      `検証完了: 未解決の問題が ${openCount} 件あります`
    );
  } else {
    await advanceTo(
      shipmentId,
      ["NEEDS_REVIEW", "READY_FOR_QUARANTINE_PREPARATION"],
      actor,
      "検証完了: 重要な問題はありません"
    );
  }
}
