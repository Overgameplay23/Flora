// Device and Supabase glue for the person's own care tasks (src/domain/customTasks.ts). The row is a plain
// `tasks` row; its colour and minutes are remembered on this phone per row id.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { type CustomTaskMeta, type CustomTaskMetaMap, normalizeCustomMeta } from "../domain/customTasks";

const key = (userId: string) => `floura:custom-tasks:${userId}`;

export async function loadCustomTaskMeta(userId: string | null | undefined): Promise<CustomTaskMetaMap> {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? normalizeCustomMeta(raw) : {};
  } catch {
    return {};
  }
}

export async function saveCustomTaskMeta(userId: string, rowId: number | string, meta: CustomTaskMeta): Promise<void> {
  if (!userId) return;
  try {
    const current = await loadCustomTaskMeta(userId);
    const next = normalizeCustomMeta({ ...current, [String(rowId)]: meta });
    await AsyncStorage.setItem(key(userId), JSON.stringify(next));
  } catch (error) {
    console.warn("CUSTOM_TASK_META_SAVE_FAILED", (error as any)?.message || String(error));
  }
}

export async function forgetCustomTaskMeta(userId: string, rowId: number | string): Promise<void> {
  if (!userId) return;
  try {
    const current = await loadCustomTaskMeta(userId);
    delete current[String(rowId)];
    await AsyncStorage.setItem(key(userId), JSON.stringify(current));
  } catch {}
}

/** Inserts the row (title only on the server) and remembers its look here. Throws when the insert fails. */
export async function createCustomTask(userId: string, input: { title: string; category: CustomTaskMeta["category"]; minutes: number }): Promise<{ id: number; title: string }> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, title: input.title, active: true, sort_order: 50 })
    .select("id,title")
    .single();
  if (error) throw error;
  const row = { id: Number((data as any)?.id), title: String((data as any)?.title ?? input.title) };
  if (Number.isFinite(row.id)) await saveCustomTaskMeta(userId, row.id, { category: input.category, minutes: input.minutes });
  return row;
}

/** Puts the row away (never deleted: its completions and Sprouts stay). */
export async function removeCustomTask(userId: string, rowId: number | string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ active: false }).eq("user_id", userId).eq("id", rowId);
  if (error) throw error;
  await forgetCustomTaskMeta(userId, rowId);
}
