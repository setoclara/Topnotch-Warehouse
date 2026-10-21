"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const READER_ID = "qr-reader";

// Turn a scanned value (a full item URL, or a bare id) into an item path.
function toItemPath(text: string): string | null {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const m = url.pathname.match(/\/items\/([^/?#]+)/);
    if (m) return `/items/${m[1]}`;
  } catch {
    // not a URL
  }
  // Bare UUID fallback
  if (/^[0-9a-f-]{16,}$/i.test(trimmed)) return `/items/${trimmed}`;
  return null;
}

export default function Scanner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelled = false;
    let navigating = false;

    // Fully release the camera before we leave, or iOS Safari runs out of
    // memory and shows "This page couldn't load" on the next page.
    async function release() {
      const s = scanner;
      scanner = null;
      if (!s) return;
      try {
        await s.stop();
      } catch {
        // already stopped
      }
      try {
        s.clear();
      } catch {
        // ignore
      }
    }

    async function start() {
      if (startedRef.current) return;
      startedRef.current = true;
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        if (cancelled) return;
        scanner = new Html5Qrcode(READER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (w: number, h: number) => {
              const size = Math.floor(Math.min(w, h) * 0.8);
              return { width: size, height: size };
            },
            aspectRatio: 1,
            disableFlip: true,
          },
          (decodedText) => {
            if (navigating) return;
            const path = toItemPath(decodedText);
            if (path) {
              navigating = true;
              // Release the camera, THEN navigate.
              release().finally(() => router.push(path));
            }
          },
          () => {}
        );
      } catch {
        setError(
          "Couldn't start the camera. Grant camera permission, or type/paste the item code below."
        );
      }
    }
    start();

    return () => {
      cancelled = true;
      void release();
    };
  }, [router]);

  function goManual(e: React.FormEvent) {
    e.preventDefault();
    const path = toItemPath(manual);
    if (path) router.push(path);
    else setError("That doesn't look like a valid item code.");
  }

  return (
    <div className="space-y-4">
      <div
        id={READER_ID}
        className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-black"
      />

      {error && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          {error}
        </p>
      )}

      <p className="text-center text-sm text-slate-500">
        Point your camera at an item&apos;s QR label.
      </p>

      <form onSubmit={goManual} className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or paste an item code / link"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Go
        </button>
      </form>
    </div>
  );
}
