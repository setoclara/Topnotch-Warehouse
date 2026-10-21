import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addPackingItem,
  togglePacked,
  deletePackingItem,
  deletePackingList,
} from "@/app/actions";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

type PackRow = {
  id: string;
  quantity: number;
  packed: boolean;
  items: { id: string; name: string; storage_bin: string | null } | null;
};

export default async function PackingListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/packing/${id}`);

  const { data: listData } = await supabase
    .from("packing_lists")
    .select("id, name, tournaments(name)")
    .eq("id", id)
    .maybeSingle();
  if (!listData) notFound();
  const list = listData as unknown as {
    id: string;
    name: string;
    tournaments: { name: string } | null;
  };

  const [{ data: rowsData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("packing_list_items")
      .select("id, quantity, packed, items(id, name, storage_bin)")
      .eq("list_id", id)
      .order("created_at"),
    supabase.from("items").select("id, name, storage_bin").order("name"),
  ]);

  const rows = (rowsData ?? []) as unknown as PackRow[];
  const allItems = (itemsData ?? []) as Pick<
    Item,
    "id" | "name" | "storage_bin"
  >[];
  const packedCount = rows.filter((r) => r.packed).length;
  const tournamentName = list.tournaments?.name;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link
          href="/admin/packing"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Packing lists
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          {list.name}
        </h1>
        <p className="text-sm text-slate-500">
          {tournamentName ? `${tournamentName} · ` : ""}
          {packedCount} of {rows.length} packed
        </p>
      </div>

      {/* Add item */}
      <form
        action={addPackingItem}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="list_id" value={id} />
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Add item
          </label>
          <select
            name="item_id"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-900 focus:outline-none"
          >
            <option value="">Select an item…</option>
            {allItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.storage_bin ? ` (Bin ${i.storage_bin})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Qty
          </label>
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
          Add
        </button>
      </form>

      {/* Checklist */}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Nothing on this list yet. Add items above.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <form action={togglePacked} className="shrink-0">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="list_id" value={id} />
                <input type="hidden" name="packed" value={String(!r.packed)} />
                <button
                  aria-label={r.packed ? "Mark not packed" : "Mark packed"}
                  className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                    r.packed
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </form>

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-medium ${
                    r.packed ? "text-slate-400 line-through" : "text-slate-900"
                  }`}
                >
                  {r.quantity} × {r.items?.name ?? "Unknown item"}
                </p>
                {r.items?.storage_bin && (
                  <p className="text-xs text-slate-500">
                    Bin {r.items.storage_bin}
                  </p>
                )}
              </div>

              <form action={deletePackingItem} className="shrink-0">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="list_id" value={id} />
                <button className="text-sm text-red-600 hover:underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={deletePackingList} className="border-t border-slate-200 pt-4">
        <input type="hidden" name="id" value={id} />
        <button className="text-sm text-red-600 hover:underline">
          Delete this packing list
        </button>
      </form>
    </div>
  );
}
