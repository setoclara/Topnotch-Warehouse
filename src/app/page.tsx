import Link from "next/link";
import type { ReactNode } from "react";
import { BoxIcon, TennisBallIcon, PaddleIcon } from "@/components/icons";

export const metadata = {
  title: "Topnotch — Welcome",
};

export default function WelcomePage() {
  return (
    <div className="space-y-8 py-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome to Topnotch
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Pick the area you&apos;re working in today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ChoiceCard
          href="/events"
          label="Events"
          description="Warehouse inventory & tournament gear"
          icon={<BoxIcon className="h-10 w-10" />}
        />
        <ChoiceCard
          href="/tennis"
          label="Tennis"
          description="Coming soon"
          icon={<TennisBallIcon className="h-10 w-10" />}
        />
        <ChoiceCard
          href="/pickleball"
          label="Pickleball"
          description="Coming soon"
          icon={<PaddleIcon className="h-10 w-10" />}
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-700 transition hover:border-slate-300 hover:shadow-md"
    >
      {icon}
      <span className="text-xl font-semibold text-slate-900">{label}</span>
      <span className="text-sm text-slate-500">{description}</span>
    </Link>
  );
}
