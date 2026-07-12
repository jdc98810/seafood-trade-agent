"use client";

// 承認・修正・エスカレーション等の操作ボタン群（すべて人間の明示操作）

import { useState, useTransition } from "react";
import {
  acceptIssueAction,
  approveDraftAction,
  approveQuarantinePackageAction,
  confirmFieldAction,
  correctFieldAction,
  escalateIssueAction,
  generateSupplierEmailAction,
  proceedToQuarantineAction,
  rejectDraftAction,
  resolveApprovalAction,
  resumeFromEscalationAction,
} from "@/lib/actions";

const btn =
  "rounded px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors cursor-pointer";

export function FieldActions({ fieldId, current }: { fieldId: string; current: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex gap-1">
      <button
        disabled={pending}
        className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}
        onClick={() => startTransition(() => confirmFieldAction(fieldId))}
      >
        確認
      </button>
      <button
        disabled={pending}
        className={`${btn} bg-slate-200 text-slate-800 hover:bg-slate-300`}
        onClick={() => {
          const v = window.prompt("修正後の値を入力してください:", current ?? "");
          if (v != null && v.trim() !== "") {
            startTransition(() => correctFieldAction(fieldId, v.trim()));
          }
        }}
      >
        修正
      </button>
    </span>
  );
}

export function IssueActions({ issueId }: { issueId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex gap-1">
      <button
        disabled={pending}
        className={`${btn} bg-slate-200 text-slate-800 hover:bg-slate-300`}
        onClick={() => {
          if (window.confirm("この差異を受容し、問題を解消済みとして扱いますか？")) {
            startTransition(() => acceptIssueAction(issueId));
          }
        }}
      >
        差異を受容
      </button>
      <button
        disabled={pending}
        className={`${btn} bg-red-700 text-white hover:bg-red-600`}
        onClick={() => {
          if (window.confirm("専門担当者へエスカレーションしますか？（案件は停止状態になります）")) {
            startTransition(() => escalateIssueAction(issueId));
          }
        }}
      >
        エスカレーション
      </button>
    </span>
  );
}

export function DraftActions({ draftId }: { draftId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex gap-1">
      <button
        disabled={pending}
        className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}
        onClick={() => startTransition(() => approveDraftAction(draftId))}
      >
        承認
      </button>
      <button
        disabled={pending}
        className={`${btn} bg-slate-200 text-slate-800 hover:bg-slate-300`}
        onClick={() => startTransition(() => rejectDraftAction(draftId))}
      >
        却下
      </button>
    </span>
  );
}

export function GenerateEmailButton({ shipmentId }: { shipmentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      className={`${btn} bg-blue-700 text-white hover:bg-blue-600`}
      onClick={() => startTransition(() => generateSupplierEmailAction(shipmentId))}
    >
      {pending ? "作成中…" : "輸出者向け確認メール草案を作成"}
    </button>
  );
}

export function ProceedToQuarantineButton({ shipmentId }: { shipmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        disabled={pending}
        className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}
        onClick={() =>
          startTransition(async () => {
            const r = await proceedToQuarantineAction(shipmentId);
            setMessage(r.message);
          })
        }
      >
        検疫提出準備へ進める
      </button>
      {message && <span className="text-xs text-slate-600">{message}</span>}
    </span>
  );
}

export function ApproveQuarantineButton({ shipmentId }: { shipmentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}
      onClick={() => startTransition(() => approveQuarantinePackageAction(shipmentId))}
    >
      検疫提出資料を承認する
    </button>
  );
}

export function ResumeButton({ shipmentId }: { shipmentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      className={`${btn} bg-slate-700 text-white hover:bg-slate-600`}
      onClick={() => startTransition(() => resumeFromEscalationAction(shipmentId))}
    >
      エスカレーション対応完了（確認へ戻す）
    </button>
  );
}

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex gap-1">
      <button
        disabled={pending}
        className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}
        onClick={() => startTransition(() => resolveApprovalAction(approvalId, "APPROVED"))}
      >
        承認
      </button>
      <button
        disabled={pending}
        className={`${btn} bg-red-700 text-white hover:bg-red-600`}
        onClick={() => startTransition(() => resolveApprovalAction(approvalId, "ESCALATED"))}
      >
        エスカレーション
      </button>
    </span>
  );
}
