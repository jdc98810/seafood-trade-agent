import { Sidebar } from "@/components/sidebar";

// アプリ画面共通レイアウト: 左サイドバー + コンテンツ領域
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden bg-[#f5f7fa] px-8 py-7">{children}</main>
    </div>
  );
}
