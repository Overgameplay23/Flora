import * as ImagePicker from "expo-image-picker";

type PickResult = {
  uri: string | null;
  base64: string | null;
  mimeType: string | null;
  canceled: boolean;
};

export async function pickImage(): Promise<PickResult> {
  console.log("IMAGE_PICKER_KEYS", Object.keys(ImagePicker || {}));
  console.log("IMAGE_PICKER_MEDIA", (ImagePicker as any).MediaType, (ImagePicker as any).MediaTypeOptions);

  const mediaTypes =
    (ImagePicker as any).MediaTypeOptions && (ImagePicker as any).MediaTypeOptions.Images
      ? (ImagePicker as any).MediaTypeOptions.Images
      : undefined;

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { uri: null, base64: null, mimeType: null, canceled: true };
  }

  const result: any = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });

  if (result?.canceled || result?.cancelled) {
    return { uri: null, base64: null, mimeType: null, canceled: true };
  }

  const asset = result?.assets?.[0] || result;
  const uri = asset?.uri || null;
  const base64 = asset?.base64 || null;
  const mimeType = asset?.mimeType || (uri && uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

  if (!uri || !base64) {
    return { uri: null, base64: null, mimeType: mimeType || null, canceled: false };
  }

  return { uri, base64, mimeType: mimeType || null, canceled: false };
}
