import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, formatDateTime, displayNameOf } from "@/lib/format";
import {
  packCheckout,
  loadCheckout,
  arriveItemTo,
  resetStatus,
} from "@/app/actions";
import SetupNotice from "@/components/SetupNotice";
import { ImageIcon, MapPinIcon } from "@/components/icons";
import DeleteCheckoutButton from "@/components/DeleteCheckoutButton";
import WriteOffQtyButton from "@/components/WriteOffQtyButton";
import ItemCheckoutPanel from "@/components/ItemCheckoutPanel";
import type {
  ItemAvailability,
  CheckoutDetailed,
  Tournament,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; merged?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { id } = await params;
  const { error: actionError, merged } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: itemData } = await supabase
    .from("item_availability")
    .select("*")
    .eq("id", id)
    .single();

  if (!itemData) notFound();
  const item = itemData as ItemAvailability;

  const { data: historyData } = await supabase
    .from("checkouts")
    .select("*, tournaments(id, name), trucks(name)")
    .eq("item_id", id)
    .order("checked_out_at", { ascending: false })
    .limit(50);

  const history = (historyData ?? []) as unknown as (CheckoutDetailed & {
    trucks: { name: string } | null;
  })[];
  const outstanding = history.filter((h) => !h.checked_in_at);
  const pastHistory = history.filter((h) => h.checked_in_at);

  // Staff need the tournament + truck lists for the check-out / tracking controls.
  let tournaments: Tournament[] = [];
  let trucks: { id: string; name: string }[] = [];
  if (user) {
    const [{ data: tData }, { data: trucksData }] = await Promise.all([
      supabase
        .from("tournaments")
        .select("*")
        .order("start_date", { ascending: false }),
      supabase.from("trucks").select("id, name").order("name"),
    ]);
    tournaments = (tData ?? []) as Tournament[];
    trucks = (trucksData ?? []) as { id: string; name: string }[];
  }

  return (
    <div className="space-y-6">
      <Link
        href="/events"
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to inventory
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {item.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photo_url}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <ImageIcon className="h-14 w-14" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {item.name}
          </h1>
          {item.bins && item.bins.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.bins.map((b) => (
                <Link
                  key={b.bin}
                  href={`/b/${encodeURIComponent(b.bin)}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-700"
                  title={`See everything in Bin ${b.bin}`}
                >
                  <MapPinIcon className="h-3.5 w-3.5" /> Bin {b.bin}
                  <span className="rounded-full bg-white/20 px-1.5">
                    {b.quantity}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
              No bin assigned
            </span>
          )}
          {item.description && (
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          )}
          <div className="mt-3 flex gap-4 text-sm">
            <Stat label="Available" value={item.quantity_available} highlight />
            <Stat label="Out" value={item.quantity_out} />
            <Stat label="Total" value={item.total_quantity} />
          </div>
          {user && (
            <Link
              href={`/admin/items/${item.id}/edit`}
              className="mt-4 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Edit item
            </Link>
          )}
        </div>
      </div>

      {actionError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}
      {merged && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          Merged {merged} entries into this one. Quantities and bins were
          combined.
        </p>
      )}
      {/* Currently out — the item's live status and where it is */}
      {outstanding.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-slate-900">Currently out</h2>
          <ul className="space-y-2">
            {outstanding.map((h) => {
              const s = h.status ?? "packed";
              const cls =
                s === "loaded"
                  ? "bg-blue-50 text-blue-700"
                  : s === "arrived"
                    ? "bg-indigo-50 text-indigo-700"
                    : s === "staged"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600";
              const text =
                s === "loaded"
                  ? `Loaded${h.trucks?.name ? ` · ${h.trucks.name}` : ""}`
                  : s === "arrived"
                    ? `Arrived${
                        h.arrived_location ? ` · ${h.arrived_location}` : ""
                      }`
                    : s === "staged"
                      ? "Packed"
                      : "In use";
              return (
                <li
                  key={h.id}
                  className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {h.quantity} ×{" "}
                        {h.tournaments?.name ? (
                          <span>at {h.tournaments.name}</span>
                        ) : (
                          <span className="text-slate-500">no tournament</span>
                        )}
                      </p>
                      {h.person_responsible && (
                        <p className="text-slate-500">{h.person_responsible}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
                    >
                      {text}
                    </span>
                  </div>
                  {user && (
                    <div className="flex flex-wrap items-end gap-2">
                      {s === "packed" && (
                        <form action={packCheckout} className="flex items-end gap-1">
                          <input type="hidden" name="checkout_id" value={h.id} />
                          <input
                            type="hidden"
                            name="tournament_id"
                            value={h.tournament_id ?? ""}
                          />
                          {h.quantity > 1 && (
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              max={h.quantity}
                              defaultValue={h.quantity}
                              title="How many to pack"
                              className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                            />
                          )}
                          <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500">
                            Pack
                          </button>
                        </form>
                      )}
                      {s === "staged" && trucks.length > 0 && (
                        <form action={loadCheckout} className="flex items-end gap-1">
                          <input type="hidden" name="checkout_id" value={h.id} />
                          <input
                            type="hidden"
                            name="tournament_id"
                            value={h.tournament_id ?? ""}
                          />
                          {h.quantity > 1 && (
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              max={h.quantity}
                              defaultValue={h.quantity}
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
                      {(s === "loaded" || s === "arrived") && (
                        <form action={arriveItemTo} className="flex items-end gap-1">
                          <input type="hidden" name="checkout_id" value={h.id} />
                          <input
                            type="hidden"
                            name="truck_id"
                            value={h.truck_id ?? ""}
                          />
                          <select
                            name="destination"
                            required
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                          >
                            <option value="">Arrived / returned…</option>
                            <option value="warehouse">Warehouse (check in)</option>
                            {tournaments
                              .filter((t) => t.id !== h.tournament_id)
                              .map((t) => (
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
                      {s !== "packed" && (
                        <form action={resetStatus}>
                          <input type="hidden" name="checkout_id" value={h.id} />
                          <input
                            type="hidden"
                            name="tournament_id"
                            value={h.tournament_id ?? ""}
                          />
                          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                            Undo
                          </button>
                        </form>
                      )}
                      <span className="flex-1" />
                      <WriteOffQtyButton
                        checkoutId={h.id}
                        itemId={item.id}
                        tournamentId={h.tournament_id}
                        maxQuantity={h.quantity}
                      />
                      <DeleteCheckoutButton
                        checkoutId={h.id}
                        itemId={item.id}
                        tournamentId={h.tournament_id}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Check out — only when some units are in the warehouse */}
      {user && item.quantity_available > 0 && (
        <ItemCheckoutPanel
          itemId={item.id}
          available={item.quantity_available}
          tournaments={tournaments}
          defaultPerson={displayNameOf(user)}
        />
      )}

      {/* Past history */}
      {pastHistory.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-slate-900">History</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {pastHistory.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {h.quantity} ×{" "}
                    {h.tournaments?.name ? (
                      <span>at {h.tournaments.name}</span>
                    ) : (
                      <span className="text-slate-500">no tournament</span>
                    )}
                  </p>
                  <p className="text-slate-500">
                    Out {formatDateTime(h.checked_out_at)}
                    {h.person_responsible ? ` · ${h.person_responsible}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Returned {formatDateTime(h.checked_in_at)}
                  </span>
                  {user && (
                    <DeleteCheckoutButton
                      checkoutId={h.id}
                      itemId={item.id}
                      tournamentId={h.tournament_id}
                      label="Delete"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-xl font-bold ${
          highlight ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
