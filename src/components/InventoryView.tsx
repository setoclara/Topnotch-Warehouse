"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import AddMenu from "@/components/AddMenu";
import { SearchIcon, MapPinIcon } from "@/components/icons";
import type { ItemAvailability } from "@/lib/types";

const NO_BIN = "No bin assigned";

type TournamentOption = { id: string; name: string };
type GroupBy = "none" | "bin";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "packed", label: "In use" },
  { value: "staged", label: "Packed" },
  { value: "loaded", label: "Loaded" },
  { value: "arrived", label: "Arrived" },
];

export default function InventoryView({
  items,
  isStaff = false,
  tournaments = [],
  itemTournaments = {},
  itemStatuses = {},
}: {
  items: ItemAvailability[];
  isStaff?: boolean;
  tournaments?: TournamentOption[];
  itemTournaments?: Record<string, string[]>;
  itemStatuses?: Record<string, string[]>;
}) {
  const [query, setQuery] = useState("");
  // filter is "all" | "available" | "out" | "t:<tournamentId>"
  const [filter, setFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tournamentId = filter.startsWith("t:") ? filter.slice(2) : "";
    const statusFilter = filter.startsWith("s:") ? filter.slice(2) : "";
    return items.filter((i) => {
      if (filter === "available" && i.quantity_available <= 0) return false;
      if (filter === "out" && i.quantity_out <= 0) return false;
      if (statusFilter && !(itemStatuses[i.id] ?? []).includes(statusFilter))
        return false;
      if (tournamentId && !(itemTournaments[i.id] ?? []).includes(tournamentId))
        return false;
      const binText = (i.bins ?? [])
        .map((b) => b.bin)
        .join(" ")
        .toLowerCase();
      if (q && !i.name.toLowerCase().includes(q) && !binText.includes(q))
        return false;
      return true;
    });
  }, [items, query, filter, itemTournaments, itemStatuses]);

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, ItemAvailability[]>();
    const add = (key: string, item: ItemAvailability) => {
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    };
    for (const item of filtered) {
      const itemBins = (item.bins ?? [])
        .map((b) => b.bin.trim())
        .filter(Boolean);
      if (itemBins.length === 0) add(NO_BIN, item);
      // An item in several bins shows up under each of them.
      else for (const b of itemBins) add(b, item);
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === NO_BIN) return 1;
      if (b === NO_BIN) return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    return keys.map((name) => ({ name, items: map.get(name)! }));
  }, [filtered, groupBy]);

  // When searching, expand everything; otherwise honor collapse state.
  const searching = query.trim().length > 0;
  const isOpen = (key: string) => searching || expanded.has(key);
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selCls =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-slate-900 focus:outline-none";

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items or bins…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-slate-900 focus:outline-none"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-500">
          Show
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={selCls}
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="out">Checked out</option>
            <optgroup label="By status">
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={`s:${s.value}`}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            {tournaments.length > 0 && (
              <optgroup label="Out for tournament">
                {tournaments.map((t) => (
                  <option key={t.id} value={`t:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <label className="flex items-center gap-1 text-xs text-slate-500">
          Group by
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className={selCls}
          >
            <option value="none">List</option>
            <option value="bin">Bin</option>
          </select>
        </label>

        {isStaff && (
          <span className="ml-auto">
            <AddMenu />
          </span>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No items match your filters.
        </p>
      ) : groups ? (
        <div className="space-y-2 pt-1">
          {groups.map((group) => {
            const open = isOpen(group.name);
            const isBin = groupBy === "bin";
            const linkable = isStaff && isBin && group.name !== NO_BIN;
            const heading =
              isBin && group.name !== NO_BIN ? `Bin ${group.name}` : group.name;
            return (
              <section
                key={group.name}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggle(group.name)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Chevron open={open} />
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-800">
                      {isBin && group.name !== NO_BIN && (
                        <MapPinIcon className="h-4 w-4 shrink-0 text-slate-500" />
                      )}
                      <span className="truncate">{heading}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {group.items.length}
                    </span>
                  </button>
                  {linkable && (
                    <Link
                      href={`/admin/checkout?bin=${encodeURIComponent(
                        group.name
                      )}`}
                      className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      Check out
                    </Link>
                  )}
                </div>
                {open && (
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3">
                    {group.items.map((item) => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
        open ? "rotate-90" : ""
      }`}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
