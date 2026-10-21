"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayNameOf } from "@/lib/format";

type Supa = Awaited<ReturnType<typeof createClient>>;

// Resolve a scanned QR value (item URL, blank-tag URL, or bare id) to an item id.
async function resolveScanToItemId(
  supabase: Supa,
  code: string
): Promise<string | null> {
  const trimmed = code.trim();
  try {
    const url = new URL(trimmed);
    const itemMatch = url.pathname.match(/\/items\/([^/?#]+)/);
    if (itemMatch) return itemMatch[1];
    const tagMatch = url.pathname.match(/\/t\/([^/?#]+)/);
    if (tagMatch) {
      const { data } = await supabase
        .from("labels")
        .select("item_id")
        .eq("id", tagMatch[1])
        .maybeSingle();
      return data?.item_id ?? null;
    }
  } catch {
    // not a URL
  }
  if (/^[0-9a-f-]{16,}$/i.test(trimmed)) {
    const { data: it } = await supabase
      .from("items")
      .select("id")
      .eq("id", trimmed)
      .maybeSingle();
    if (it) return it.id;
    const { data: lbl } = await supabase
      .from("labels")
      .select("item_id")
      .eq("id", trimmed)
      .maybeSingle();
    return lbl?.item_id ?? null;
  }
  return null;
}

// What a single scan applies to every affected item. Built once, then run
// per item so a bin QR can move a whole bin at once.
//
// Statuses walk a fixed sequence, and a scan only advances lines that are at
// the right prior stage — so scanning a box in Load mode won't touch a unit
// that's still "In use" (it never made it into the box).
//   In use (packed) → Packed (staged) → Loaded (loaded) → Received
type ScanPlan = {
  label: string; // shown on the confirmation screen, e.g. "Packed"
  past: string; // short verb for bin summaries, e.g. "packed"
  checkin: boolean; // true = return to warehouse (check in) instead of updating
  update: Record<string, unknown>;
  insertTournamentId: string | null; // tournament for a freshly-created checkout
  fromStatuses: string[]; // a line must currently be one of these to advance
  allowCreate: boolean; // create a fresh line when nothing is out yet
  needsLabel: string; // the prior stage, for "not X yet" skip messages
};

async function buildScanPlan(
  supabase: Supa,
  mode: string,
  context: string
): Promise<ScanPlan | null> {
  // Receiving is flexible — it's the destination, not a transport step:
  //   to the warehouse = check in whatever's out
  //   to a tournament  = mark it in use there (fresh gear too)
  const anyStage = ["packed", "staged", "loaded", "arrived"];
  if (mode === "receive" && context === "warehouse") {
    return {
      label: "Returned to warehouse",
      past: "returned to warehouse",
      checkin: true,
      update: {},
      insertTournamentId: null,
      fromStatuses: anyStage,
      allowCreate: false,
      needsLabel: "out",
    };
  }
  if (mode === "receive") {
    const tName = context ? await tournamentNameOf(supabase, context) : "";
    return {
      label: tName ? `In use at ${tName}` : "In use",
      past: "in use",
      checkin: false,
      update: {
        tournament_id: context || null,
        status: "packed",
        truck_id: null,
        arrived_location: null,
      },
      insertTournamentId: context || null,
      fromStatuses: anyStage,
      allowCreate: true,
      needsLabel: "out",
    };
  }
  if (mode === "pack") {
    return {
      label: "Packed",
      past: "packed",
      checkin: false,
      update: { status: "staged" },
      insertTournamentId: null,
      fromStatuses: ["packed"],
      allowCreate: true,
      needsLabel: "in use",
    };
  }
  if (mode === "load") {
    const truckName = context ? await truckNameOf(supabase, context) : "";
    return {
      label: truckName ? `Loaded onto ${truckName}` : "Loaded",
      past: "loaded",
      checkin: false,
      update: { status: "loaded", truck_id: context || null },
      insertTournamentId: null,
      fromStatuses: ["staged"],
      allowCreate: false,
      needsLabel: "packed",
    };
  }
  return null;
}

// Why a line couldn't advance — kept specific for the "still in use" case.
function scanSkipNote(
  name: string,
  openStatuses: string[],
  plan: ScanPlan
): string {
  if (openStatuses.length === 0) return `${name}: nothing out`;
  if (plan.needsLabel === "packed" && openStatuses.includes("packed"))
    return `${name}: still in use — left as-is`;
  return `${name}: not ${plan.needsLabel} yet — left as-is`;
}

// Apply a plan to one item, advancing only the checkout lines that are at the
// right prior stage. Returns whether anything changed and a per-item note.
async function applyPlanToItem(
  supabase: Supa,
  itemId: string,
  name: string,
  available: number,
  plan: ScanPlan,
  person: string | null
): Promise<{ ok: boolean; note: string }> {
  const { data: openData } = await supabase
    .from("checkouts")
    .select("id, status")
    .eq("item_id", itemId)
    .is("checked_in_at", null);
  const openLines = (openData ?? []) as { id: string; status: string | null }[];
  const openStatuses = openLines.map((l) => l.status ?? "packed");
  const eligibleIds = openLines
    .filter((l) => plan.fromStatuses.includes(l.status ?? "packed"))
    .map((l) => l.id);

  if (plan.checkin) {
    if (eligibleIds.length === 0)
      return { ok: false, note: scanSkipNote(name, openStatuses, plan) };
    await supabase
      .from("checkouts")
      .update({
        checked_in_at: new Date().toISOString(),
        person_responsible: person,
      })
      .in("id", eligibleIds);
    return { ok: true, note: `${name} — ${plan.label}` };
  }

  if (eligibleIds.length > 0) {
    await supabase
      .from("checkouts")
      .update({ ...plan.update, person_responsible: person })
      .in("id", eligibleIds);
    return { ok: true, note: `${name} — ${plan.label}` };
  }

  // Nothing at the right stage. Only start a fresh line if this mode allows it
  // and the item isn't out at all (e.g. packing stock straight off the shelf).
  if (plan.allowCreate && openLines.length === 0 && available > 0) {
    await supabase.from("checkouts").insert({
      item_id: itemId,
      quantity: available,
      tournament_id: plan.insertTournamentId,
      person_responsible: person,
      ...plan.update,
    });
    return { ok: true, note: `${name} — ${plan.label}` };
  }

  return { ok: false, note: scanSkipNote(name, openStatuses, plan) };
}

// Mode-based scanning: apply a status/location change to a scanned item OR bin.
//   mode "receive"  + context "warehouse"  → check in (returned to warehouse)
//   mode "receive"  + context <tournament> → in use at that tournament
//   mode "pack"                            → packed
//   mode "load"     + context <truck>      → loaded on that truck
// A bin QR ("/b/<bin>") applies the same action to every item in that bin.
export async function applyScan(
  code: string,
  mode: string,
  context: string
): Promise<{ ok: boolean; message: string; assignHref?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in." };
  const person = displayNameOf(user) || null;

  const plan = await buildScanPlan(supabase, mode, context);
  if (!plan) return { ok: false, message: "Unknown mode." };

  const revalidateCommon = () => {
    revalidatePath("/events");
    revalidatePath("/admin");
    revalidatePath("/tournaments");
  };

  // A scanned tag may be assigned to a bin or an item (or still blank).
  const labelId = labelIdFromScan(code);
  const labelRow = labelId
    ? (
        await supabase
          .from("labels")
          .select("item_id, bin")
          .eq("id", labelId)
          .maybeSingle()
      ).data
    : null;

  // Is this a bin QR (a "/b/…" code, or a tag assigned to a bin)? If so, act
  // on every item in the bin.
  const bin = binFromScan(code) ?? labelRow?.bin ?? null;
  if (bin) {
    const ids = await itemIdsInBin(supabase, bin);
    if (ids.length === 0)
      return { ok: false, message: `Bin ${bin} has no items.` };
    const { data: rows } = await supabase
      .from("item_availability")
      .select("id, name, quantity_available")
      .in("id", ids)
      .order("name");
    const items = (rows ?? []) as {
      id: string;
      name: string;
      quantity_available: number;
    }[];
    if (items.length === 0)
      return { ok: false, message: `Bin ${bin} has no items.` };

    let done = 0;
    let skipped = 0;
    for (const it of items) {
      const r = await applyPlanToItem(
        supabase,
        it.id,
        it.name,
        it.quantity_available,
        plan,
        person
      );
      if (r.ok) {
        done++;
        revalidatePath(`/items/${it.id}`);
      } else {
        skipped++;
      }
    }
    revalidateCommon();
    const msg =
      `Bin ${bin} — ${done} item${done === 1 ? "" : "s"} ${plan.past}` +
      (skipped > 0
        ? plan.needsLabel === "out"
          ? ` · ${skipped} not out`
          : ` · ${skipped} left as-is (not ${plan.needsLabel})`
        : "");
    return { ok: done > 0, message: msg };
  }

  // Otherwise a single item.
  const itemId = await resolveScanToItemId(supabase, code);
  if (!itemId) {
    // A real but unassigned tag → offer to assign it to a box or item.
    if (labelId && labelRow) {
      return {
        ok: false,
        message: "This tag isn't assigned yet.",
        assignHref: `/t/${labelId}`,
      };
    }
    return { ok: false, message: "QR code not recognized." };
  }

  const { data: item } = await supabase
    .from("item_availability")
    .select("name, quantity_available")
    .eq("id", itemId)
    .single();
  if (!item) return { ok: false, message: "Item not found." };

  const r = await applyPlanToItem(
    supabase,
    itemId,
    item.name,
    item.quantity_available,
    plan,
    person
  );
  revalidatePath(`/items/${itemId}`);
  revalidateCommon();
  return { ok: r.ok, message: r.note };
}

// Keep an item's bin counts from exceeding its total. When the total drops
// (a write-off), trim the bins — largest first — so the counts stay honest.
async function reconcileItemBins(supabase: Supa, itemId: string) {
  const { data: item } = await supabase
    .from("items")
    .select("total_quantity")
    .eq("id", itemId)
    .single();
  if (!item) return;

  const { data: binRows } = await supabase
    .from("item_bins")
    .select("id, quantity")
    .eq("item_id", itemId)
    .order("quantity", { ascending: false });
  const bins = (binRows ?? []) as { id: string; quantity: number }[];

  const sum = bins.reduce((n, b) => n + b.quantity, 0);
  let excess = sum - item.total_quantity;
  if (excess <= 0) return;

  for (const b of bins) {
    if (excess <= 0) break;
    const dec = Math.min(b.quantity, excess);
    if (dec > 0) {
      await supabase
        .from("item_bins")
        .update({ quantity: b.quantity - dec })
        .eq("id", b.id);
      excess -= dec;
    }
  }
}

// All item ids that have units stored in a given bin.
async function itemIdsInBin(supabase: Supa, bin: string): Promise<string[]> {
  const { data } = await supabase
    .from("item_bins")
    .select("item_id")
    .eq("bin", bin);
  return [
    ...new Set(
      (data ?? []).map((r) => (r as { item_id: string }).item_id)
    ),
  ];
}

// Pull a bin name out of a "/b/<bin>" QR value, or null if it isn't one.
function binFromScan(code: string): string | null {
  const trimmed = code.trim();
  try {
    const url = new URL(trimmed);
    const m = url.pathname.match(/\/b\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {
    // not a URL
  }
  return null;
}

// Pull a blank-tag label id out of a "/t/<id>" QR value (or a bare id).
function labelIdFromScan(code: string): string | null {
  const trimmed = code.trim();
  try {
    const url = new URL(trimmed);
    const m = url.pathname.match(/\/t\/([^/?#]+)/);
    if (m) return m[1];
  } catch {
    // not a URL
  }
  if (/^[0-9a-f-]{16,}$/i.test(trimmed)) return trimmed;
  return null;
}

// Assign a scanned blank tag to a bin (box). After this, scanning the tag
// behaves like that box's QR.
export async function assignLabelToBin(formData: FormData) {
  const supabase = await createClient();
  const code = String(formData.get("code") ?? "").trim();
  const bin = String(formData.get("bin") ?? "").trim();
  if (!code || !bin) {
    redirect(`/t/${code}?error=Enter+a+box+name.`);
  }
  await supabase.from("labels").update({ bin, item_id: null }).eq("id", code);
  revalidatePath("/labels/blank");
  redirect(`/b/${encodeURIComponent(bin)}`);
}

async function tournamentNameOf(supabase: Supa, id: string): Promise<string> {
  const { data } = await supabase
    .from("tournaments")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return data?.name ?? "";
}

async function truckNameOf(supabase: Supa, id: string): Promise<string> {
  const { data } = await supabase
    .from("trucks")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return data?.name ?? "";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/events");
}

// Save the signed-in user's display name (used to auto-fill "person responsible").
export async function updateDisplayName(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/profile");
}

// --- Tournaments ---
export async function createTournament(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("tournaments").insert({
    name: String(formData.get("name") ?? "").trim(),
    location: emptyToNull(formData.get("location")),
    start_date: emptyToNull(formData.get("start_date")),
    end_date: emptyToNull(formData.get("end_date")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/tournaments");
  redirect("/tournaments");
}

export async function deleteTournament(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tournaments");
  revalidatePath("/events");
  redirect("/tournaments");
}

// --- Checkouts (gear leaving the warehouse) ---
export async function checkOut(formData: FormData) {
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const quantity = Number(formData.get("quantity") ?? 1);
  const redirectTo = String(formData.get("redirect_to") ?? "");
  const back = redirectTo || "/admin/checkout";
  const fail = (msg: string) =>
    redirect(`${back}?error=${encodeURIComponent(msg)}`);

  if (!itemId) fail("Pick an item to check out.");
  if (!Number.isInteger(quantity) || quantity < 1) {
    fail("Quantity must be a whole number of at least 1.");
  }

  // Never allow checking out more than is actually available.
  const { data: avail } = await supabase
    .from("item_availability")
    .select("quantity_available")
    .eq("id", itemId)
    .single();
  const available = avail?.quantity_available ?? 0;
  if (quantity > available) {
    fail(
      available <= 0
        ? "None available — every one of these is already checked out."
        : `Only ${available} available — you can't check out ${quantity}.`
    );
  }

  const { error } = await supabase.from("checkouts").insert({
    item_id: itemId,
    tournament_id: emptyToNull(formData.get("tournament_id")),
    quantity,
    person_responsible: emptyToNull(formData.get("person_responsible")),
    notes: emptyToNull(formData.get("notes")),
  });
  if (error) fail(error.message);

  revalidatePath("/events");
  revalidatePath("/admin");
  if (itemId) revalidatePath(`/items/${itemId}`);
  const tid = formData.get("tournament_id");
  if (tid) revalidatePath(`/tournaments/${tid}`);
  redirect(redirectTo || "/admin?done=checked-out");
}

// Check out an entire bin (box) at once: every item in the bin, in whatever
// quantity is currently available, all assigned to the same person/tournament.
export async function checkOutBin(formData: FormData) {
  const supabase = await createClient();
  const bin = String(formData.get("bin") ?? "").trim();
  const fail = (msg: string) =>
    redirect(`/admin/checkout?error=${encodeURIComponent(msg)}`);

  if (!bin) fail("Pick a bin to check out.");

  const binIds = await itemIdsInBin(supabase, bin);
  const { data: items } = binIds.length
    ? await supabase
        .from("item_availability")
        .select("id, quantity_available")
        .in("id", binIds)
    : { data: [] };

  const toCheckout = (items ?? []).filter((i) => i.quantity_available > 0);
  if (toCheckout.length === 0) {
    fail(`Nothing available to check out in bin "${bin}".`);
  }

  const tournamentId = emptyToNull(formData.get("tournament_id"));
  const person = emptyToNull(formData.get("person_responsible"));
  const notes = emptyToNull(formData.get("notes"));

  const rows = toCheckout.map((i) => ({
    item_id: i.id,
    tournament_id: tournamentId,
    quantity: i.quantity_available,
    person_responsible: person,
    notes,
  }));

  const { error } = await supabase.from("checkouts").insert(rows);
  if (error) fail(error.message);

  revalidatePath("/events");
  revalidatePath("/admin");
  if (tournamentId) revalidatePath(`/tournaments/${tournamentId}`);
  redirect(
    `/admin?done=${encodeURIComponent(
      `Checked out ${rows.length} item${rows.length === 1 ? "" : "s"} from bin ${bin}.`
    )}`
  );
}

// Check an entire bin (box) back in: return every item in the bin that's
// currently out, in one action.
export async function checkInBin(formData: FormData) {
  const supabase = await createClient();
  const bin = String(formData.get("bin") ?? "").trim();
  const fail = (msg: string) =>
    redirect(`/admin/checkout?error=${encodeURIComponent(msg)}`);

  if (!bin) fail("Pick a bin to check in.");

  const ids = await itemIdsInBin(supabase, bin);
  if (ids.length === 0) fail(`No items found in bin "${bin}".`);

  const { data: updated, error } = await supabase
    .from("checkouts")
    .update({ checked_in_at: new Date().toISOString() })
    .in("item_id", ids)
    .is("checked_in_at", null)
    .select("id");
  if (error) fail(error.message);

  const count = updated?.length ?? 0;
  revalidatePath("/events");
  revalidatePath("/admin");
  redirect(
    `/admin?done=${encodeURIComponent(
      count === 0
        ? `Nothing was out in bin ${bin}.`
        : `Checked in ${count} item${count === 1 ? "" : "s"} from bin ${bin}.`
    )}`
  );
}

// --- Check gear back in (returned to warehouse) ---
export async function checkIn(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("checkout_id"));
  const { error } = await supabase
    .from("checkouts")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath("/admin");
  const tid = formData.get("tournament_id");
  if (tid) revalidatePath(`/tournaments/${tid}`);
}

// Check a given quantity of an item back in, across its open check-outs
// (oldest first), splitting a check-out if only part of it is returned.
export async function checkInQuantity(formData: FormData) {
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  let remaining = Number(formData.get("quantity") ?? 0);
  if (!itemId || remaining <= 0) return;

  const { data: open } = await supabase
    .from("checkouts")
    .select(
      "id, quantity, tournament_id, person_responsible, checked_out_at, notes"
    )
    .eq("item_id", itemId)
    .is("checked_in_at", null)
    .order("checked_out_at", { ascending: true });

  const now = new Date().toISOString();
  for (const c of open ?? []) {
    if (remaining <= 0) break;
    if (c.quantity <= remaining) {
      await supabase.from("checkouts").update({ checked_in_at: now }).eq("id", c.id);
      remaining -= c.quantity;
    } else {
      // Partial return: shrink the open row, add a returned row for the part back.
      await supabase
        .from("checkouts")
        .update({ quantity: c.quantity - remaining })
        .eq("id", c.id);
      await supabase.from("checkouts").insert({
        item_id: itemId,
        tournament_id: c.tournament_id,
        quantity: remaining,
        person_responsible: c.person_responsible,
        checked_out_at: c.checked_out_at,
        checked_in_at: now,
        notes: c.notes,
      });
      remaining = 0;
    }
  }

  revalidatePath("/events");
  revalidatePath("/admin");
  revalidatePath(`/items/${itemId}`);
}

// --- Blank pre-printed labels (assign to an item later, after scanning) ---
export async function createBlankLabels(formData: FormData) {
  const supabase = await createClient();
  const count = Math.min(Math.max(Number(formData.get("count") ?? 0), 1), 100);
  const rows = Array.from({ length: count }, () => ({ item_id: null }));
  const { error } = await supabase.from("labels").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/labels/blank");
  redirect(`/labels/blank?created=${count}`);
}

export async function assignLabel(formData: FormData) {
  const supabase = await createClient();
  const code = String(formData.get("code"));
  const itemId = String(formData.get("item_id"));
  const { error } = await supabase
    .from("labels")
    .update({ item_id: itemId })
    .eq("id", code);
  if (error) throw new Error(error.message);

  await bumpQuantityToLabelCount(supabase, itemId);

  revalidatePath(`/t/${code}`);
  revalidatePath("/events");
  revalidatePath(`/items/${itemId}`);
  redirect(`/items/${itemId}`);
}

// Callable from the client after creating a new item for a scanned blank label.
export async function syncItemQuantityWithLabels(itemId: string) {
  const supabase = await createClient();
  await bumpQuantityToLabelCount(supabase, itemId);
  revalidatePath("/events");
  revalidatePath(`/items/${itemId}`);
}

/**
 * Each QR label is stuck on one physical unit, so the number of labels
 * assigned to an item is a floor for how many we own. If we have more
 * labels than the recorded quantity, the quantity is stale — raise it.
 * Never lowers the quantity.
 */
async function bumpQuantityToLabelCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string
) {
  if (!itemId) return;

  const { count } = await supabase
    .from("labels")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);
  const labelCount = count ?? 0;
  if (labelCount === 0) return;

  const { data: item } = await supabase
    .from("items")
    .select("total_quantity")
    .eq("id", itemId)
    .single();
  if (!item) return;

  if (labelCount > item.total_quantity) {
    await supabase
      .from("items")
      .update({ total_quantity: labelCount })
      .eq("id", itemId);
  }
}

// Mark an item that is currently OUT as lost / used up (it never comes back).
// Closes the checkout as "lost" and permanently reduces how many we own.
export async function writeOffCheckout(formData: FormData) {
  const supabase = await createClient();
  const checkoutId = String(formData.get("checkout_id"));
  const itemId = String(formData.get("item_id"));
  const rawQty = formData.get("quantity");

  const { data: c } = await supabase
    .from("checkouts")
    .select("quantity, checked_in_at")
    .eq("id", checkoutId)
    .single();
  if (!c) return;

  // How many units are being written off — default to the whole line.
  const requested = rawQty != null ? Number(rawQty) : c.quantity;
  const writeOffQty = Math.max(
    1,
    Math.min(Number.isFinite(requested) ? requested : c.quantity, c.quantity)
  );

  // Only reduce the total if it was still out (avoid double-counting).
  if (!c.checked_in_at && itemId && writeOffQty > 0) {
    const { data: item } = await supabase
      .from("items")
      .select("total_quantity")
      .eq("id", itemId)
      .single();
    if (item) {
      await supabase
        .from("items")
        .update({
          total_quantity: Math.max(item.total_quantity - writeOffQty, 0),
        })
        .eq("id", itemId);
    }
  }

  if (writeOffQty >= c.quantity) {
    // Whole line is gone — drop it off the "currently out" list.
    await supabase.from("checkouts").delete().eq("id", checkoutId);
  } else {
    // Only some units are lost — shrink the line, keep the rest out.
    await supabase
      .from("checkouts")
      .update({ quantity: c.quantity - writeOffQty })
      .eq("id", checkoutId);
  }

  // Lost units no longer live in any bin — trim the bin counts to match.
  if (!c.checked_in_at && itemId) await reconcileItemBins(supabase, itemId);

  revalidatePath("/events");
  revalidatePath("/admin");
  if (itemId) revalidatePath(`/items/${itemId}`);
  const tid = formData.get("tournament_id");
  if (tid) revalidatePath(`/tournaments/${tid}`);
}

// Write off warehouse stock that was used up / lost / damaged (not checked out).
export async function writeOffStock(formData: FormData) {
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const quantity = Number(formData.get("quantity") ?? 0);
  const back = `/items/${itemId}`;
  const fail = (m: string) => redirect(`${back}?error=${encodeURIComponent(m)}`);

  if (!itemId || !Number.isInteger(quantity) || quantity < 1) {
    fail("Enter how many to write off (1 or more).");
  }

  const { data: avail } = await supabase
    .from("item_availability")
    .select("quantity_available, total_quantity")
    .eq("id", itemId)
    .single();
  const available = avail?.quantity_available ?? 0;
  if (quantity > available) {
    fail(
      `Only ${available} in the warehouse — can't write off ${quantity}. (For gear that's currently checked out, use "Lost/used" in the Currently out list.)`
    );
  }

  await supabase
    .from("items")
    .update({ total_quantity: Math.max((avail?.total_quantity ?? 0) - quantity, 0) })
    .eq("id", itemId);

  revalidatePath("/events");
  revalidatePath(back);
  redirect(`${back}?done=written-off`);
}

// Permanently remove a check-out / check-in entry (e.g. to fix a mistake).
export async function deleteCheckout(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("checkout_id"));
  const { error } = await supabase.from("checkouts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath("/admin");
  const itemId = formData.get("item_id");
  if (itemId) revalidatePath(`/items/${itemId}`);
  const tid = formData.get("tournament_id");
  if (tid) revalidatePath(`/tournaments/${tid}`);
}

export async function deleteItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("item_id"));
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  redirect("/admin");
}

// --- Packing lists ---
export async function createPackingList(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin/packing/new?error=Name+is+required");
  const { data, error } = await supabase
    .from("packing_lists")
    .insert({
      name,
      tournament_id: emptyToNull(formData.get("tournament_id")),
    })
    .select("id")
    .single();
  if (error) redirect(`/admin/packing/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/packing");
  redirect(`/admin/packing/${data!.id}`);
}

export async function addPackingItem(formData: FormData) {
  const supabase = await createClient();
  const listId = String(formData.get("list_id"));
  const itemId = String(formData.get("item_id"));
  const quantity = Math.max(Number(formData.get("quantity") ?? 1), 1);
  if (!listId || !itemId) return;
  const { error } = await supabase.from("packing_list_items").insert({
    list_id: listId,
    item_id: itemId,
    quantity,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/packing/${listId}`);
}

export async function togglePacked(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const listId = String(formData.get("list_id"));
  const packed = String(formData.get("packed")) === "true";
  const { error } = await supabase
    .from("packing_list_items")
    .update({ packed })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/packing/${listId}`);
}

export async function deletePackingItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const listId = String(formData.get("list_id"));
  const { error } = await supabase
    .from("packing_list_items")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/packing/${listId}`);
}

export async function deletePackingList(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("packing_lists").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/packing");
  redirect("/admin/packing");
}

// ============================================================
// Trucks & movement status (Packed → Loaded → Arrived), shown on tournaments
// ============================================================
export async function addTruck(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const tournamentId = String(formData.get("tournament_id") ?? "");
  if (!name) return;
  await supabase.from("trucks").insert({ name });
  revalidatePath("/admin/trucks");
  if (tournamentId) revalidatePath(`/tournaments/${tournamentId}`);
}

export async function deleteTruck(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("trucks").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/trucks");
}

// Load some or all of a checked-out line onto a truck. If loading fewer than
// the whole line, it splits: the loaded quantity becomes its own "loaded" line
// and the rest stays "in use".
export async function loadCheckout(formData: FormData) {
  const supabase = await createClient();
  const checkoutId = String(formData.get("checkout_id"));
  const truckId = emptyToNull(formData.get("truck_id"));
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const loadQty = Number(formData.get("quantity") ?? 0);

  const { data: c } = await supabase
    .from("checkouts")
    .select(
      "quantity, item_id, tournament_id, person_responsible, checked_out_at, notes"
    )
    .eq("id", checkoutId)
    .single();
  if (!c) return;

  const qty =
    !loadQty || loadQty <= 0 || loadQty >= c.quantity ? c.quantity : loadQty;

  if (qty >= c.quantity) {
    await supabase
      .from("checkouts")
      .update({ status: "loaded", truck_id: truckId })
      .eq("id", checkoutId);
  } else {
    // Partial load: shrink the in-use line, add a loaded line for `qty`.
    await supabase
      .from("checkouts")
      .update({ quantity: c.quantity - qty })
      .eq("id", checkoutId);
    await supabase.from("checkouts").insert({
      item_id: c.item_id,
      tournament_id: c.tournament_id,
      quantity: qty,
      person_responsible: c.person_responsible,
      checked_out_at: c.checked_out_at,
      notes: c.notes,
      status: "loaded",
      truck_id: truckId,
    });
  }

  revalidatePath("/events");
  revalidatePath("/admin");
  if (truckId) revalidatePath(`/admin/trucks/${truckId}`);
  if (tournamentId) revalidatePath(`/tournaments/${tournamentId}`);
}

// Move some or all of a line from "in use" to "packed" (ready to load).
// Splits like loadCheckout when packing fewer than the whole line.
export async function packCheckout(formData: FormData) {
  const supabase = await createClient();
  const checkoutId = String(formData.get("checkout_id"));
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const packQty = Number(formData.get("quantity") ?? 0);

  const { data: c } = await supabase
    .from("checkouts")
    .select(
      "quantity, item_id, tournament_id, person_responsible, checked_out_at, notes"
    )
    .eq("id", checkoutId)
    .single();
  if (!c) return;

  const qty =
    !packQty || packQty <= 0 || packQty >= c.quantity ? c.quantity : packQty;

  if (qty >= c.quantity) {
    await supabase
      .from("checkouts")
      .update({ status: "staged" })
      .eq("id", checkoutId);
  } else {
    await supabase
      .from("checkouts")
      .update({ quantity: c.quantity - qty })
      .eq("id", checkoutId);
    await supabase.from("checkouts").insert({
      item_id: c.item_id,
      tournament_id: c.tournament_id,
      quantity: qty,
      person_responsible: c.person_responsible,
      checked_out_at: c.checked_out_at,
      notes: c.notes,
      status: "staged",
    });
  }
  revalidatePath("/events");
  revalidatePath("/admin");
  if (tournamentId) revalidatePath(`/tournaments/${tournamentId}`);
}

// Load every not-yet-loaded line in a bin (for this tournament) onto a truck.
export async function loadBinToTruck(formData: FormData) {
  const supabase = await createClient();
  const tournamentId = String(formData.get("tournament_id"));
  const bin = String(formData.get("bin") ?? "").trim();
  const truckId = emptyToNull(formData.get("truck_id"));
  if (!tournamentId || !bin) return;
  const ids = await itemIdsInBin(supabase, bin);
  if (ids.length === 0) return;
  await supabase
    .from("checkouts")
    .update({ status: "loaded", truck_id: truckId })
    .eq("tournament_id", tournamentId)
    .is("checked_in_at", null)
    .in("status", ["packed", "staged"])
    .in("item_id", ids);
  revalidatePath("/admin");
  revalidatePath(`/tournaments/${tournamentId}`);
}

// Mark a loaded line as arrived at a location.
export async function arriveCheckout(formData: FormData) {
  const supabase = await createClient();
  const checkoutId = String(formData.get("checkout_id"));
  const arrivedLocation =
    String(formData.get("arrived_location") ?? "").trim() || null;
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await supabase
    .from("checkouts")
    .update({ status: "arrived", arrived_location: arrivedLocation })
    .eq("id", checkoutId);
  revalidatePath("/admin");
  if (tournamentId) revalidatePath(`/tournaments/${tournamentId}`);
}

// Arrive one loaded line at a destination:
//  - "warehouse" → check it in (final destination)
//  - a tournament id → transfer it to that tournament (off the truck, ready there)
async function arriveOne(
  supabase: Awaited<ReturnType<typeof createClient>>,
  checkoutId: string,
  destination: string
) {
  if (destination === "warehouse") {
    await supabase
      .from("checkouts")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", checkoutId);
  } else {
    await supabase
      .from("checkouts")
      .update({
        tournament_id: destination,
        truck_id: null,
        status: "packed",
        arrived_location: null,
      })
      .eq("id", checkoutId);
  }
}

export async function arriveItemTo(formData: FormData) {
  const supabase = await createClient();
  const checkoutId = String(formData.get("checkout_id"));
  const destination = String(formData.get("destination") ?? "");
  const truckId = String(formData.get("truck_id") ?? "");
  if (!checkoutId || !destination) return;
  await arriveOne(supabase, checkoutId, destination);
  revalidatePath("/events");
  revalidatePath("/admin");
  revalidatePath("/tournaments");
  if (truckId) revalidatePath(`/admin/trucks/${truckId}`);
  if (destination !== "warehouse") revalidatePath(`/tournaments/${destination}`);
}

// Arrive an entire truck's load at one destination.
export async function arriveTruckTo(formData: FormData) {
  const supabase = await createClient();
  const truckId = String(formData.get("truck_id"));
  const destination = String(formData.get("destination") ?? "");
  if (!truckId || !destination) return;

  if (destination === "warehouse") {
    await supabase
      .from("checkouts")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("truck_id", truckId)
      .is("checked_in_at", null);
  } else {
    await supabase
      .from("checkouts")
      .update({
        tournament_id: destination,
        truck_id: null,
        status: "packed",
        arrived_location: null,
      })
      .eq("truck_id", truckId)
      .is("checked_in_at", null);
  }
  revalidatePath("/events");
  revalidatePath("/admin");
  revalidatePath("/tournaments");
  revalidatePath(`/admin/trucks/${truckId}`);
  if (destination !== "warehouse") revalidatePath(`/tournaments/${destination}`);
}

// Move a line back to "packed" (undo loaded/arrived).
export async function resetStatus(formData: FormData) {
  const supabase = await createClient();
  const checkoutId = String(formData.get("checkout_id"));
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await supabase
    .from("checkouts")
    .update({ status: "packed", truck_id: null, arrived_location: null })
    .eq("id", checkoutId);
  if (tournamentId) revalidatePath(`/tournaments/${tournamentId}`);
}

// Merge duplicate item records into one. Quantities and bins are combined,
// and all check-out history + QR labels move to the primary item.
export async function mergeItems(formData: FormData) {
  const supabase = await createClient();
  const primaryId = String(formData.get("primary_id") ?? "").trim();
  const duplicateIds = String(formData.get("duplicate_ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id && id !== primaryId);

  if (!primaryId || duplicateIds.length === 0) {
    redirect("/admin/merge?error=Pick+at+least+two+entries+to+merge.");
  }
  const allIds = [primaryId, ...duplicateIds];

  // New total = sum of every merged entry's total quantity.
  const { data: itemRows } = await supabase
    .from("items")
    .select("id, total_quantity")
    .in("id", allIds);
  const newTotal = (itemRows ?? []).reduce(
    (n, r) => n + (r.total_quantity ?? 0),
    0
  );

  // Combine bins across all entries, summing counts per bin.
  const { data: binRows } = await supabase
    .from("item_bins")
    .select("bin, quantity")
    .in("item_id", allIds);
  const binMap = new Map<string, number>();
  for (const b of binRows ?? []) {
    const bin = (b as { bin: string }).bin;
    binMap.set(bin, (binMap.get(bin) ?? 0) + ((b as { quantity: number }).quantity ?? 0));
  }

  // Move history and labels onto the primary item.
  await supabase
    .from("checkouts")
    .update({ item_id: primaryId })
    .in("item_id", duplicateIds);
  await supabase
    .from("labels")
    .update({ item_id: primaryId })
    .in("item_id", duplicateIds);

  // Rebuild the primary item's bins from the combined set.
  await supabase.from("item_bins").delete().in("item_id", allIds);
  const merged = [...binMap.entries()].map(([bin, quantity]) => ({
    item_id: primaryId,
    bin,
    quantity,
  }));
  if (merged.length > 0) {
    await supabase.from("item_bins").insert(merged);
  }

  await supabase
    .from("items")
    .update({
      total_quantity: newTotal,
      storage_bin: merged.map((b) => b.bin).join(", ") || null,
    })
    .eq("id", primaryId);

  // Remove the now-empty duplicate records.
  await supabase.from("items").delete().in("id", duplicateIds);

  revalidatePath("/events");
  revalidatePath("/admin");
  revalidatePath("/admin/merge");
  revalidatePath(`/items/${primaryId}`);
  redirect(
    `/items/${primaryId}?merged=${duplicateIds.length + 1}`
  );
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}
