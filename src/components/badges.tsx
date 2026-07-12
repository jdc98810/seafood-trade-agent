import { SEVERITY_LABELS_JA, type Severity } from "@/lib/domain";
import { STATE_LABELS_JA, isWorkflowState } from "@/lib/workflow/state-machine";

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<Severity, string> = {
    RED: "bg-red-100 text-red-800 border-red-300",
    YELLOW: "bg-amber-100 text-amber-800 border-amber-300",
    GREEN: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };
  const s = (severity as Severity) in styles ? (severity as Severity) : "YELLOW";
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${styles[s]}`}>
      {SEVERITY_LABELS_JA[s]}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = isWorkflowState(status) ? STATE_LABELS_JA[status] : status;
  const color =
    status === "ESCALATED"
      ? "bg-red-100 text-red-800 border-red-300"
      : status === "NEEDS_REVIEW" || status.endsWith("APPROVAL_REQUIRED")
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : status === "IMPORT_PERMITTED" || status === "DELIVERED" || status === "ARCHIVED"
          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
          : "bg-slate-100 text-slate-700 border-slate-300";
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "HIGH")
    return <span className="inline-block rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">緊急</span>;
  if (urgency === "LOW")
    return <span className="inline-block rounded bg-slate-300 px-1.5 py-0.5 text-xs text-slate-700">低</span>;
  return <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">通常</span>;
}

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 95 ? "text-emerald-700" : pct >= 80 ? "text-amber-700" : "text-red-700";
  return <span className={`text-xs tabular-nums ${color}`}>信頼度 {pct}%</span>;
}
