// Gmail連携（OAuth 2.0 + Gmail REST API）。
// 必要なenv: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / (任意) GOOGLE_REDIRECT_URI
// スコープは読み取りと送信のみ。送信は必ず人間のUI操作から実行される。

import { prisma } from "@/lib/db";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/google/callback";
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeAndStore(code: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Googleトークン交換に失敗: ${await res.text()}`);
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  let email: string | null = null;
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (u.ok) email = ((await u.json()) as { email?: string }).email ?? null;
  } catch {
    // email取得は必須ではない
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
  await prisma.googleAccount.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
    },
    update: {
      email,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
    },
  });
}

export async function getConnection(): Promise<{ connected: boolean; email: string | null }> {
  const acc = await prisma.googleAccount.findUnique({ where: { id: "default" } });
  return { connected: Boolean(acc), email: acc?.email ?? null };
}

export async function disconnectGoogle(): Promise<void> {
  await prisma.googleAccount.deleteMany({ where: { id: "default" } });
}

async function getAccessToken(): Promise<string> {
  const acc = await prisma.googleAccount.findUnique({ where: { id: "default" } });
  if (!acc) throw new Error("Gmailが接続されていません。");
  if (acc.expiresAt > new Date()) return acc.accessToken;

  if (!acc.refreshToken) throw new Error("トークンの有効期限が切れました。再ログインしてください。");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: acc.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("トークン更新に失敗しました。再ログインしてください。");
  const t = (await res.json()) as { access_token: string; expires_in: number };
  await prisma.googleAccount.update({
    where: { id: "default" },
    data: {
      accessToken: t.access_token,
      expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
    },
  });
  return t.access_token;
}

async function gmailGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail APIエラー (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

export interface GmailMessageSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export async function listMessages(query: string): Promise<GmailMessageSummary[]> {
  const q = query.trim() || "has:attachment";
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `messages?maxResults=15&q=${encodeURIComponent(q)}`
  );
  const ids = list.messages ?? [];
  const out: GmailMessageSummary[] = [];
  for (const { id } of ids) {
    const m = await gmailGet<{
      snippet: string;
      payload: { headers: { name: string; value: string }[] };
    }>(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    const h = (name: string) =>
      m.payload.headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    out.push({ id, from: h("From"), subject: h("Subject"), date: h("Date"), snippet: m.snippet });
  }
  return out;
}

export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText: string;
  attachments: GmailAttachment[];
}

interface GmailPart {
  mimeType: string;
  filename?: string;
  body: { data?: string; attachmentId?: string; size: number };
  parts?: GmailPart[];
}

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function walkParts(part: GmailPart, acc: { text: string[]; attachments: GmailAttachment[] }) {
  if (part.filename && part.body.attachmentId) {
    acc.attachments.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType: part.mimeType,
      size: part.body.size,
    });
  } else if (part.mimeType === "text/plain" && part.body.data) {
    acc.text.push(decodeB64Url(part.body.data));
  }
  for (const p of part.parts ?? []) walkParts(p, acc);
}

export async function getMessage(id: string): Promise<GmailMessageDetail> {
  const m = await gmailGet<{
    snippet: string;
    payload: GmailPart & { headers: { name: string; value: string }[] };
  }>(`messages/${id}?format=full`);
  const h = (name: string) =>
    m.payload.headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const acc = { text: [] as string[], attachments: [] as GmailAttachment[] };
  walkParts(m.payload, acc);
  return {
    id,
    from: h("From"),
    subject: h("Subject"),
    date: h("Date"),
    snippet: m.snippet,
    bodyText: acc.text.join("\n").slice(0, 5000),
    attachments: acc.attachments,
  };
}

export async function getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
  const a = await gmailGet<{ data: string }>(
    `messages/${messageId}/attachments/${attachmentId}`
  );
  return Buffer.from(a.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** メール送信（RFC 2822 を組み立てて users.messages.send へ） */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const token = await getAccessToken();
  const encSubject = `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
  const mime = [
    `To: ${to}`,
    `Subject: ${encSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf-8").toString("base64"),
  ].join("\r\n");
  const raw = Buffer.from(mime, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`送信に失敗しました (${res.status}): ${await res.text()}`);
}
