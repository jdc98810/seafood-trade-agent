"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📋" },
  { href: "/review", label: "人間確認センター", icon: "✅" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-[#0b1f3a] text-slate-200">
      <Link href="/" className="flex items-center gap-2 px-5 py-5">
        <span className="text-2xl">🐟</span>
        <span className="text-sm font-bold leading-tight text-white">
          水産物貿易
          <br />
          書類確認AI Agent
        </span>
      </Link>

      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/dashboard" && pathname.startsWith("/shipments"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-blue-600 font-semibold text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 px-5 py-5 text-[11px] leading-relaxed text-slate-400">
        <p className="rounded-lg bg-white/5 p-3">
          Human-in-the-loop
          <br />
          外部送信・行政申請は行いません。重要な操作はすべて人間が承認します。
        </p>
        <Link href="/" className="block hover:text-white">
          ← 製品ホームへ
        </Link>
      </div>
    </aside>
  );
}
