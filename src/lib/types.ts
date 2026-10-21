export type Item = {
  id: string;
  name: string;
  description: string | null;
  storage_bin: string | null;
  total_quantity: number;
  photo_url: string | null;
  created_at: string;
};

export type ItemBin = {
  bin: string;
  quantity: number;
};

export type ItemAvailability = Item & {
  quantity_out: number;
  quantity_available: number;
  bins: ItemBin[];
};

export type Tournament = {
  id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type Checkout = {
  id: string;
  item_id: string;
  tournament_id: string | null;
  quantity: number;
  person_responsible: string | null;
  checked_out_at: string;
  checked_in_at: string | null;
  status: string | null;
  truck_id: string | null;
  arrived_location: string | null;
  notes: string | null;
  created_at: string;
};

// Checkout joined with related item + tournament names (for history/on-site views)
export type CheckoutDetailed = Checkout & {
  items: Pick<Item, "id" | "name" | "photo_url"> | null;
  tournaments: Pick<Tournament, "id" | "name"> | null;
};
