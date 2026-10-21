import Link from "next/link";
import ItemForm from "@/components/ItemForm";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ label?: string }>;
}) {
  const { label } = await searchParams;

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to staff area
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Add item
      </h1>
      {label && (
        <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
          This item will be linked to scanned label{" "}
          <span className="font-mono">{label.slice(0, 8).toUpperCase()}</span>.
        </p>
      )}
      <ItemForm labelCode={label} />
    </div>
  );
}
