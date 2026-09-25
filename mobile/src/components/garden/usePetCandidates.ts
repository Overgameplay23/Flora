import { useCallback, useEffect, useMemo, useState } from "react";
import type { ImageSourcePropType } from "react-native";

export type PetImageSources = {
  stylized?: string | null;
  cutout?: string | null;
  mask?: string | null;
  photo?: string | null;
  original?: string | null;
  allowOriginal?: boolean | null;
  alphaCutout?: boolean | null;
  alphaStylized?: boolean | null;
  maskReapplied?: boolean | null;
  providerUsed?: string | null;
};

export type PetCandidateType = "stylized" | "cutout" | "photo" | "original" | "placeholder";
export type PetCandidate = { type: PetCandidateType; source: ImageSourcePropType | null; uri: string | null };

/**
 * The pet render ladder: stylized -> cutout -> photo -> original -> placeholder, stepping down whenever an
 * image fails to load. This is the rule the garden scenes previously each re-implemented.
 */
export function buildPetCandidates(sources?: PetImageSources | null, allowOriginalOverride = false): PetCandidate[] {
  const list: PetCandidate[] = [];
  const push = (type: PetCandidateType, uri?: string | null) => {
    if (uri) list.push({ type, uri, source: { uri } });
  };
  if (sources?.stylized && sources.alphaStylized !== false) push("stylized", sources.stylized);
  if (sources?.cutout && sources.alphaCutout !== false) push("cutout", sources.cutout);
  push("photo", sources?.photo);
  const allowOriginal = allowOriginalOverride || sources?.allowOriginal === true;
  if (allowOriginal && sources?.original && sources.original !== sources.photo) push("original", sources.original);
  list.push({ type: "placeholder", source: null, uri: null });
  return list;
}

export function usePetCandidates(sources?: PetImageSources | null, allowOriginalOverride = false) {
  const candidates = useMemo(
    () => buildPetCandidates(sources, allowOriginalOverride),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sources?.stylized,
      sources?.cutout,
      sources?.photo,
      sources?.original,
      sources?.allowOriginal,
      sources?.alphaStylized,
      sources?.alphaCutout,
      allowOriginalOverride,
    ]
  );
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const choice = candidates[Math.min(index, candidates.length - 1)];
  const onError = useCallback(() => {
    setIndex((prev) => Math.min(prev + 1, Math.max(candidates.length - 1, 0)));
  }, [candidates.length]);

  // Only stylized/cutout images have transparency. A plain photo (photo_url is set to the original when
  // no portrait exists yet) or the original itself is shown in a round frame, never as a free-standing
  // rectangle on the grass.
  const hasCutout = Boolean(sources?.stylized || sources?.cutout);
  const framed = (choice.type === "original" || choice.type === "photo") && !hasCutout;
  const renderSource = framed ? "originalMasked" : choice.type;
  return { choice, onError, framed, renderSource };
}
