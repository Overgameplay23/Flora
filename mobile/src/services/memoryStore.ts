// Memories written during a memorial, kept on the device (they are personal, and the memorial works
// offline). When a new companion moves in, the old pet's memorial is archived here too.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Memory, MemorialState, addMemory, normalizeMemories, removeMemory } from "../domain/memorial";
import type { PetLook } from "../domain/petLook";

const memoriesKey = (userId: string) => `floura:memories:${userId}`;
const archiveKey = (userId: string) => `floura:memorial-archive:${userId}`;

export type MemorialArchiveEntry = {
  petName: string;
  look: PetLook | null;
  memorial: MemorialState;
  memories: Memory[];
  archivedAt: string;
};

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeMemories(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadMemories(userId: string | null | undefined): Promise<Memory[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(memoriesKey(userId));
    return raw ? normalizeMemories(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

async function saveMemories(userId: string, memories: Memory[]) {
  try {
    await AsyncStorage.setItem(memoriesKey(userId), JSON.stringify(memories));
  } catch {}
  notify();
}

export async function writeMemory(userId: string, text: string): Promise<Memory[]> {
  const next = addMemory(await loadMemories(userId), text);
  await saveMemories(userId, next);
  return next;
}

export async function deleteMemory(userId: string, id: string): Promise<Memory[]> {
  const next = removeMemory(await loadMemories(userId), id);
  await saveMemories(userId, next);
  return next;
}

export async function loadArchive(userId: string | null | undefined): Promise<MemorialArchiveEntry[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(archiveKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.petName === "string" && e.memorial) : [];
  } catch {
    return [];
  }
}

/** Moves the current memorial and its memories into the archive so a new companion can move in. */
export async function archiveMemorial(userId: string, entry: Omit<MemorialArchiveEntry, "archivedAt">) {
  const existing = await loadArchive(userId);
  const next = [{ ...entry, memories: normalizeMemories(entry.memories), archivedAt: new Date().toISOString() }, ...existing].slice(0, 10);
  try {
    await AsyncStorage.setItem(archiveKey(userId), JSON.stringify(next));
    await AsyncStorage.removeItem(memoriesKey(userId));
  } catch {}
  notify();
  return next;
}
