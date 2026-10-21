import Link from "next/link";
import { PaddleIcon } from "@/components/icons";

export const metadata = {
  title: "Pickleball — Topnotch",
};

export default function PickleballPage() {
  return (
    <div className="space-y-6 py-6 text-center">
      <PaddleIcon className="mx-auto h-12 w-12 text-slate-400" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Pickleball
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
