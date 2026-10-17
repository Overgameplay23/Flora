// Device store for the Sunday scrapbook (src/domain/scrapbook.ts): the pages the pet has kept, one per week,
// and the newest one the person has opened. Per user, on this phone; nothing new goes to the server.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_SCRAPBOOK, markPageSeen, normalizeScrapbook, upsertPage, type Scrapbook, type ScrapbookPage } from "../domain/scrapbook";

const key = (userId: string) => `floura:scrapbook:${userId}`;

export async function loadScrapbook(userId: string | null | undefined): Promise<Scrapbook> {
  if (!userId) return { ...EMPTY_SCRAPBOOK, pages: [] };
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? normalizeScrapbook(raw) : { ...EMPTY_SCRAPBOOK, pages: [] };
  } catch {
    return { ...EMPTY_SCRAPBOOK, pages: [] };
  }
}

/** Keeps (or refreshes) a page and marks it opened. Returns the book as saved. */
export async function keepScrapbookPage(userId: string, page: ScrapbookPage): Promise<Scrapbook> {
  const book = markPageSeen(upsertPage(await loadScrapbook(userId), page), page.endDateKey);
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(book));
  } catch (error) {
    console.warn("SCRAPBOOK_SAVE_FAILED", (error as any)?.message || String(error));
  }
  return book;
}

/** Marks a page opened without changing it (a page shown from the book when the week could not be fetched). */
export async function markScrapbookSeen(userId: string, endDateKey: string): Promise<Scrapbook> {
  const book = markPageSeen(await loadScrapbook(userId), endDateKey);
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(book));
  } catch {}
  return book;
}
