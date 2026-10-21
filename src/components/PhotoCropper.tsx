"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg, type Area } from "@/lib/cropImage";

export default function PhotoCropper({
  imageSrc,
  onCancel,
  onDone,
}: {
  imageSrc: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  async function apply() {
    if (!areaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedImg(imageSrc, areaPixels, rotation);
      onDone(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-hidden rounded-2xl bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Adjust photo</h2>
          <p className="text-xs text-slate-500">
            Drag to reposition · pinch or use the slider to zoom
          </p>
        </div>

        <div className="relative flex-1 bg-slate-900" style={{ minHeight: 260 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid={true}
          />
        </div>

        <div className="space-y-3 px-4 py-3">
          <label className="flex items-center gap-3 text-sm text-slate-600">
            <span className="w-12 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-slate-900"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Rotate 90°
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={busy || !areaPixels}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {busy ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
