export function isLegacyPetStylizedUrl(url) {
  if (!url) return false;
  const value = String(url);
  if (/(^|\/)pets\/public\/[^?]+_stylized\./i.test(value)) return true;
  return /(^|\/)public\/[^/]+_stylized\./i.test(value);
}

/** A pet chosen as an illustrated look (no photo) marks the profile with this sentinel instead of a URL. */
export const LOOK_ONLY_SENTINEL = "look://chosen";

export function sanitizeLegacyPetUrl(url) {
  if (typeof url === "string" && url.startsWith("look://")) return null;
  return isLegacyPetStylizedUrl(url) ? null : url;
}
