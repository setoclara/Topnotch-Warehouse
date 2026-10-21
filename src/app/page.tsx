import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/format";
import type { ItemAvailability } from "@/lib/types";
import InventoryView from "@/components/InventoryView";
import SetupNotice from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("item_availability")
    .select("*")
    .order("name");

  const items = (data ?? []) as ItemAvailability[];

  // From open check-outs, build: which items are out for which tournament,
  // the tournaments with gear out, and each item's current movement statuses.
  const { data: openData } = await supabase
    .from("checkouts")
    .select("item_id, tournament_id, status, tournaments(name)")
    .is("checked_in_at", null);

  const itemTournaments: Record<string, string[]> = {};
  const itemStatuses: Record<string, string[]> = {};
  const tMap = new Map<string, string>();
  for (const c of (openData ?? []) as unknown as Array<{
    item_id: string;
    tournament_id: string | null;
    status: string | null;
    tournaments: { name: string } | null;
  }>) {
    const s = c.status ?? "packed";
    const list = (itemStatuses[c.item_id] ??= []);
    if (!list.includes(s)) list.push(s);
    if (c.tournament_id) {
      (itemTournaments[c.item_id] ??= []).push(c.tournament_id);
      if (c.tournaments?.name) tMap.set(c.tournament_id, c.tournaments.name);
    }
  }
  const tournamentOptions = [...tMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Inventory
        </h1>
        <p className="text-sm text-slate-500">
          {items.length} item{items.length === 1 ? "" : "s"} in the warehouse
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t load inventory: {error.message}
        </p>
      )}

      {items.length === 0 && !error ? (
        <div className="space-y-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          <p>No items yet.</p>
          {user && (
            <Link
              href="/admin/items/new"
              className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Add your first item
            </Link>
          )}
        </div>
      ) : (
        <InventoryView
          items={items}
          isStaff={!!user}
          tournaments={tournamentOptions}
          itemTournaments={itemTournaments}
          itemStatuses={itemStatuses}
        />
      )}
    </div>
  );
}
