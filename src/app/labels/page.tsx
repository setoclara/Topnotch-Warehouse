import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LabelSheet, { type LabelEntry } from "@/components/LabelSheet";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item: itemId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/labels");

  const OWNER = "PROPERTY OF TOPNOTCH EVENTS";

  let query = supabase
    .from("items")
    .select("id, name")
    .order("name");
  if (itemId) query = query.eq("id", itemId);
  const { data } = await query;
  const items = (data ?? []) as Pick<Item, "id" | "name">[];

  const entries: LabelEntry[] = items.map((i) => ({
    id: i.id,
    path: `/items/${i.id}`,
    title: i.name,
    subtitle: OWNER,
  }));

  // When printing the full sheet (not a single item), also include every
  // unassigned blank label so nothing is left out.
  if (!itemId) {
    const { data: blanks } = await supabase
      .from("labels")
      .select("id")
      .is("item_id", null)
      .order("created_at", { ascending: false });
    for (const l of blanks ?? []) {
      entries.push({
        id: l.id,
        path: `/t/${l.id}`,
        title: l.id.slice(0, 8).toUpperCase(),
        subtitle: OWNER,
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link
          href={itemId ? `/items/${itemId}` : "/admin"}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          {itemId ? "Print label" : "Print all labels"}
        </h1>
        {!itemId && (
          <div className="mt-1 flex flex-col gap-1">
            <Link
              href="/labels/blank"
              className="text-sm text-slate-600 underline"
            >
              Or print blank labels to assign later →
            </Link>
            <Link
              href="/labels/bins"
              className="text-sm text-slate-600 underline"
            >
              Or print bin labels (scan to move a whole bin) →
            </Link>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No items to print.</p>
      ) : (
        <LabelSheet
          entries={entries}
          hint={`${entries.length} label${
            entries.length === 1 ? "" : "s"
          } (every item plus all unassigned blanks). Print onto sticker sheets or paper.`}
        />
      )}
    </div>
  );
}
