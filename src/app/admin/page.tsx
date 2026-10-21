import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIn } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import type { CheckoutDetailed } from "@/lib/types";
import {
  PlusIcon,
  ExportIcon,
  TrophyIcon,
  ScanIcon,
  PrinterIcon,
  TagIcon,
  ClipboardIcon,
  MergeIcon,
} from "@/components/icons";
import DeleteCheckoutButton from "@/components/DeleteCheckoutButton";
import WriteOffButton from "@/components/WriteOffButton";
import SettingsMenu from "@/components/SettingsMenu";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const { done } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const doneMessage =
    done === "checked-out" ? "Item checked out." : done ? done : null;

  const { data: outData } = await supabase
    .from("checkouts")
    .select("*, items(id, name, photo_url), tournaments(id, name)")
    .is("checked_in_at", null)
    .order("checked_out_at", { ascending: false });

  const out = (outData ?? []) as CheckoutDetailed[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff area
          </h1>
          <p className="text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <SettingsMenu />
      </div>

      {doneMessage && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {doneMessage}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ActionTile href="/scan" label="Scan item" icon={<ScanIcon className="h-6 w-6" />} />
        <ActionTile href="/admin/items/new" label="Add item" icon={<PlusIcon className="h-6 w-6" />} />
        <ActionTile href="/admin/checkout" label="Check out / in" icon={<ExportIcon className="h-6 w-6" />} />
        <ActionTile href="/tournaments" label="Tracking" icon={<TrophyIcon className="h-6 w-6" />} />
        <ActionTile href="/labels" label="Print labels" icon={<PrinterIcon className="h-6 w-6" />} />
        <ActionTile href="/labels/blank" label="Blank labels" icon={<TagIcon className="h-6 w-6" />} />
        <ActionTile href="/admin/packing" label="Packing lists" icon={<ClipboardIcon className="h-6 w-6" />} />
        <ActionTile href="/admin/merge" label="Merge duplicates" icon={<MergeIcon className="h-6 w-6" />} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-slate-900">
          Currently out ({out.length})
        </h2>
        {out.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Everything is in the warehouse.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {out.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {c.quantity} × {c.items?.name ?? "Unknown item"}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {c.person_responsible
                      ? `${c.person_responsible} · `
                      : ""}
                    {c.tournaments?.name ?? "no tournament"} ·{" "}
                    {formatDateTime(c.checked_out_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <form action={checkIn}>
                    <input type="hidden" name="checkout_id" value={c.id} />
                    <input
                      type="hidden"
                      name="tournament_id"
                      value={c.tournament_id ?? ""}
                    />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500">
                      Check in
                    </button>
                  </form>
                  <WriteOffButton
                    checkoutId={c.id}
                    itemId={c.item_id}
                    tournamentId={c.tournament_id}
                  />
                  <DeleteCheckoutButton
                    checkoutId={c.id}
                    itemId={c.item_id}
                    tournamentId={c.tournament_id}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActionTile({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-700 transition hover:border-slate-300 hover:shadow-sm"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
