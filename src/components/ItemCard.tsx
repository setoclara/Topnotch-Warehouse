import Link from "next/link";
import type { ItemAvailability } from "@/lib/types";
import { ImageIcon, MapPinIcon } from "@/components/icons";

export default function ItemCard({ item }: { item: ItemAvailability }) {
  const out = item.quantity_out > 0;
  const bins = (item.bins ?? []).map((b) => b.bin);
  const binLabel =
    bins.length === 0
      ? null
      : bins.length === 1
        ? `Bin ${bins[0]}`
        : `Bins ${bins[0]} +${bins.length - 1}`;
  return (
    <Link
      href={`/items/${item.id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="aspect-square w-full bg-slate-100">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 p-2">
        <p className="truncate text-sm font-medium text-slate-900">
          {item.name}
        </p>
        <p className="mt-0.5 text-xs">
          <span className="font-semibold text-emerald-700">
            {item.quantity_available}
          </span>
          <span className="text-slate-400"> / {item.total_quantity}</span>
          {out && <span className="text-amber-600"> · {item.quantity_out} out</span>}
        </p>
        {binLabel && (
          <span className="mt-1 inline-flex max-w-full items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            <MapPinIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{binLabel}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
