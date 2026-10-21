import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assignLabel, assignLabelToBin } from "@/app/actions";
import { isSupabaseConfigured } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { code } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: label } = await supabase
    .from("labels")
    .select("id, item_id, bin")
    .eq("id", code)
    .maybeSingle();

  if (!label) {
    return (
      <div className="mx-auto max-w-md space-y-2 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Label not found</h1>
        <p className="text-sm text-slate-500">
          This code isn&apos;t recognized. It may have been deleted.
        </p>
        <Link href="/" className="text-sm text-slate-600 underline">
          Go to inventory
        </Link>
      </div>
    );
  }

  // Already assigned → jump straight to the item or the box.
  if (label.item_id) redirect(`/items/${label.item_id}`);
  if (label.bin) redirect(`/b/${encodeURIComponent(label.bin)}`);

  // Unassigned:
  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Label not assigned yet
        </h1>
        <p className="text-sm text-slate-500">
          Code {code.slice(0, 8).toUpperCase()} isn&apos;t linked yet. Staff can
          log in to assign it.
        </p>
        <Link
          href={`/login?next=/t/${code}`}
          className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Staff login
        </Link>
      </div>
    );
  }

  const [{ data: itemData }, { data: binData }] = await Promise.all([
    supabase.from("items").select("id, name, storage_bin").order("name"),
    supabase.from("item_bins").select("bin"),
  ]);
  const items = (itemData ?? []) as Pick<
    Item,
    "id" | "name" | "storage_bin"
  >[];
  const bins = [
    ...new Set(
      (binData ?? [])
        .map((r) => (r as { bin: string | null }).bin?.trim())
        .filter((b): b is string => !!b)
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-900 focus:outline-none";

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Assign this tag
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Code {code.slice(0, 8).toUpperCase()} — link it to a box or an item so
          future scans act on it.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Assign to a box (bin) */}
      <form
        action={assignLabelToBin}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="code" value={code} />
        <label className="block text-sm font-medium text-slate-700">
          Assign to a box (bin)
        </label>
        <input
          name="bin"
          list="bin-options"
          required
          placeholder="Type a box name, e.g. 7 — or pick one"
          className={inputCls}
        />
        <datalist id="bin-options">
          {bins.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <p className="text-xs text-slate-400">
          Scanning this tag later will move the whole box in whatever mode you
          pick.
        </p>
        <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700">
          Assign to box
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or an item
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Assign to an item */}
      <form
        action={assignLabel}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="code" value={code} />
        <label className="block text-sm font-medium text-slate-700">
          Link to an existing item
        </label>
        <select name="item_id" required className={inputCls}>
          <option value="">Select an item…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {i.storage_bin ? ` — Bin ${i.storage_bin}` : ""}
            </option>
          ))}
        </select>
        <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700">
          Assign to item
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm text-slate-500">or</p>
        <Link
          href={`/admin/items/new?label=${code}`}
          className="mt-1 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Create a new item for this tag
        </Link>
      </div>
    </div>
  );
}
