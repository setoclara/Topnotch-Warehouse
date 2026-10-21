import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, formatDate } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";
import TrackingAddMenu from "@/components/TrackingAddMenu";
import type { Tournament } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .order("start_date", { ascending: false });
  const tournaments = (data ?? []) as Tournament[];

  // Trucks (staff): show each truck and how many items are loaded on it.
  let trucks: { id: string; name: string; count: number }[] = [];
  if (user) {
    const [{ data: trucksData }, { data: loadedData }] = await Promise.all([
      supabase.from("trucks").select("id, name").order("name"),
      supabase
        .from("checkouts")
        .select("truck_id")
        .is("checked_in_at", null)
        .not("truck_id", "is", null),
    ]);
    const counts = new Map<string, number>();
    for (const c of (loadedData ?? []) as { truck_id: string }[]) {
      counts.set(c.truck_id, (counts.get(c.truck_id) ?? 0) + 1);
    }
    trucks = ((trucksData ?? []) as { id: string; name: string }[]).map((t) => ({
      ...t,
      count: counts.get(t.id) ?? 0,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tracking
          </h1>
          <p className="text-sm text-slate-500">
            Tournaments and the movement of their gear (packed → loaded →
            arrived).
          </p>
        </div>
        {user && <TrackingAddMenu />}
      </div>

      {/* Trucks (staff) */}
      {user && (
        <section>
          <h2 className="mb-2 font-semibold text-slate-900">Trucks</h2>
          {trucks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              No trucks yet.{" "}
              <Link href="/admin/trucks" className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {trucks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/trucks/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <span className="font-medium text-slate-900">{t.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.count > 0
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.count > 0 ? `${t.count} loaded` : "empty"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold text-slate-900">Tournaments</h2>
        {tournaments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No tournaments yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-500">
                    {t.location ? `${t.location} · ` : ""}
                    {formatDate(t.start_date)}
                    {t.end_date ? ` – ${formatDate(t.end_date)}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
