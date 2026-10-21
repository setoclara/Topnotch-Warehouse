import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  packCheckout,
  loadCheckout,
  loadBinToTruck,
  arriveItemTo,
  resetStatus,
} from "@/app/actions";
import { isSupabaseConfigured, formatDate } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";
import DeleteCheckoutButton from "@/components/DeleteCheckoutButton";
import WriteOffButton from "@/components/WriteOffButton";
import DeleteTournamentButton from "@/components/DeleteTournamentButton";
import { ImageIcon } from "@/components/icons";
import type { Tournament, CheckoutDetailed } from "@/lib/types";

export const dynamic = "force-dynamic";

type Truck = { id: string; name: string };
type Row = CheckoutDetailed & {
  items: {
    id: string;
    name: string;
    photo_url: string | null;
    storage_bin: string | null;
  } | null;
  trucks: { name: string } | null;
};

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tData } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();
  if (!tData) notFound();
  const tournament = tData as Tournament;

  const [{ data: coData }, { data: trucksData }, { data: otherTData }] =
    await Promise.all([
      supabase
        .from("checkouts")
        .select("*, items(id, name, photo_url, storage_bin), trucks(name)")
        .eq("tournament_id", id)
        .order("checked_out_at", { ascending: false }),
      supabase.from("trucks").select("id, name").order("name"),
      supabase
        .from("tournaments")
        .select("id, name")
        .neq("id", id)
        .order("start_date", { ascending: false }),
    ]);
  const otherTournaments = (otherTData ?? []) as { id: string; name: string }[];
  const checkouts = (coData ?? []) as unknown as Row[];
  const trucks = (trucksData ?? []) as Truck[];

  const outstanding = checkouts.filter((c) => !c.checked_in_at);
  // Don't list an item as "Returned" if it's currently out again for this
  // tournament — it should show once, under its current status.
  const outItemIds = new Set(outstanding.map((c) => c.item_id));
  const returned = checkouts.filter(
    (c) => c.checked_in_at && !outItemIds.has(c.item_id)
  );

  // Bins that still have gear to load (in use or packed, not yet on a truck).
  const packedBins = new Map<string, number>();
  for (const c of outstanding) {
    const s = c.status ?? "packed";
    if (s === "loaded" || s === "arrived") continue;
    const bin = c.items?.storage_bin?.trim();
    if (!bin) continue;
    packedBins.set(bin, (packedBins.get(bin) ?? 0) + 1);
  }
  const binOptions = [...packedBins.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/tournaments" className="text-sm text-slate-500 hover:text-slate-900">
            ← All tournaments
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {tournament.name}
          </h1>
          <p className="text-sm text-slate-500">
            {tournament.location ? `${tournament.location} · ` : ""}
            {formatDate(tournament.start_date)}
            {tournament.end_date ? ` – ${formatDate(tournament.end_date)}` : ""}
          </p>
        </div>
        {user && <DeleteTournamentButton id={id} />}
      </div>

      {/* Load a whole bin onto a truck */}
      {user && binOptions.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">
              Load a bin onto a truck
            </h2>
            <Link
              href="/admin/trucks"
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Manage trucks →
            </Link>
          </div>
          {trucks.length === 0 ? (
            <p className="text-sm text-slate-500">
              No trucks yet —{" "}
              <Link href="/admin/trucks" className="underline">
                add one
              </Link>{" "}
              to start loading.
            </p>
          ) : (
            <form action={loadBinToTruck} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tournament_id" value={id} />
              <select
                name="bin"
                required
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">Bin…</option>
                {binOptions.map((b) => (
                  <option key={b.name} value={b.name}>
                    Bin {b.name} ({b.count} to load)
                  </option>
                ))}
              </select>
              <select
                name="truck_id"
                required
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">Truck…</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Load bin
              </button>
            </form>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold text-slate-900">
          Gear for this tournament ({outstanding.length})
        </h2>
        {outstanding.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Nothing outstanding for this tournament.
          </p>
        ) : (
          <ul className="space-y-2">
            {outstanding.map((c) => {
              const status = c.status ?? "packed";
              return (
                <li
                  key={c.id}
                  className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <Thumb
                        photo={c.items?.photo_url ?? null}
                        name={c.items?.name ?? ""}
                      />
                      <div className="min-w-0">
                        {c.item_id ? (
                          <Link
                            href={`/items/${c.item_id}`}
                            className="truncate font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                          >
                            {c.quantity} × {c.items?.name ?? "Unknown item"}
                          </Link>
                        ) : (
                          <p className="truncate font-medium text-slate-900">
                            {c.quantity} × {c.items?.name ?? "Unknown item"}
                          </p>
                        )}
                        <p className="truncate text-sm text-amber-700">
                          {c.person_responsible ?? "Unassigned"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={status}
                      truck={c.trucks?.name ?? null}
                      location={c.arrived_location}
                    />
                  </div>

                  {user && (
                    <div className="flex flex-wrap items-end gap-2">
                      {/* In use → Pack */}
                      {status === "packed" && (
                        <form action={packCheckout} className="flex items-end gap-1">
                          <input type="hidden" name="checkout_id" value={c.id} />
                          <input type="hidden" name="tournament_id" value={id} />
                          {c.quantity > 1 && (
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              max={c.quantity}
                              defaultValue={c.quantity}
                              title="How many to pack"
                              className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                            />
                          )}
                          <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500">
                            Pack
                          </button>
                        </form>
                      )}

                      {/* Packed → Load onto a truck */}
                      {status === "staged" && trucks.length > 0 && (
                        <form action={loadCheckout} className="flex items-end gap-1">
                          <input type="hidden" name="checkout_id" value={c.id} />
                          <input type="hidden" name="tournament_id" value={id} />
                          {c.quantity > 1 && (
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              max={c.quantity}
                              defaultValue={c.quantity}
                              title="How many to load"
                              className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                            />
                          )}
                          <select
                            name="truck_id"
                            required
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                          >
                            <option value="">Truck…</option>
                            {trucks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
                            Load
                          </button>
                        </form>
                      )}

                      {/* On a truck → resolve it: back to warehouse, or on to another tournament */}
                      {(status === "loaded" || status === "arrived") && (
                        <form action={arriveItemTo} className="flex items-end gap-1">
                          <input type="hidden" name="checkout_id" value={c.id} />
                          <select
                            name="destination"
                            required
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                          >
                            <option value="">Arrived / returned…</option>
                            <option value="warehouse">Warehouse (check in)</option>
                            {otherTournaments.map((t) => (
                              <option key={t.id} value={t.id}>
                                → {t.name}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                            Arrive
                          </button>
                        </form>
                      )}

                      {status !== "packed" && (
                        <form action={resetStatus}>
                          <input type="hidden" name="checkout_id" value={c.id} />
                          <input type="hidden" name="tournament_id" value={id} />
                          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                            Undo
                          </button>
                        </form>
                      )}

                      <span className="flex-1" />

                      <WriteOffButton
                        checkoutId={c.id}
                        itemId={c.item_id}
                        tournamentId={id}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {returned.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-slate-900">
            Returned ({returned.length})
          </h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {returned.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 truncate text-slate-600">
                  {c.item_id ? (
                    <Link
                      href={`/items/${c.item_id}`}
                      className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                    >
                      {c.quantity} × {c.items?.name ?? "Unknown item"}
                    </Link>
                  ) : (
                    <>
                      {c.quantity} × {c.items?.name ?? "Unknown item"}
                    </>
                  )}
                  {c.person_responsible ? ` · ${c.person_responsible}` : ""}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Returned
                  </span>
                  {user && (
                    <DeleteCheckoutButton
                      checkoutId={c.id}
                      itemId={c.item_id}
                      tournamentId={id}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Thumb({ photo, name }: { photo: string | null; name: string }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-300">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  truck,
  location,
}: {
  status: string;
  truck: string | null;
  location: string | null;
}) {
  const map: Record<string, { text: string; cls: string }> = {
    packed: { text: "In use", cls: "bg-slate-100 text-slate-600" },
    staged: { text: "Packed", cls: "bg-amber-50 text-amber-700" },
    loaded: {
      text: truck ? `Loaded · ${truck}` : "Loaded",
      cls: "bg-blue-50 text-blue-700",
    },
    arrived: {
      text: location ? `Arrived · ${location}` : "Arrived",
      cls: "bg-emerald-50 text-emerald-700",
    },
  };
  const s = map[status] ?? map.packed;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.text}
    </span>
  );
}
