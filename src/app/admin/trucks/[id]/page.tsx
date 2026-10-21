import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { arriveItemTo, arriveTruckTo } from "@/app/actions";
import { ImageIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Loaded = {
  id: string;
  quantity: number;
  person_responsible: string | null;
  items: { id: string; name: string; photo_url: string | null } | null;
  tournaments: { name: string } | null;
};

export default async function TruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/trucks/${id}`);

  const { data: truck } = await supabase
    .from("trucks")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!truck) notFound();

  const [{ data: loadedData }, { data: tournamentsData }] = await Promise.all([
    supabase
      .from("checkouts")
      .select("id, quantity, person_responsible, items(id, name, photo_url), tournaments(name)")
      .eq("truck_id", id)
      .is("checked_in_at", null)
      .order("checked_out_at", { ascending: false }),
    supabase
      .from("tournaments")
      .select("id, name")
      .order("start_date", { ascending: false }),
  ]);
  const loaded = (loadedData ?? []) as unknown as Loaded[];
  const tournaments = (tournamentsData ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/tournaments" className="text-sm text-slate-500 hover:text-slate-900">
          ← Tracking
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          {truck.name}
        </h1>
        <p className="text-sm text-slate-500">
          {loaded.length} item{loaded.length === 1 ? "" : "s"} loaded
        </p>
      </div>

      {loaded.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nothing is loaded on this truck right now.
        </p>
      ) : (
        <>
          {/* Bulk arrive the whole truck */}
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="mb-1 font-semibold text-emerald-900">
              Arrived at destination
            </h2>
            <p className="mb-3 text-sm text-emerald-800">
              Choose where this whole truck arrived. The warehouse checks
              everything back in; a tournament moves it to that tournament&apos;s
              page.
            </p>
            <form action={arriveTruckTo} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="truck_id" value={id} />
              <DestinationSelect tournaments={tournaments} />
              <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                Arrive whole truck
              </button>
            </form>
          </section>

          {/* Items on the truck */}
          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              What&apos;s on the truck
            </h2>
            <ul className="space-y-2">
              {loaded.map((c) => (
                <li
                  key={c.id}
                  className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {c.items?.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.items.photo_url}
                          alt={c.items?.name ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      {c.items?.id ? (
                        <Link
                          href={`/items/${c.items.id}`}
                          className="truncate font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                        >
                          {c.quantity} × {c.items?.name ?? "Unknown item"}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-slate-900">
                          {c.quantity} × {c.items?.name ?? "Unknown item"}
                        </p>
                      )}
                      <p className="truncate text-sm text-slate-500">
                        From {c.tournaments?.name ?? "no tournament"}
                        {c.person_responsible ? ` · ${c.person_responsible}` : ""}
                      </p>
                    </div>
                  </div>
                  <form
                    action={arriveItemTo}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="checkout_id" value={c.id} />
                    <input type="hidden" name="truck_id" value={id} />
                    <DestinationSelect tournaments={tournaments} small />
                    <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
                      Arrive
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function DestinationSelect({
  tournaments,
  small,
}: {
  tournaments: { id: string; name: string }[];
  small?: boolean;
}) {
  return (
    <select
      name="destination"
      required
      className={`min-w-0 flex-1 rounded-lg border border-slate-300 bg-white focus:border-slate-900 focus:outline-none ${
        small ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      <option value="">Arrived where?</option>
      <option value="warehouse">Warehouse (check in — final)</option>
      {tournaments.map((t) => (
        <option key={t.id} value={t.id}>
          → {t.name}
        </option>
      ))}
    </select>
  );
}
