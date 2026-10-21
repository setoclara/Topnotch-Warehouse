"use client";

import { writeOffCheckout } from "@/app/actions";

export default function WriteOffButton({
  checkoutId,
  itemId,
  tournamentId,
  label = "Lost/used",
}: {
  checkoutId: string;
  itemId?: string | null;
  tournamentId?: string | null;
  label?: string;
}) {
  return (
    <form
      action={writeOffCheckout}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Mark these as lost or used up? They will be permanently removed from your inventory count. This can't be undone."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="checkout_id" value={checkoutId} />
      <input type="hidden" name="item_id" value={itemId ?? ""} />
      <input type="hidden" name="tournament_id" value={tournamentId ?? ""} />
      <button className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50">
        {label}
      </button>
    </form>
  );
}
