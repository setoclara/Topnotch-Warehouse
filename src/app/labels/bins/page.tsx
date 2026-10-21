import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LabelSheet, { type LabelEntry } from "@/components/LabelSheet";

export const dynamic = "force-dynamic";

export default async function BinLabelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/labels/bins");

  const OWNER = "PROPERTY OF TOPNOTCH EVENTS";

  const { data } = await supabase.from("item_bins").select("bin");

  // Distinct, non-empty bin names.
  const bins = [
    ...new Set(
      (data ?? [])
        .map((r) => (r as { bin: string | null }).bin?.trim())
        .filter((b): b is string => !!b)
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const entries: LabelEntry[] = bins.map((bin) => ({
    id: `bin:${bin}`,
    path: `/b/${encodeURIComponent(bin)}`,
    title: `Bin ${bin}`,
    subtitle: OWNER,
  }));

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link
          href="/labels"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Print bin labels
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          One QR per bin. Scanning a bin label in the Scan screen moves every
          item in that bin at once.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">
          No bins yet. Assign a bin to an item first (Edit item → Bin).
        </p>
      ) : (
        <LabelSheet
          entries={entries}
          hint={`${entries.length} bin label${
            entries.length === 1 ? "" : "s"
          }. Stick one on each bin.`}
        />
      )}
    </div>
  );
}
