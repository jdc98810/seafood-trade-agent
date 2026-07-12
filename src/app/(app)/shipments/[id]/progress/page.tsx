import Link from "next/link";
import { notFound } from "next/navigation";
import { getShipmentDetail } from "@/lib/queries";
import {
  PROGRESS_STEPS,
  progressStepIndex,
  isWorkflowState,
  STATE_LABELS_JA,
} from "@/lib/workflow/state-machine";
import { StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

// 進捗画面（仕様書§6.4）+ Audit Log（WorkflowEventタイムライン）
export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await getShipmentDetail(id);
  if (!shipment) notFound();

  const currentStep = isWorkflowState(shipment.status)
    ? progressStepIndex(shipment.status)
    : 0;
  const escalated = shipment.status === "ESCALATED";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">進捗・監査ログ — {shipment.id}</h1>
        <StatusBadge status={shipment.status} />
        <Link href={`/shipments/${shipment.id}`} className="ml-auto text-sm text-blue-700 hover:underline">
          ← 詳細へ戻る
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold">ワークフロー進捗</h2>
          {escalated && (
            <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">
              この案件はエスカレーション中です。専門担当者の対応後に再開されます。
            </p>
          )}
          <ol className="space-y-1.5">
            {PROGRESS_STEPS.map((step, i) => {
              const state = escalated ? "pending" : i < currentStep ? "done" : i === currentStep ? "current" : "pending";
              return (
                <li key={step.label} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-right text-xs tabular-nums text-slate-400">{i + 1}.</span>
                  <span>
                    {state === "done" ? "✅" : state === "current" ? "🔵" : "⬜"}
                  </span>
                  <span className={state === "current" ? "font-bold" : state === "pending" ? "text-slate-400" : ""}>
                    {step.label}
                  </span>
                  {state === "current" && isWorkflowState(shipment.status) && (
                    <span className="text-xs text-slate-500">（{STATE_LABELS_JA[shipment.status]}）</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold">Audit Log（{shipment.events.length}件）</h2>
          <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {shipment.events.map((e) => (
              <li key={e.id} className="rounded border border-slate-100 p-2 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="tabular-nums">
                    {e.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </span>
                  <span
                    className={`rounded px-1 font-medium ${
                      e.actor === "agent" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {e.actor === "agent" ? "AI Agent" : e.actor}
                  </span>
                </div>
                <div className="mt-0.5">
                  {e.fromState && isWorkflowState(e.fromState) && isWorkflowState(e.toState) ? (
                    <span className="font-medium">
                      {STATE_LABELS_JA[e.fromState]} → {STATE_LABELS_JA[e.toState]}
                    </span>
                  ) : (
                    <span className="font-medium">{e.toState}</span>
                  )}
                </div>
                {e.reason && <div className="text-slate-600">{e.reason}</div>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
