import Link from "next/link";
import { getReviewQueue } from "@/lib/queries";
import { SeverityBadge } from "@/components/badges";
import { ApprovalActions, IssueActions } from "@/components/action-buttons";
import { ISSUE_TYPE_LABELS_JA, type IssueType } from "@/lib/domain";

export const dynamic = "force-dynamic";

// 人間確認センター（仕様書§6.5）: 判断が必要なものだけを優先度順に提示する
export default async function ReviewPage() {
  const { approvals, issues } = await getReviewQueue();

  const high = issues.filter((i) => i.severity === "RED");
  const normal = issues.filter((i) => i.severity === "YELLOW");
  const low = issues.filter((i) => i.severity === "GREEN");
  const total = approvals.length + issues.length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">人間確認センター</h1>
      <p className="text-sm text-slate-600">
        確認が必要な項目: <span className="font-bold">{total}件</span>
        （問題 {issues.length}件 / 承認待ち {approvals.length}件）
      </p>

      {[
        { title: "高優先度（要エスカレーション判断）", list: high },
        { title: "通常", list: normal },
        { title: "低リスク", list: low },
      ].map(
        (group) =>
          group.list.length > 0 && (
            <section key={group.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-bold">{group.title}</h2>
              <ul className="space-y-2">
                {group.list.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-100 p-2 text-sm">
                    <SeverityBadge severity={i.severity} />
                    <Link href={`/shipments/${i.shipmentId}`} className="font-semibold text-blue-700 hover:underline">
                      {i.shipmentId}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {ISSUE_TYPE_LABELS_JA[i.issueType as IssueType] ?? i.issueType}
                    </span>
                    <span className="flex-1">{i.description}</span>
                    <IssueActions issueId={i.id} />
                  </li>
                ))}
              </ul>
            </section>
          )
      )}

      {approvals.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold">承認待ち</h2>
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-100 p-2 text-sm">
                <Link href={`/shipments/${a.shipmentId}`} className="font-semibold text-blue-700 hover:underline">
                  {a.shipmentId}
                </Link>
                <span className="flex-1">{a.title}</span>
                <ApprovalActions approvalId={a.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {total === 0 && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ 現在、人間の判断が必要な項目はありません。
        </p>
      )}
    </div>
  );
}
