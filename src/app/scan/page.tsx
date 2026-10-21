import Link from "next/link";
import Scanner from "@/components/Scanner";
import ModeScanner from "@/components/ModeScanner";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tournaments: { id: string; name: string }[] = [];
  let trucks: { id: string; name: string }[] = [];
  if (user) {
    const [{ data: tData }, { data: trucksData }] = await Promise.all([
      supabase
        .from("tournaments")
        .select("id, name")
        .order("start_date", { ascending: false }),
      supabase.from("trucks").select("id, name").order("name"),
    ]);
    tournaments = (tData ?? []) as { id: string; name: string }[];
    trucks = (trucksData ?? []) as { id: string; name: string }[];
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to inventory
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        {user ? "Scan" : "Scan an item"}
      </h1>

      {user ? (
        <>
          <p className="text-sm text-slate-500">
            Pick what you&apos;re doing, then scan each box or item — the status
            and location update automatically.
          </p>
          <ModeScanner tournaments={tournaments} trucks={trucks} />
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Anyone can scan to view an item. To receive, pack, or load items,
            sign in as staff.
          </p>
          <Scanner />
        </>
      )}
    </div>
  );
}
