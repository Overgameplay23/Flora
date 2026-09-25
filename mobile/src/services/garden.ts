import { supabase } from "../lib/supabase";

export type PlantCatalogItem = {
  id: string;
  name: string;
  rarity: string;
  max_level: number;
  base_cost: number;
  cost_multiplier: number;
};

export type UserPlant = {
  plant_id: string;
  level: number;
  equipped: boolean;
  purchased_at: string;
  updated_at: string;
};

export type UpgradePlantResult = {
  plantId: string;
  newLevel: number;
  costPaid: number;
  remainingPoints: number;
  maxLevelReached?: boolean;
};

export type GardenPointsSummary = {
  earnedPoints: number;
  spentPoints: number;
  remainingPoints: number;
};

function toSafeInt(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function toUpgradeResponse(value: any): UpgradePlantResult {
  return {
    plantId: String(value?.plantId || ""),
    newLevel: toSafeInt(value?.newLevel, 0),
    costPaid: toSafeInt(value?.costPaid, 0),
    remainingPoints: toSafeInt(value?.remainingPoints, 0),
    maxLevelReached: value?.maxLevelReached === true,
  };
}

export async function fetchCatalog(): Promise<PlantCatalogItem[]> {
  const { data, error } = await supabase
    .from("plant_catalog")
    .select("id, name, rarity, max_level, base_cost, cost_multiplier")
    .order("base_cost", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data || []) as PlantCatalogItem[];
}

export async function fetchUserPlants(): Promise<UserPlant[]> {
  const { data, error } = await supabase
    .from("user_plants")
    .select("plant_id, level, equipped, purchased_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as UserPlant[];
}

export async function fetchGardenPoints(): Promise<GardenPointsSummary> {
  const { data, error } = await supabase.rpc("get_garden_points");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    earnedPoints: toSafeInt(row?.earnedPoints, 0),
    spentPoints: toSafeInt(row?.spentPoints, 0),
    remainingPoints: toSafeInt(row?.remainingPoints, 0),
  };
}

export async function upgradePlant(plantId: string): Promise<UpgradePlantResult> {
  const { data, error } = await supabase.rpc("upgrade_plant", { p_plant_id: plantId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return toUpgradeResponse(row);
}
