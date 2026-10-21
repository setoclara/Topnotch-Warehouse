"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncItemQuantityWithLabels } from "@/app/actions";
import PhotoCropper from "@/components/PhotoCropper";
import type { Item, ItemBin } from "@/lib/types";

type BinRow = { bin: string; quantity: number };

export default function ItemForm({
  item,
  bins,
  labelCode,
}: {
  item?: Item;
  bins?: ItemBin[];
  labelCode?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(item?.name ?? "");
  const [binRows, setBinRows] = useState<BinRow[]>(
    bins && bins.length > 0
      ? bins.map((b) => ({ bin: b.bin, quantity: b.quantity }))
      : [{ bin: "", quantity: 0 }]
  );
  const [description, setDescription] = useState(item?.description ?? "");
  const [totalQuantity, setTotalQuantity] = useState(item?.total_quantity ?? 1);

  function setBinRow(i: number, patch: Partial<BinRow>) {
    setBinRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    );
  }
  function addBinRow() {
    setBinRows((rows) => [...rows, { bin: "", quantity: 0 }]);
  }
  function removeBinRow(i: number) {
    setBinRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  // Merge duplicate bin names (summing counts) into the rows we'll save.
  function cleanedBins(): BinRow[] {
    const map = new Map<string, number>();
    for (const r of binRows) {
      const bin = r.bin.trim();
      if (!bin) continue;
      map.set(bin, (map.get(bin) ?? 0) + (Number(r.quantity) || 0));
    }
    return [...map.entries()].map(([bin, quantity]) => ({ bin, quantity }));
  }

  // Existing (already-saved) photo, shown until a new one is chosen.
  const existingPhotoUrl = item?.photo_url ?? "";
  // The original selected image (used by the cropper).
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  // The cropped result to upload + its preview.
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    setRawSrc(URL.createObjectURL(f));
    setCropOpen(true);
    e.target.value = ""; // allow re-selecting the same file later
  }

  function handleCropDone(blob: Blob) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(blob));
    setCroppedFile(
      new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })
    );
    setCropOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let finalPhotoUrl = existingPhotoUrl;

      if (croppedFile) {
        const path = `${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("item-photos")
          .upload(path, croppedFile, {
            upsert: true,
            contentType: "image/jpeg",
          });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage
          .from("item-photos")
          .getPublicUrl(path);
        finalPhotoUrl = pub.publicUrl;
      }

      const savedBins = cleanedBins();
      const payload = {
        name: name.trim(),
        // storage_bin is kept as a plain-text summary for legacy display;
        // item_bins is the source of truth for bins + counts.
        storage_bin: savedBins.map((b) => b.bin).join(", ") || null,
        description: description.trim() || null,
        total_quantity: Number(totalQuantity),
        photo_url: finalPhotoUrl || null,
      };

      let savedId: string;
      if (item) {
        const { error: updateError } = await supabase
          .from("items")
          .update(payload)
          .eq("id", item.id);
        if (updateError) throw updateError;
        savedId = item.id;
      } else {
        const { data, error: insertError } = await supabase
          .from("items")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        savedId = data.id;
        // If we came from scanning a blank label, link it to this new item
        // and make sure the quantity covers every label assigned to it.
        if (labelCode) {
          await supabase
            .from("labels")
            .update({ item_id: savedId })
            .eq("id", labelCode);
          await syncItemQuantityWithLabels(savedId);
        }
      }

      // Replace the item's bins with the current set.
      await supabase.from("item_bins").delete().eq("item_id", savedId);
      if (savedBins.length > 0) {
        const { error: binErr } = await supabase.from("item_bins").insert(
          savedBins.map((b) => ({
            item_id: savedId,
            bin: b.bin,
            quantity: b.quantity,
          }))
        );
        if (binErr) throw binErr;
      }

      router.push(`/items/${savedId}`);
      router.refresh();
    } catch (err) {
      // Supabase errors are plain objects with a `message`, not JS Errors.
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Something went wrong";
      setError(message);
      setSaving(false);
    }
  }

  const shownPhoto = preview ?? existingPhotoUrl;

  return (
    <>
      {cropOpen && rawSrc && (
        <PhotoCropper
          imageSrc={rawSrc}
          onCancel={() => setCropOpen(false)}
          onDone={handleCropDone}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <Field label="Item name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </Field>

        <Field label="Total quantity">
          <input
            type="number"
            min={0}
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(Number(e.target.value))}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </Field>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Bins &amp; counts
          </label>
          <p className="mb-2 text-xs text-slate-400">
            Where these units are stored. Add a row per bin — an item can live in
            several bins (e.g. 8 in A, 4 in B).
          </p>
          <div className="space-y-2">
            {binRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row.bin}
                  onChange={(e) => setBinRow(i, { bin: e.target.value })}
                  placeholder="Bin (e.g. A-12)"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
                />
                <input
                  type="number"
                  min={0}
                  value={row.quantity}
                  onChange={(e) =>
                    setBinRow(i, { quantity: Number(e.target.value) })
                  }
                  aria-label="Quantity in this bin"
                  className="w-20 rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeBinRow(i)}
                  aria-label="Remove bin"
                  className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addBinRow}
            className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            + Add bin
          </button>
          <BinSum rows={binRows} total={Number(totalQuantity)} />
        </div>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </Field>

        <Field label="Photo">
          {shownPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownPhoto}
              alt=""
              className="mb-2 h-28 w-28 rounded-lg object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
              {shownPhoto ? "Choose a different photo" : "Choose photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            {rawSrc && (
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Edit / crop
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            After choosing a photo you can zoom, reposition, and rotate it.
          </p>
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : item ? "Save changes" : "Add item"}
        </button>
      </form>
    </>
  );
}

// Gentle note comparing the sum of bin counts against the total quantity.
function BinSum({ rows, total }: { rows: BinRow[]; total: number }) {
  const sum = rows.reduce((n, r) => n + (Number(r.quantity) || 0), 0);
  if (sum === 0) return null;
  const diff = total - sum;
  return (
    <p className="mt-2 text-xs text-slate-500">
      {sum} in bins
      {diff > 0
        ? ` · ${diff} not assigned to a bin`
        : diff < 0
          ? ` · ${-diff} more than the total quantity`
          : " · matches total"}
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}
