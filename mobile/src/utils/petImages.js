export function isLegacyPetStylizedUrl(url) {
  if (!url) return false;
  const value = String(url);
  if (/(^|\/)pets\/public\/[^?]+_stylized\./i.test(value)) return true;
  return /(^|\/)public\/[^/]+_stylized\./i.test(value);
}

export function sanitizeLegacyPetUrl(url) {
  return isLegacyPetStylizedUrl(url) ? null : url;
}
