import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mergeItems } from "@/app/actions";
import type { ItemAvailability } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MergePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/merge");

  const { data } = await supabase
    .from("item_availability")
    .select("*")
    .order("created_at");
  const items = (data ?? []) as ItemAvailability[];

  // Group by normalized name; a group with 2+ entries is a likely duplicate.
  const groups = new Map<string, ItemAvailability[]>();
  for (const it of items) {
    const key = it.name.trim().toLowerCase();
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
  }
  const dupes = [...groups.values()]
    .filter((g) => g.length > 1)
    .sort((a, b) => a[0].name.localeCompare(b[0].name));

  const binSummary = (it: ItemAvailability) =>
    (it.bins ?? []).length === 0
      ? "no bin"
      : it.bins.map((b) => `${b.bin}·${b.quantity}`).join(", ");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to staff area
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Merge duplicates
        </h1>
        <p className="text-sm text-slate-500">
          Entries with the same name. Pick which one to keep — the others fold
          into it, combining quantities, bins, and history.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {dupes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No duplicate names found. Everything looks clean.
        </p>
      ) : (
        <div className="space-y-4">
          {dupes.map((group) => {
            const ids = group.map((g) => g.id).join(",");
            return (
              <form
                key={ids}
                action={mergeItems}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <input type="hidden" name="duplicate_ids" value={ids} />
                <h2 className="font-semibold text-slate-900">
                  {group[0].name}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    ({group.length} entries)
                  </span>
                </h2>
                <p className="text-xs text-slate-500">Keep which entry?</p>
                <div className="space-y-1.5">
                  {group.map((g, i) => (
                    <label
                      key={g.id}
                      className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:bg-slate-50"
                    >
                      <input
                        type="radio"
                        name="primary_id"
                        value={g.id}
                        defaultChecked={i === 0}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">
                          {g.total_quantity} total · {g.quantity_out} out
                        </span>
                        <span className="block text-xs text-slate-500">
                          Bins: {binSummary(g)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
                  Merge these {group.length} into one
                </button>
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
