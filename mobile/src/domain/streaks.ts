// One number for "days in a row" (R-27): the server's activity streak (tasks or check-ins on
// consecutive local days) is the product's truth; the profile's check-in-only streak is the fallback
// when the server value has not loaded.
export function unifiedStreak(serverStreak: unknown, profileStreak: unknown): number {
  const server = Number(serverStreak);
  if (Number.isFinite(server) && server >= 0) return Math.floor(server);
  const profile = Number(profileStreak);
  return Number.isFinite(profile) && profile >= 0 ? Math.floor(profile) : 0;
}
