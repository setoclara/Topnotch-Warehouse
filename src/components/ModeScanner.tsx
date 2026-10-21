"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { applyScan } from "@/app/actions";

const READER_ID = "mode-qr-reader";

type Opt = { id: string; name: string };
type Mode = "receive" | "pack" | "load";
type Result = { ok: boolean; message: string; assignHref?: string };

export default function ModeScanner({
  tournaments,
  trucks,
}: {
  tournaments: Opt[];
  trucks: Opt[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<"setup" | "scanning">("setup");
  const [phase, setPhase] = useState<"camera" | "result">("camera");
  const [mode, setMode] = useState<Mode | "">("");
  const [context, setContext] = useState(""); // warehouse | tournamentId | truckId
  const [result, setResult] = useState<Result | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  // keep latest mode/context for the scan callback
  const cfg = useRef({ mode, context });
  useEffect(() => {
    cfg.current = { mode, context };
  }, [mode, context]);

  const ready =
    mode === "pack" || (mode === "receive" && context) || (mode === "load" && context);

  function contextLabel() {
    if (mode === "pack") return "Packing";
    if (mode === "receive")
      return context === "warehouse"
        ? "Receiving → Warehouse"
        : `Receiving → ${tournaments.find((t) => t.id === context)?.name ?? ""}`;
    if (mode === "load")
      return `Loading → ${trucks.find((t) => t.id === context)?.name ?? ""}`;
    return "";
  }

  async function stopScanner() {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        // ignore
      }
      try {
        s.clear();
      } catch {
        // ignore
      }
    }
  }

  // Run the camera only while we're on the "camera" phase of scanning.
  useEffect(() => {
    if (step !== "scanning" || phase !== "camera") return;
    let cancelled = false;
    busyRef.current = false;
    async function start() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        if (cancelled) return;
        const scanner = new Html5Qrcode(READER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            // Large, adaptive scan box so aim is forgiving.
            qrbox: (w: number, h: number) => {
              const size = Math.floor(Math.min(w, h) * 0.8);
              return { width: size, height: size };
            },
            aspectRatio: 1,
            disableFlip: true,
          },
          (decoded) => {
            if (busyRef.current) return;
            busyRef.current = true;
            const { mode: m, context: c } = cfg.current;
            // Stop the camera first, then show the confirmation screen.
            stopScanner().then(() =>
              applyScan(decoded, m as string, c)
                .then((res) => {
                  setResult(res);
                  setPhase("result");
                  router.refresh();
                })
                .catch(() => {
                  setResult({ ok: false, message: "Scan failed. Try again." });
                  setPhase("result");
                })
            );
          },
          () => {}
        );
      } catch {
        setCamError("Couldn't start the camera. Grant camera permission.");
      }
    }
    start();
    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [step, phase, router]);

  // ---------- Setup step ----------
  if (step === "setup") {
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            What are you doing?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["receive", "Receiving"],
                ["pack", "Packing"],
                ["load", "Loading"],
              ] as [Mode, string][]
            ).map(([m, labelText]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setContext("");
                }}
                className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                  mode === m
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {labelText}
              </button>
            ))}
          </div>
        </div>

        {mode === "receive" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Where are you receiving these?
            </label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">Select a location…</option>
              <option value="warehouse">Warehouse (check in)</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === "load" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Which truck?
            </label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">Select a truck…</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {trucks.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                No trucks yet — add one from Tracking → +.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setResult(null);
            setCamError(null);
            setPhase("camera");
            setStep("scanning");
          }}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Start scanning
        </button>
      </div>
    );
  }

  // ---------- Result screen (full confirmation after each scan) ----------
  if (phase === "result" && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
          <span>{contextLabel()}</span>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setStep("setup");
            }}
            className="rounded-md bg-white/15 px-2 py-1 text-xs hover:bg-white/25"
          >
            Change mode
          </button>
        </div>

        <div
          className={`flex flex-col items-center gap-3 rounded-2xl border p-8 text-center ${
            result.ok
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full ${
              result.ok ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {result.ok ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            )}
          </div>
          <p
            className={`text-lg font-semibold ${
              result.ok ? "text-emerald-800" : "text-red-700"
            }`}
          >
            {result.message}
          </p>
          {result.assignHref && (
            <Link
              href={result.assignHref}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Assign this tag to a box or item →
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setResult(null);
            setCamError(null);
            setPhase("camera");
          }}
          className="w-full rounded-lg bg-slate-900 px-4 py-4 text-base font-semibold text-white hover:bg-slate-700"
        >
          Scan next item
        </button>
      </div>
    );
  }

  // ---------- Camera phase ----------
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
        <span>{contextLabel()}</span>
        <button
          type="button"
          onClick={async () => {
            await stopScanner();
            setResult(null);
            setStep("setup");
          }}
          className="rounded-md bg-white/15 px-2 py-1 text-xs hover:bg-white/25"
        >
          Change mode
        </button>
      </div>

      <div
        id={READER_ID}
        className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-black"
      />

      {camError && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          {camError}
        </p>
      )}

      <p className="text-center text-sm text-slate-500">
        Point the camera at an item&apos;s QR label.
      </p>
    </div>
  );
}
