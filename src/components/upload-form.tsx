"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumentAction } from "@/lib/actions";

export function UploadForm({ shipmentId }: { shipmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setMessage(null);
        startTransition(async () => {
          const result = await uploadDocumentAction(shipmentId, formData);
          setOk(result.ok);
          setMessage(result.message);
          if (result.ok) {
            formRef.current?.reset();
            router.refresh();
          }
        });
      }}
      className="space-y-2"
    >
      <input
        type="file"
        name="files"
        accept=".pdf"
        multiple
        required
        className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-white file:cursor-pointer hover:file:bg-slate-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
      >
        {pending ? "抽出・検証中…" : "アップロードして抽出"}
      </button>
      {message && (
        <p className={`text-xs ${ok ? "text-emerald-700" : "text-red-700"}`}>{message}</p>
      )}
    </form>
  );
}
