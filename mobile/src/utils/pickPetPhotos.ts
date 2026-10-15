// Picks 1-3 photos of the real pet for the painted portrait and shrinks each one on the device.
//
// The portrait is painted from the photos alone, so the picker asks for several at once (the library
// allows multi-select; the camera adds one at a time). Every photo is resized to a long side of
// PHOTO_MAX_SIDE and re-encoded as JPEG before it is kept: three phone photos as the picker returns them
// would be 10+ MB of base64, well over what the painting function accepts, and a 1024 px reference is
// all the model needs. JPEG also means the on-device colour suggestion (jpeg-js) works for every photo.
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { PET_PHOTO_MAX } from "../domain/onboarding";

export type PetPhoto = {
  /** a local uri for previews (file://, blob: or data:) */
  uri: string;
  /** the bytes sent to the painting function, without a data: prefix */
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
};

export type PickPetPhotosResult = {
  photos: PetPhoto[];
  canceled: boolean;
  /** the person refused the camera or library permission */
  denied: boolean;
  /** photos that were picked but could not be read */
  unreadable: number;
};

export const PHOTO_MAX_SIDE = 1024;
const JPEG_QUALITY = 0.85;

type Manipulator = typeof import("expo-image-manipulator");

function loadManipulator(): Manipulator | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-image-manipulator") as Manipulator;
  } catch {
    return null;
  }
}

function guessMime(asset: { mimeType?: string | null; uri?: string | null }) {
  if (asset.mimeType && asset.mimeType.startsWith("image/")) return asset.mimeType;
  const uri = String(asset.uri || "").toLowerCase();
  if (uri.endsWith(".png")) return "image/png";
  if (uri.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/** Resizes a picked asset to PHOTO_MAX_SIDE and re-encodes it as JPEG; falls back to the picker's own bytes. */
export async function shrinkPetPhoto(asset: ImagePicker.ImagePickerAsset, manipulator = loadManipulator()): Promise<PetPhoto | null> {
  const width = Number(asset.width) || 0;
  const height = Number(asset.height) || 0;
  const longest = Math.max(width, height);
  if (manipulator && asset.uri) {
    try {
      const scale = longest > PHOTO_MAX_SIDE ? PHOTO_MAX_SIDE / longest : 1;
      const actions =
        scale < 1
          ? [{ resize: width >= height ? { width: Math.round(width * scale) } : { height: Math.round(height * scale) } }]
          : [];
      const result = await manipulator.manipulateAsync(asset.uri, actions, {
        compress: JPEG_QUALITY,
        format: manipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (result?.base64) {
        return { uri: result.uri || asset.uri, base64: stripDataPrefix(result.base64), mimeType: "image/jpeg", width: result.width, height: result.height };
      }
    } catch (error) {
      if (__DEV__) console.warn("PET_PHOTO_SHRINK_FAILED", (error as any)?.message || String(error));
    }
  }
  if (asset.base64) {
    return { uri: asset.uri, base64: stripDataPrefix(asset.base64), mimeType: guessMime(asset), width: width || undefined, height: height || undefined };
  }
  return null;
}

function stripDataPrefix(value: string) {
  const marker = "base64,";
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

/**
 * Opens the camera (one photo) or the library (up to `remaining` photos, multi-select) and returns the
 * shrunken photos. `remaining` is how many more the pet can take, at most PET_PHOTO_MAX.
 */
export async function pickPetPhotos(source: "camera" | "library", remaining = PET_PHOTO_MAX): Promise<PickPetPhotosResult> {
  const limit = Math.max(1, Math.min(PET_PHOTO_MAX, Math.floor(remaining)));
  const permission =
    source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { photos: [], canceled: true, denied: true, unreadable: 0 };
  }
  const manipulator = loadManipulator();
  // the picker's own base64 is only needed when the resizer is missing (it is slow for big photos)
  const wantBase64 = !manipulator;
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.9, base64: wantBase64 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          allowsMultipleSelection: limit > 1,
          selectionLimit: limit,
          orderedSelection: true,
          quality: 0.9,
          base64: wantBase64,
        });
  if (result.canceled) {
    return { photos: [], canceled: true, denied: false, unreadable: 0 };
  }
  // older Android pickers ignore selectionLimit; keep the first `limit` in the order they were chosen
  const assets = (result.assets || []).slice(0, limit);
  const photos: PetPhoto[] = [];
  let unreadable = 0;
  for (const asset of assets) {
    const photo = await shrinkPetPhoto(asset, manipulator);
    if (photo) photos.push(photo);
    else unreadable += 1;
  }
  return { photos, canceled: false, denied: false, unreadable };
}

/** The camera is a phone thing; on the web there is only the file picker. */
export const cameraAvailable = Platform.OS !== "web";
