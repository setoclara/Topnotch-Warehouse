"use client";

import { writeOffCheckout } from "@/app/actions";

// Quantity-aware write-off: mark some (or all) of an out line as lost,
// permanently reducing the item's total count.
export default function WriteOffQtyButton({
  checkoutId,
  itemId,
  tournamentId,
  maxQuantity,
}: {
  checkoutId: string;
  itemId?: string | null;
  tournamentId?: string | null;
  maxQuantity: number;
}) {
  return (
    <form
      action={writeOffCheckout}
      onSubmit={(e) => {
        const form = e.currentTarget;
        const input = form.elements.namedItem(
          "quantity"
        ) as HTMLInputElement | null;
        const n = input ? Number(input.value) : maxQuantity;
        if (
          !window.confirm(
            `Mark ${n} as lost? This permanently removes ${
              n === 1 ? "it" : "them"
            } from your total count and can't be undone.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex items-end gap-1"
    >
      <input type="hidden" name="checkout_id" value={checkoutId} />
      <input type="hidden" name="item_id" value={itemId ?? ""} />
      <input type="hidden" name="tournament_id" value={tournamentId ?? ""} />
      {maxQuantity > 1 && (
        <input
          name="quantity"
          type="number"
          min={1}
          max={maxQuantity}
          defaultValue={1}
          title="How many are lost"
          className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
        />
      )}
      <button className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
        Lost
      </button>
    </form>
  );
}
