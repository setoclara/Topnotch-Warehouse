import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ItemForm from "@/components/ItemForm";
import { deleteItem } from "@/app/actions";
import type { Item, ItemBin } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: binData }] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).single(),
    supabase
      .from("item_bins")
      .select("bin, quantity")
      .eq("item_id", id)
      .order("bin"),
  ]);
  if (!data) notFound();
  const item = data as Item;
  const bins = (binData ?? []) as ItemBin[];

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/items/${id}`}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to item
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Edit item
      </h1>
      <ItemForm item={item} bins={bins} />

      <form
        action={deleteItem}
        className="mt-8 border-t border-slate-200 pt-4"
      >
        <input type="hidden" name="item_id" value={id} />
        <button className="text-sm text-red-600 hover:underline">
          Delete this item
        </button>
      </form>
    </div>
  );
}
