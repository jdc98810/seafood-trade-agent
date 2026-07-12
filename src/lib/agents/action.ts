// Action Agent（仕様書§7.7）
// 修正依頼メール等の草案を作る。承認されるまで送信されない（そもそも送信機能を持たない）。
// DEMO_MODE では決定論的テンプレートで生成し、LLMモードでは文面を整えさせる。

import { z } from "zod";
import type { IssueType, SourceValue } from "@/lib/domain";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/domain";
import { completeJSON, isDemoMode } from "@/lib/llm/provider";

export interface IssueForDraft {
  issueType: IssueType;
  fieldName: string | null;
  description: string;
  sourceValues: SourceValue[];
  recommendedAction: string | null;
}

export interface DraftInput {
  shipmentId: string;
  exporterName: string;
  issues: IssueForDraft[];
}

export interface EmailDraft {
  language: string;
  recipientType: "SUPPLIER";
  subject: string;
  body: string;
}

const FIELD_LABELS_EN: Record<string, string> = {
  netWeightKg: "Net Weight",
  grossWeightKg: "Gross Weight",
  quantity: "Quantity",
  packageCount: "Number of packages",
  containerNo: "Container No.",
  sealNo: "Seal No.",
  originCountry: "Country of Origin",
  productName: "Product name",
  invoiceNo: "Invoice No.",
  totalAmount: "Total amount",
};

function docLabelEn(t: string): string {
  return DOCUMENT_TYPE_LABELS[t as DocumentType] ?? t;
}

/** 決定論的テンプレート（DEMO_MODE / LLM失敗時のフォールバック） */
export function buildSupplierEmailTemplate(input: DraftInput): EmailDraft {
  const points: string[] = [];
  let n = 1;
  for (const issue of input.issues) {
    if (issue.issueType === "MISMATCH") {
      const label = FIELD_LABELS_EN[issue.fieldName ?? ""] ?? issue.fieldName ?? "value";
      const lines = issue.sourceValues
        .filter((s) => s.value != null)
        .map((s) => `- ${docLabelEn(s.documentType)}: ${s.value}`)
        .join("\n");
      points.push(`${n}. ${label} differs between the documents:\n${lines}`);
    } else if (issue.issueType === "MISSING_DOCUMENT") {
      const m = issue.description.match(/^(.+?) が未受領/);
      const doc = m ? m[1] : "A required document";
      points.push(`${n}. ${doc} has not yet been received.`);
    } else if (issue.issueType === "MISSING_FIELD") {
      const label = FIELD_LABELS_EN[issue.fieldName ?? ""] ?? issue.fieldName ?? "a required field";
      const docType = issue.sourceValues[0]?.documentType;
      points.push(
        `${n}. ${label} is not shown on the ${docType ? docLabelEn(docType) : "document"}.`
      );
    } else {
      points.push(`${n}. ${issue.description}`);
    }
    n++;
  }

  const body = `Dear ${input.exporterName} Team,

During our pre-submission document review for shipment ${input.shipmentId}, we found the following points:

${points.join("\n\n")}

Could you please confirm the correct information and provide the revised or missing documents at your earliest convenience?

Best regards,
Import Documentation Team`;

  return {
    language: "en",
    recipientType: "SUPPLIER",
    subject: `Request for document confirmation / ${input.shipmentId}`,
    body,
  };
}

const emailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export async function generateSupplierEmail(input: DraftInput): Promise<EmailDraft> {
  const template = buildSupplierEmailTemplate(input);
  if (isDemoMode()) return template;

  try {
    const refined = await completeJSON(
      emailSchema,
      `You are a professional trade-operations assistant. Rewrite the given draft email to a seafood exporter so it is polite, concise, business-appropriate English. Keep ALL factual points (values, document names, numbering) exactly as given. Do not add new claims. Output JSON {"subject": "...", "body": "..."}.`,
      `Subject: ${template.subject}\n\n${template.body}`
    );
    return { ...template, subject: refined.subject, body: refined.body };
  } catch {
    return template; // LLM失敗時はテンプレートで代替（送信はどのみち人間承認後）
  }
}
