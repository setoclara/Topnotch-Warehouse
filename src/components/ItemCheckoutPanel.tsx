import { checkOut } from "@/app/actions";
import type { Tournament } from "@/lib/types";

export default function ItemCheckoutPanel({
  itemId,
  available,
  tournaments,
  defaultPerson = "",
}: {
  itemId: string;
  available: number;
  tournaments: Tournament[];
  defaultPerson?: string;
}) {
  return (
    <div className="space-y-3">
      {/* Check-out (collapsed to keep the page compact) */}
      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-baseline justify-between px-4 py-3 hover:bg-slate-50">
          <span className="font-semibold text-slate-900">Check out this item</span>
          <span className="text-sm text-slate-500">{available} available</span>
        </summary>
        <div className="space-y-3 border-t border-slate-100 p-4">

        {available <= 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-700">
            None available right now — every one of these is checked out. Check
            some back in before checking out again.
          </p>
        )}

        <form action={checkOut} className="space-y-3">
          <input type="hidden" name="item_id" value={itemId} />
          <input type="hidden" name="redirect_to" value={`/items/${itemId}`} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Quantity
              </label>
              <input
                name="quantity"
                type="number"
                min={1}
                max={Math.max(available, 1)}
                defaultValue={1}
                required
                disabled={available <= 0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tournament
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
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Person responsible
            </label>
            <input
              name="person_responsible"
              defaultValue={defaultPerson}
              placeholder="Who is holding this item?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <input type="hidden" name="notes" value="" />

          <button
            type="submit"
            disabled={available <= 0}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Check out
          </button>
        </form>
        </div>
      </details>
    </div>
  );
}
