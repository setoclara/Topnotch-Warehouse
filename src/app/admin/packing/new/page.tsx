import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPackingList } from "@/app/actions";
import type { Tournament } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewPackingListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/packing/new");

  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .order("start_date", { ascending: false });
  const tournaments = (data ?? []) as Tournament[];

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/packing" className="text-sm text-slate-500 hover:text-slate-900">
        ← Packing lists
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Start a packing list
      </h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={createPackingList} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            List name
          </label>
          <input
            name="name"
            required
            placeholder="e.g. Memphis Classic — Court gear"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tournament (optional)
          </label>
          <select
            name="tournament_id"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-900 focus:outline-none"
          >
            <option value="">— none —</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700">
          Create list
        </button>
      </form>
    </div>
  );
}
