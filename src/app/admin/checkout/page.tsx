import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  checkOut,
  checkOutBin,
  checkInBin,
  checkInQuantity,
} from "@/app/actions";
import { displayNameOf } from "@/lib/format";
import CheckModeTabs from "@/components/CheckModeTabs";
import type { ItemAvailability, Tournament } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bin?: string }>;
}) {
  const { error: actionError, bin: preBin } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: itemsData }, { data: tournamentsData }] = await Promise.all([
    supabase.from("item_availability").select("*").order("name"),
    supabase
      .from("tournaments")
      .select("*")
      .order("start_date", { ascending: false }),
  ]);

  const items = (itemsData ?? []) as ItemAvailability[];
  const tournaments = (tournamentsData ?? []) as Tournament[];
  const defaultPerson = displayNameOf(user);
  const outItems = items.filter((i) => i.quantity_out > 0);

  // Bins with something available (check out) and something out (check in).
  const binMap = new Map<string, { count: number; units: number }>();
  const outBinMap = new Map<string, number>();
  for (const i of items) {
    const itemBins = (i.bins ?? []).map((b) => b.bin.trim()).filter(Boolean);
    for (const bin of itemBins) {
      if (i.quantity_available > 0) {
        const e = binMap.get(bin) ?? { count: 0, units: 0 };
        e.count += 1;
        e.units += i.quantity_available;
        binMap.set(bin, e);
      }
      if (i.quantity_out > 0) {
        outBinMap.set(bin, (outBinMap.get(bin) ?? 0) + i.quantity_out);
      }
    }
  }
  const bins = [...binMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const outBins = [...outBinMap.entries()]
    .map(([name, units]) => ({ name, units }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-900 focus:outline-none";
  const label = "mb-1 block text-sm font-medium text-slate-700";

  // ---------- CHECK OUT ----------
  const checkoutSection = (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">
          Check out a whole bin (box)
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Checks out every available item in the bin at once.
        </p>
        {bins.length === 0 ? (
          <p className="text-sm text-slate-500">
            No bins with available items right now.
          </p>
        ) : (
          <form action={checkOutBin} className="space-y-3">
            <div>
              <label className={label}>Bin</label>
              <select
                name="bin"
                required
                defaultValue={
                  preBin && bins.some((b) => b.name === preBin) ? preBin : ""
                }
                className={inputCls}
              >
                <option value="">Select a bin…</option>
                {bins.map((b) => (
                  <option key={b.name} value={b.name}>
                    Bin {b.name} — {b.count} item{b.count === 1 ? "" : "s"},{" "}
                    {b.units} unit{b.units === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Tournament</label>
              <select name="tournament_id" className={inputCls}>
                <option value="">— none —</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Person responsible</label>
              <input
                name="person_responsible"
                defaultValue={defaultPerson}
                placeholder="Who is holding this bin?"
                className={inputCls}
              />
            </div>
            <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700">
              Check out entire bin
            </button>
          </form>
        )}
      </div>

      <Divider>or check out one item</Divider>

      <form action={checkOut} className="space-y-4">
        <div>
          <label className={label}>Item</label>
          <select name="item_id" required className={inputCls}>
            <option value="">Select an item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.quantity_available} available)
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Quantity</label>
            <input
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={label}>Tournament</label>
            <select name="tournament_id" className={inputCls}>
              <option value="">— none —</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Person responsible</label>
          <input
            name="person_responsible"
            defaultValue={defaultPerson}
            placeholder="Who is holding this item?"
            className={inputCls}
          />
        </div>
        <input type="hidden" name="notes" value="" />
        <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700">
          Check out
        </button>
      </form>
    </div>
  );

  // ---------- CHECK IN ----------
  const checkinSection = (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h2 className="font-semibold text-emerald-900">
          Check a whole bin (box) back in
        </h2>
        <p className="mb-3 text-sm text-emerald-800">
          Returns every item from the bin that&apos;s currently out.
        </p>
        {outBins.length === 0 ? (
          <p className="text-sm text-emerald-800">Nothing is out right now.</p>
        ) : (
          <form action={checkInBin} className="space-y-3">
            <select
              name="bin"
              required
              className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Select a bin…</option>
              {outBins.map((b) => (
                <option key={b.name} value={b.name}>
                  Bin {b.name} — {b.units} unit{b.units === 1 ? "" : "s"} out
                </option>
              ))}
            </select>
            <button className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500">
              Check in entire bin
            </button>
          </form>
        )}
      </div>

      <Divider>or check in one item</Divider>

      {outItems.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing is checked out.</p>
      ) : (
        <form action={checkInQuantity} className="space-y-4">
          <div>
            <label className={label}>Item</label>
            <select name="item_id" required className={inputCls}>
              <option value="">Select an item…</option>
              {outItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.quantity_out} out)
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className={label}>Quantity</label>
            <input
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              required
              className={inputCls}
            />
          </div>
          <button className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500">
            Check in
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to staff area
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Check gear out / in
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        Move gear in and out of the warehouse — a whole bin at once, or one item.
      </p>

      {actionError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}

      <CheckModeTabs checkout={checkoutSection} checkin={checkinSection} />
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      {children}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
