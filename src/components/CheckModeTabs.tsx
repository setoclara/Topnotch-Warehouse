"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export default function CheckModeTabs({
  checkout,
  checkin,
  status,
  initialMode = "out",
}: {
  checkout: ReactNode;
  checkin: ReactNode;
  status?: ReactNode;
  initialMode?: "out" | "in" | "status";
}) {
  const [mode, setMode] = useState<"out" | "in" | "status">(initialMode);

  const tabCls = (active: boolean, activeColor: string) =>
    `rounded-md px-3 py-2 font-medium transition ${
      active ? activeColor : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="space-y-4">
      <div
        className={`grid ${
          status ? "grid-cols-3" : "grid-cols-2"
        } rounded-lg border border-slate-200 bg-white p-0.5 text-sm`}
      >
        <button
          type="button"
          onClick={() => setMode("out")}
          className={tabCls(mode === "out", "bg-slate-900 text-white")}
        >
          Check out
        </button>
        <button
          type="button"
          onClick={() => setMode("in")}
          className={tabCls(mode === "in", "bg-emerald-600 text-white")}
        >
          Check in
        </button>
        {status && (
          <button
            type="button"
            onClick={() => setMode("status")}
            className={tabCls(mode === "status", "bg-indigo-600 text-white")}
          >
            Status
          </button>
        )}
      </div>

      {mode === "out" ? checkout : mode === "in" ? checkin : status}
    </div>
  );
}
