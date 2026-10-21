"use client";

import { deleteTournament } from "@/app/actions";

export default function DeleteTournamentButton({ id }: { id: string }) {
  return (
    <form
      action={deleteTournament}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Delete this tournament? Any gear still out will stay out but lose its link to this tournament. This can't be undone."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="shrink-0 text-sm text-red-600 hover:underline">
        Delete tournament
      </button>
    </form>
  );
}
