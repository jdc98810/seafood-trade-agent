import OpenAI from "openai";
import { z } from "zod";

// OpenAI互換エンドポイントなら何でも使える薄いラッパー。
// DeepSeek / GLM / Qwen / gpt-4o-mini などを env で切り替える。

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY || !process.env.LLM_MODEL) {
    throw new Error(
      "LLM_BASE_URL / LLM_API_KEY / LLM_MODEL が未設定です。.env を設定するか DEMO_MODE=true で実行してください。"
    );
  }
  if (!client) {
    client = new OpenAI({
      baseURL: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
    });
  }
  return client;
}

function extractJson(text: string): string {
  // モデルが ```json フェンスや前置きを付けても最初のJSONブロックを取り出す
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.search(/[{[]/);
  if (start >= 0) return text.slice(start).trim();
  return text.trim();
}

/**
 * JSON強制出力 + Zod検証。失敗時は1回だけ再試行し、それでも失敗なら例外。
 * 呼び出し側は失敗を「抽出失敗・人間確認待ち」として扱う（値の推測はしない）。
 */
export async function completeJSON<T>(
  schema: z.ZodType<T>,
  systemPrompt: string,
  userContent: string
): Promise<T> {
  const c = getClient();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await c.chat.completions.create({
      model: process.env.LLM_MODEL!,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            systemPrompt +
            "\n\nRespond with a single valid JSON object only. No prose, no markdown fences.",
        },
        { role: "user", content: userContent },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(extractJson(raw));
      return schema.parse(parsed);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`LLM出力のJSON検証に失敗しました: ${String(lastError)}`);
}
