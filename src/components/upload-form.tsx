"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumentAction } from "@/lib/actions";

// ドラッグ＆ドロップ対応の書類アップロード
export function UploadForm({ shipmentId }: { shipmentId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function addFiles(list: FileList | File[]) {
    const pdfs = [...list].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const rejected = [...list].length - pdfs.length;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))];
    });
    setMessage(rejected > 0 ? "PDF以外のファイルは追加されませんでした。" : null);
    setOk(rejected === 0);
  }

  function submit() {
    if (files.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const result = await uploadDocumentAction(shipmentId, fd);
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) {
        setFiles([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {/* ドロップゾーン */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-6 text-center transition-colors ${
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
        }`}
      >
        <span className="text-2xl">📄</span>
        <p className="mt-1 text-xs font-medium text-slate-700">
          ここにPDFをドラッグ＆ドロップ
        </p>
        <p className="text-[11px] text-slate-400">またはクリックして選択（複数可・20MBまで）</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* 選択済みファイル */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs"
            >
              <span className="flex-1 truncate" title={f.name}>
                {f.name}
              </span>
              <span className="text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                className="text-slate-400 hover:text-red-600"
                onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}
                aria-label={`${f.name} を取り除く`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={pending || files.length === 0}
        onClick={submit}
        className="w-full rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-40"
      >
        {pending ? "抽出・検証中…（1書類あたり10〜30秒）" : `アップロードして抽出${files.length > 0 ? `（${files.length}件）` : ""}`}
      </button>
      {message && (
        <p className={`text-xs ${ok ? "text-emerald-700" : "text-red-700"}`}>{message}</p>
      )}
    </div>
  );
}
