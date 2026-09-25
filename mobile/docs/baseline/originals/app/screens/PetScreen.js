import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { sanitizeLegacyPetUrl } from "../../src/utils/petImages";
import { subscribePetImageCache } from "../../src/utils/petImageCache";
import { useAuth } from "../../src/contexts/AuthContext";
// Do not query pet columns directly; use fetchPet for schema compatibility.
import { fetchPet, getBestPetRenderUrl, toPetImageSources, upsertPet, upsertPetResult } from "../../src/services/petService";
import Pet from "../../src/components/Pet";
import Card from "../../src/components/ui/Card";
import SectionTitle from "../../src/components/ui/SectionTitle";
import { pickImage } from "../../src/utils/pickImage";
import { stylizePet } from "../../src/services/petStylize";

export default function PetScreen() {
  const { user, profile, userStats, petEmotionState } = useAuth();
  const navigation = useNavigation();
  const [petState, setLocalPetState] = useState("idle");
  const [petSources, setPetSources] = useState({
    stylized: null,
    cutout: null,
    mask: null,
    photo: null,
    original: null,
    allowOriginal: false,
    alphaCutout: null,
    alphaStylized: null,
    maskReapplied: null,
    providerUsed: null,
  });
  const [petPhotoUrl, setPetPhotoUrl] = useState(null);
  const [petProcessingStatus, setPetProcessingStatus] = useState("idle");
  const [petProcessingError, setPetProcessingError] = useState("");
  const [isRetryingStylize, setIsRetryingStylize] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const buildProcessingError = (error) => {
    const raw = error?.userMessage || error?.message || "Stylize failed.";
    if (typeof raw !== "string") return "Stylize failed.";
    const trimmed = raw.replace(/data:[^ ]+/gi, "").replace(/\s+/g, " ").trim();
    return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
  };

  const updatePetProcessing = async (payload) => {
    if (!user?.id) return { savedStylized: false, fullPatchApplied: false, fallbackUsed: true };
    try {
      return await upsertPet(user.id, payload);
    } catch (error) {
      console.error("PET_PROCESSING_UPDATE_ERROR", { message: error?.message });
      return { savedStylized: false, fullPatchApplied: false, fallbackUsed: true };
    }
  };

  const loadPet = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMessage("");
      const pet = await fetchPet(user.id);
      setLocalPetState(pet?.state || "idle");
      setPetProcessingStatus(pet?.processing_status || "idle");
      setPetProcessingError(pet?.processing_error || "");
      setPetSources(toPetImageSources(pet, profile?.pet_photo_url || null));
      setPetPhotoUrl(getBestPetRenderUrl(pet, profile?.pet_photo_url || null));
    } catch (error) {
      console.error("PET_FETCH_ERROR", { message: error?.message });
      setErrorMessage("We couldn't load your pet yet. Please try again.");
      setLocalPetState("idle");
      setPetProcessingStatus("idle");
      setPetProcessingError("");
      setPetSources(toPetImageSources(null, profile?.pet_photo_url || null));
      setPetPhotoUrl(getBestPetRenderUrl(null, profile?.pet_photo_url || null));
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.pet_photo_url]);

  useFocusEffect(
    useCallback(() => {
      loadPet();
    }, [loadPet])
  );

  React.useEffect(() => {
    const unsubscribe = subscribePetImageCache((cache) => {
      if (!cache || cache.userId !== user?.id) return;
      setPetSources((prev) => ({
        ...prev,
        stylized: cache.stylized ?? null,
        cutout: cache.cutout ?? null,
        mask: cache.mask ?? prev.mask ?? null,
        photo: prev.photo ?? null,
        original: cache.original ?? prev.original,
        allowOriginal: cache.original ? true : prev.allowOriginal,
        alphaCutout: cache.alphaCutout ?? null,
        alphaStylized: cache.alphaStylized ?? null,
        maskReapplied: cache.maskReapplied ?? null,
        providerUsed: cache.providerUsed ?? null,
      }));
      setPetPhotoUrl(cache.stylized || cache.cutout || cache.original || null);
    });
    return unsubscribe;
  }, [user?.id]);

  async function update(state) {
    if (!user?.id) return;
    setLocalPetState(state);
    try {
      await upsertPet(user.id, { state });
    } catch (error) {
      console.error("PET_STATE_UPDATE_ERROR", { error });
    }
  }

  const handleRetryStylize = async () => {
    if (!user?.id || isRetryingStylize) return;
    const originalUrl = petSources?.original || sanitizeLegacyPetUrl(profile?.pet_photo_url || null);
    if (!originalUrl) {
      Alert.alert("Missing photo", "We couldn't find your original pet photo to retry. Please upload again.");
      return;
    }
    setIsRetryingStylize(true);
    setPetProcessingStatus("processing");
    setPetProcessingError("");
    await updatePetProcessing({ processing_status: "processing", processing_error: null });
    try {
      const result = await stylizePet({
        userId: user.id,
        imageUrl: originalUrl,
        style: "cute_max",
      });
      const writeResult = await upsertPetResult(user.id, {
        stylized_url: result.stylizedUrl,
        cutout_url: result.cutoutUrl,
        mask_url: result.maskUrl,
        photo_url: result.renderUrl || result.stylizedUrl || result.cutoutUrl || null,
        original_photo_url: result.originalUrl || originalUrl || null,
        processing_status: "ready",
        processing_error: null,
      });
      setPetProcessingStatus(writeResult?.savedStylized ? "ready" : "legacy");
      setPetProcessingError("");
      setPetSources((prev) => ({
        ...prev,
        stylized: result.stylizedUrl,
        cutout: result.cutoutUrl,
        mask: result.maskUrl,
        photo: result.renderUrl || prev.photo || null,
        original: prev.original || originalUrl,
        allowOriginal: true,
      }));
      setPetPhotoUrl(result.stylizedUrl || result.cutoutUrl || originalUrl || null);
    } catch (error) {
      console.error("PET_RETRY_STYLIZE_ERROR", { message: error?.message });
      const safeMessage = buildProcessingError(error);
      await updatePetProcessing({
        processing_status: "error",
        processing_error: safeMessage,
      });
      setPetProcessingStatus("error");
      setPetProcessingError(safeMessage);
    } finally {
      setIsRetryingStylize(false);
    }
  };

  const hasPetAssets = Boolean(
    petSources?.stylized || petSources?.cutout || petSources?.photo || petSources?.original
  );
  const showProcessingState = petProcessingStatus === "processing";
  const showErrorState = petProcessingStatus === "error";
  const showPlaceholder = !hasPetAssets;
  const showEmptyErrorState = showErrorState && !hasPetAssets;
  const visualPetState = petState === "idle" && petEmotionState ? petEmotionState : petState;

  const launchPicker = async () => {
    try {
      const result = await pickImage();
      if (result.canceled) return;
      if (!result.uri || !result.base64) {
        Alert.alert("No image selected", "Please choose a photo.");
        return;
      }
      navigation.navigate("PetStylizeLoading", {
        localUri: result.uri,
        imageBase64: result.base64,
        mimeType: result.mimeType || "image/jpeg",
      });
    } catch (error) {
      console.error("PET_PICKER_ERROR", { error });
      Alert.alert("Error", "Could not open the image picker. Please try again.");
    }
  };

  const openPickerModal = () => {
    const showSourcePicker = () => {
      Alert.alert("Upload your furry friend", "Choose a photo source", [
        { text: "Choose From Library", onPress: () => launchPicker() },
        { text: "Cancel", style: "cancel" },
      ]);
    };

    if (petPhotoUrl) {
      Alert.alert("Replace your pet photo?", "This will replace your current pet image.", [
        { text: "Cancel", style: "cancel" },
        { text: "Replace", style: "destructive", onPress: showSourcePicker },
      ]);
      return;
    }

    showSourcePicker();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 px-4 pt-4">
      <SectionTitle className="mb-4">Pet</SectionTitle>

      {errorMessage ? (
        <View className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <Text className="text-rose-700 text-sm">{errorMessage}</Text>
        </View>
      ) : null}

      <Card className="items-center mb-4">
        {showProcessingState ? (
          <View className="items-center py-6">
            <ActivityIndicator />
            <Text className="mt-2 text-xs text-slate-500">Stylizing...</Text>
          </View>
        ) : showEmptyErrorState ? (
          <View className="items-center py-6">
            <Text className="text-xs text-rose-600">Stylize failed.</Text>
          </View>
        ) : showPlaceholder ? (
          <Pet state={visualPetState} imageSources={null} processingStatus={petProcessingStatus} />
        ) : (
          <Pet state={visualPetState} imageSources={petSources} processingStatus={petProcessingStatus} />
        )}
        <Text className="text-sm text-slate-600">State: {visualPetState}</Text>
        <Text className="text-xs text-slate-500">Mood (daily loop): {userStats?.pet_mood_state || "neutral"}</Text>
        {showErrorState ? (
          <View className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <Text className="text-rose-700 text-xs">{petProcessingError || "Stylize failed. Please retry."}</Text>
            <Pressable
              className={`mt-2 self-start rounded-full px-3 py-1 ${isRetryingStylize ? "bg-rose-200" : "bg-rose-500"}`}
              onPress={handleRetryStylize}
              disabled={isRetryingStylize || showProcessingState}
            >
              <Text className="text-xs text-white font-semibold">
                {isRetryingStylize ? "Retrying..." : "Retry stylize"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      <Pressable className="mb-4 rounded-xl bg-emerald-500 px-4 py-3 items-center" onPress={openPickerModal}>
        <Text className="text-white font-semibold">Upload your furry friend</Text>
      </Pressable>

      <Pressable
        className="mb-4 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 items-center"
        onPress={() => navigation.navigate("PetChat")}
      >
        <Text className="text-sky-800 font-semibold">Talk to your pet</Text>
      </Pressable>

      <View className="flex-row gap-3 mb-3">
        <Pressable
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 items-center"
          onPress={() => update("happy")}
        >
          <Text className="text-white font-semibold">Pet</Text>
        </Pressable>
        <Pressable
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 items-center"
          onPress={() => update("eating")}
        >
          <Text className="text-white font-semibold">Feed</Text>
        </Pressable>
      </View>

      <Pressable
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 items-center"
        onPress={() => update("idle")}
      >
        <Text className="text-emerald-800 font-semibold">Set Idle</Text>
      </Pressable>
    </View>
  );
}
