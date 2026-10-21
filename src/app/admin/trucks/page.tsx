import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addTruck, deleteTruck } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function TrucksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/trucks");

  const { data } = await supabase.from("trucks").select("id, name").order("name");
  const trucks = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to staff area
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Trucks
        </h1>
        <p className="text-sm text-slate-500">
          Add the trucks you load gear onto. You pick from these on a
          tournament&apos;s page.
        </p>
      </div>

      <form action={addTruck} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            New truck
          </label>
          <input
            name="name"
            required
            placeholder="e.g. Truck 1, or a plate/name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
          Add
        </button>
      </form>

      {trucks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No trucks yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {trucks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-3">
              <Link
                href={`/admin/trucks/${t.id}`}
                className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
              >
                {t.name}
              </Link>
              <form action={deleteTruck}>
                <input type="hidden" name="id" value={t.id} />
                <button className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
