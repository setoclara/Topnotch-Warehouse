"use client";

import { deleteCheckout } from "@/app/actions";

export default function DeleteCheckoutButton({
  checkoutId,
  itemId,
  tournamentId,
  label = "Delete",
}: {
  checkoutId: string;
  itemId?: string | null;
  tournamentId?: string | null;
  label?: string;
}) {
  return (
    <form
      action={deleteCheckout}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Delete this entry? This permanently removes the record and can't be undone."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="checkout_id" value={checkoutId} />
      <input type="hidden" name="item_id" value={itemId ?? ""} />
      <input type="hidden" name="tournament_id" value={tournamentId ?? ""} />
      <button className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
        {label}
      </button>
    </form>
  );
}
