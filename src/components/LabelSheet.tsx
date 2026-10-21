"use client";

import QrCode from "@/components/QrCode";

export type LabelEntry = {
  id: string;
  path: string; // site-relative path the QR points to
  title: string;
  subtitle?: string | null;
};

export default function LabelSheet({
  entries,
  hint,
}: {
  entries: LabelEntry[];
  hint?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">
          {hint ??
            `${entries.length} label${entries.length === 1 ? "" : "s"}.`}
        </p>
        <button
          onClick={() => window.print()}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Print
        </button>
      </div>

      <div className="label-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map((e) => (
          <div
            key={e.id}
            className="label-item flex break-inside-avoid flex-col items-center gap-1 rounded-lg border border-slate-300 p-2 text-center"
          >
            <QrCode value={e.path} size={104} className="label-qr" />
            <p className="label-title mt-1 w-full truncate text-xs font-semibold text-slate-900">
              {e.title}
            </p>
            {e.subtitle && (
              <p className="label-owner w-full text-[8px] font-medium uppercase tracking-wide text-slate-500">
                {e.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
