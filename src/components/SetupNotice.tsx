export default function SetupNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h2 className="text-lg font-semibold">Almost there — connect the database</h2>
      <p className="mt-2 text-sm">
        The app is running, but it isn&apos;t connected to a Supabase project yet.
        Create a free Supabase project, then add its URL and anon key to a file
        called <code className="rounded bg-amber-100 px-1">.env.local</code> and
        restart the app.
      </p>
      <p className="mt-2 text-sm">
        See <code className="rounded bg-amber-100 px-1">.env.local.example</code> for
        the exact variable names.
      </p>
    </div>
  );
}
