// Deleting an account from inside the app (App Store Guideline 5.1.1(v); docs/LAUNCH.md item 1).
//
// Order matters, and each step runs only when the one before it worked:
//   1. the pet photos in the private `pets` bucket (<uid>/...), through the Storage API. SQL cannot remove them,
//      and they are the most personal thing the server holds (a real photo of the pet, often of the home too);
//   2. the account, with the delete_my_account RPC (local-backend/sql/delete_my_account.sql); every server row
//      cascades from auth.users;
//   3. everything this account left on the phone: cycle, journal, plan, journeys, scrapbook, milestones... (the
//      AsyncStorage keys carry the user id) and the scheduled reminders;
//   4. a local sign-out: the server session went with the account, so a global sign-out would only fail.
// If step 1 or 2 fails, nothing on the phone is touched and the person can simply try again.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { cancelReminders } from "./reminders";

const PHOTO_BUCKET = "pets";

// written before the per-user keys existed; they belong to whoever is signed in on this phone
const LEGACY_DEVICE_KEYS = ["user_habits_v1", "pending_completions"];

/** Typing the word is the one deliberate step on the screen: it works the same on phones and on web. */
export const CONFIRM_WORD = "delete";

export function confirmWordMatches(draft: string | null | undefined): boolean {
  return String(draft ?? "").trim().toLowerCase() === CONFIRM_WORD;
}

export type DeletionStep = "photos" | "account";

export class AccountDeletionError extends Error {
  readonly step: DeletionStep;
  constructor(step: DeletionStep, message: string) {
    super(message);
    this.name = "AccountDeletionError";
    this.step = step;
  }
}

/** The keys on this phone that belong to `userId` (pure, for the tests). */
export function deviceKeysFor(userId: string, keys: readonly string[]): string[] {
  if (!userId) return [];
  return keys.filter((key) => key.includes(userId) || LEGACY_DEVICE_KEYS.includes(key));
}

async function listOwnPhotos(userId: string): Promise<string[]> {
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const files: string[] = [];
  const folders = [userId];
  while (folders.length) {
    const folder = folders.shift() as string;
    const { data, error } = await bucket.list(folder, { limit: 1000 });
    if (error) throw error;
    for (const item of data ?? []) {
      const full = `${folder}/${item.name}`;
      // the Storage API lists sub-folders as entries without an id
      if (item.id == null) folders.push(full);
      else files.push(full);
    }
  }
  return files;
}

async function removeOwnPhotos(userId: string) {
  const files = await listOwnPhotos(userId);
  if (!files.length) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(files);
  if (error) throw error;
}

/** Steps 3 and 4. Never throws: the account is already gone, so the person must end up signed out regardless. */
async function forgetOnThisPhone(userId: string) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = deviceKeysFor(userId, keys);
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch (error) {
    console.warn("ACCOUNT_DELETION_DEVICE_WIPE", error);
  }
  await cancelReminders().catch(() => {});
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn("ACCOUNT_DELETION_SIGNOUT", error);
  }
}

export async function deleteMyAccount(userId: string): Promise<void> {
  if (!userId) throw new AccountDeletionError("account", "Not signed in.");

  try {
    await removeOwnPhotos(userId);
  } catch (error: any) {
    throw new AccountDeletionError("photos", error?.message || "Could not remove the photos.");
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new AccountDeletionError("account", error.message || "Could not delete the account.");

  await forgetOnThisPhone(userId);
}
