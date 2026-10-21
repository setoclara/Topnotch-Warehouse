import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/format";
import type { ItemAvailability } from "@/lib/types";
import ItemCard from "@/components/ItemCard";
import SetupNotice from "@/components/SetupNotice";
import { MapPinIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function BinPage({
  params,
}: {
  params: Promise<{ bin: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { bin: raw } = await params;
  const bin = decodeURIComponent(raw);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: binRows } = await supabase
    .from("item_bins")
    .select("item_id, quantity")
    .eq("bin", bin);
  const rows = (binRows ?? []) as { item_id: string; quantity: number }[];
  const ids = [...new Set(rows.map((r) => r.item_id))];
  const totalUnits = rows.reduce((n, r) => n + (r.quantity ?? 0), 0);
  const { data } = ids.length
    ? await supabase
        .from("item_availability")
        .select("*")
        .in("id", ids)
        .order("name")
    : { data: [] };
  const items = (data ?? []) as ItemAvailability[];

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to inventory
      </Link>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          <MapPinIcon className="h-4 w-4" /> Bin {bin}
        </span>
        <span className="text-sm text-slate-500">
          {items.length} item{items.length === 1 ? "" : "s"} · {totalUnits} unit
          {totalUnits === 1 ? "" : "s"}
        </span>
      </div>

      {user && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          To move this whole bin at once, open{" "}
          <Link href="/scan" className="font-medium underline">
            Scan
          </Link>
          , pick a mode, and scan this bin&apos;s QR label.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No items are assigned to this bin.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
