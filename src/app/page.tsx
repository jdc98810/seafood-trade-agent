import Link from "next/link";
import { getDashboardShipments } from "@/lib/queries";
import { StatusBadge, UrgencyBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const shipments = await getDashboardShipments();

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold">Shipment Dashboard</h1>
        <p className="text-xs text-slate-500">
          AIはバックグラウンドで整理・検証を行い、判断が必要な案件だけを提示します
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">緊急度</th>
              <th className="px-4 py-2">案件</th>
              <th className="px-4 py-2">商品</th>
              <th className="px-4 py-2">ETD / ETA</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">書類</th>
              <th className="px-4 py-2">問題</th>
              <th className="px-4 py-2">承認待ち</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => {
              const received = s.requiredDocuments.filter((r) => r.status === "RECEIVED").length;
              const openIssues = s.issues.length;
              return (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                  <td className="px-4 py-3">
                    <UrgencyBadge urgency={s.urgency} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/shipments/${s.id}`} className="font-semibold text-blue-700 hover:underline">
                      {s.id}
                    </Link>
                    <div className="text-xs text-slate-500">{s.route}</div>
                  </td>
                  <td className="px-4 py-3">{s.product}</td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                    {s.etd ? `ETD ${s.etd.toISOString().slice(0, 10)}` : "—"}
                    <br />
                    {s.eta ? `ETA ${s.eta.toISOString().slice(0, 10)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {s.requiredDocuments.length > 0
                      ? `${received} / ${s.requiredDocuments.length}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {openIssues > 0 ? (
                      <span className="font-semibold text-amber-700">⚠ {openIssues}件</span>
                    ) : (
                      <span className="text-emerald-700">✅ なし</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.approvalRequests.length > 0 ? (
                      <span className="font-semibold text-blue-700">{s.approvalRequests.length}件</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
