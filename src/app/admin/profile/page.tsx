import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateDisplayName } from "@/app/actions";
import ChangePassword from "@/components/ChangePassword";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/profile");

  const currentName =
    (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to staff area
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Profile
        </h1>
        <p className="text-sm text-slate-500">Signed in as {user.email}</p>
      </div>

      <form
        action={updateDisplayName}
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <label className="block text-sm font-medium text-slate-700">
          Your name
        </label>
        <p className="text-xs text-slate-500">
          This is the &ldquo;person responsible&rdquo; name that auto-fills on
          items you check out.
        </p>
        <input
          name="name"
          defaultValue={currentName}
          placeholder="e.g. Clara"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
        />
        <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
          Save name
        </button>
      </form>

      <ChangePassword />
    </div>
  );
}
