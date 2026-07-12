// Document Understanding Agent（仕様書§7.3）
// PDFテキスト → 書類分類 + 項目抽出（根拠付き）。
// DEMO_MODE では fixtures/ の抽出結果を返す（APIキー不要）。
// 不明な値を推測して埋めない: 見つからないフィールドは出力しない/nullにする。

import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import {
  DOCUMENT_TYPES,
  FIELD_NAMES,
  type DocumentType,
  type ExtractionResult,
} from "@/lib/domain";
import { completeJSON, isDemoMode } from "@/lib/llm/provider";
import { classifyByFileName } from "./intake";

const extractionSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  fields: z.array(
    z.object({
      fieldName: z.enum(FIELD_NAMES),
      originalValue: z.string().nullable(),
      pageNumber: z.number().int().nullable(),
      evidenceText: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const SYSTEM_PROMPT = `You are a trade-document extraction engine for seafood import operations.
You receive the plain text of ONE trade document. Page boundaries are marked as [PAGE n].

Tasks:
1. Classify the document as one of: ${DOCUMENT_TYPES.join(", ")}.
2. Extract only the fields listed below that actually appear in the text.

Field names: ${FIELD_NAMES.join(", ")}

Strict rules:
- NEVER guess or infer a value that is not written in the text. Omit fields that are not present.
- originalValue must be copied verbatim from the text (including units like "kg").
- evidenceText must be the exact line or phrase the value came from.
- pageNumber is the [PAGE n] the evidence appears on.
- confidence is 0..1: 0.95+ only when the label and value are unambiguous.

Output JSON: {"documentType": "...", "fields": [{"fieldName": "...", "originalValue": "...", "pageNumber": 1, "evidenceText": "...", "confidence": 0.97}]}`;

async function loadFixture(
  documentType: DocumentType,
  fileName: string
): Promise<ExtractionResult | null> {
  // デモ用: ファイル名に revised / corrected 等が含まれる場合は修正版fixtureを優先する
  const isRevised = /revised|corrected|rev\d|v2|修正/i.test(fileName);
  const candidates = isRevised
    ? [`${documentType}_REVISED.json`, `${documentType}.json`]
    : [`${documentType}.json`];
  for (const name of candidates) {
    try {
      const p = path.join(process.cwd(), "fixtures", "extraction", name);
      const raw = await fs.readFile(p, "utf-8");
      return extractionSchema.parse(JSON.parse(raw)) as ExtractionResult;
    } catch {
      // 次の候補へ
    }
  }
  return null;
}

/** PDFからページ区切り付きテキストを取り出す */
export async function pdfToText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((pageText, i) => `[PAGE ${i + 1}]\n${pageText}`).join("\n\n");
}

/**
 * 1書類の抽出。DEMO_MODE ではファイル名から種別を決めて fixture を返す。
 * LLMモードでは分類も抽出もモデルに任せ、Zodで検証する。
 */
export async function extractDocument(
  fileName: string,
  pdfBuffer: Buffer | null
): Promise<ExtractionResult> {
  if (isDemoMode()) {
    const type = classifyByFileName(fileName) ?? "OTHER";
    if (type !== "OTHER") {
      const fixture = await loadFixture(type, fileName);
      if (fixture) return fixture;
    }
    return { documentType: type, fields: [] };
  }

  if (!pdfBuffer) throw new Error("PDFデータがありません。");
  const text = await pdfToText(pdfBuffer);
  if (text.trim().length < 20) {
    throw new Error(
      "PDFからテキストを抽出できませんでした（スキャン画像のPDFはMVP対象外です）。"
    );
  }
  return (await completeJSON(extractionSchema, SYSTEM_PROMPT, text)) as ExtractionResult;
}
