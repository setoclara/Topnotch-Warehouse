import Link from "next/link";
import { TennisBallIcon } from "@/components/icons";

export const metadata = {
  title: "Tennis — Topnotch",
};

export default function TennisPage() {
  return (
    <div className="space-y-6 py-6 text-center">
      <TennisBallIcon className="mx-auto h-12 w-12 text-slate-400" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tennis
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Coming soon — nothing to see here yet.
        </p>
      </div>
      <Link href="/" className="inline-block text-sm text-slate-600 underline">
        ← Back to the hub
      </Link>
    </div>
  );
}
