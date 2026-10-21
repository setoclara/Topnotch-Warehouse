import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTournament } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/tournaments/new");

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/tournaments" className="text-sm text-slate-500 hover:text-slate-900">
        ← Tracking
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold tracking-tight text-slate-900">
        New tournament
      </h1>

      <form action={createTournament} className="space-y-3">
        <input
          name="name"
          required
          placeholder="Tournament name"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
        />
        <input
          name="location"
          placeholder="Location"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-600">
            Start
            <input
              name="start_date"
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
            />
          </label>
          <label className="text-sm text-slate-600">
            End
            <input
              name="end_date"
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
            />
          </label>
        </div>
        <button className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700">
          Create tournament
        </button>
      </form>
    </div>
  );
}
