import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBlankLabels } from "@/app/actions";
import LabelSheet, { type LabelEntry } from "@/components/LabelSheet";

export const dynamic = "force-dynamic";

export default async function BlankLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/labels/blank");

  // All labels not yet linked to an item = blanks available to stick on things.
  const { data, error } = await supabase
    .from("labels")
    .select("id, created_at")
    .is("item_id", null)
    .is("bin", null)
    .order("created_at", { ascending: false });

  const labels = data ?? [];
  const entries: LabelEntry[] = labels.map((l) => ({
    id: l.id,
    path: `/t/${l.id}`,
    title: l.id.slice(0, 8).toUpperCase(),
    subtitle: "PROPERTY OF TOPNOTCH EVENTS",
  }));

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to staff area
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Blank labels
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Print these now and stick them on boxes or items. Later, scan one with
          your phone to assign it — to a box (bin) or an item.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">
          Couldn&apos;t load labels: {error.message}. If this is the first time,
          the labels table may not be set up yet.
        </p>
      )}

      {created && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 print:hidden">
          Created {created} new blank label{created === "1" ? "" : "s"}.
        </p>
      )}

      <form
        action={createBlankLabels}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            How many to generate?
          </label>
          <input
            name="count"
            type="number"
            min={1}
            max={100}
            defaultValue={12}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
          Generate
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 print:hidden">
          No unassigned labels yet. Generate some above.
        </p>
      ) : (
        <LabelSheet
          entries={entries}
          hint={`${entries.length} unassigned label${
            entries.length === 1 ? "" : "s"
          } ready to print.`}
        />
      )}
    </div>
  );
}
