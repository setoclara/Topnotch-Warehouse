import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/format";

export default async function NavBar() {
  let signedIn = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-slate-900">
          Topnotch Digital Warehouse
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-1 text-sm">
          <Link
            href="/events"
            className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            Home
          </Link>
          <Link
            href="/tournaments"
            className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            Tracking
          </Link>
          <Link
            href="/scan"
            className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            Scan
          </Link>
          {signedIn ? (
            <>
              <Link
                href="/admin"
                className="rounded-md px-3 py-1.5 font-medium text-slate-900 hover:bg-slate-100"
              >
                Staff
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
            >
              Staff login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
