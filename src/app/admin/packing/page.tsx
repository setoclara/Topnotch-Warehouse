import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ListRow = {
  id: string;
  name: string;
  created_at: string;
  tournaments: { name: string } | null;
  packing_list_items: { count: number }[];
};

export default async function PackingListsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/packing");

  const { data } = await supabase
    .from("packing_lists")
    .select("id, name, created_at, tournaments(name), packing_list_items(count)")
    .order("created_at", { ascending: false });
  const lists = (data ?? []) as unknown as ListRow[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
            ← Back to staff area
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Packing lists
          </h1>
        </div>
        <Link
          href="/admin/packing/new"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          New list
        </Link>
      </div>

      {lists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No packing lists yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/packing/${l.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                <p className="font-medium text-slate-900">{l.name}</p>
                <p className="text-sm text-slate-500">
                  {l.tournaments?.name ? `${l.tournaments.name} · ` : ""}
                  {l.packing_list_items?.[0]?.count ?? 0} item
                  {(l.packing_list_items?.[0]?.count ?? 0) === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
