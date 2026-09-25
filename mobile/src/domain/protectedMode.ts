export function isProtectedMood(mood: number | null | undefined): boolean {
  return mood != null && mood <= 2;
}
