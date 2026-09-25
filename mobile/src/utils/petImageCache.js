let cache = null;
const listeners = new Set();

export function getPetImageCache() {
  return cache;
}

export function setPetImageCache(next) {
  cache = next;
  listeners.forEach((listener) => listener(cache));
}

export function subscribePetImageCache(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function appendCacheBuster(url, cacheBust) {
  if (!url) return null;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${cacheBust}`;
}
