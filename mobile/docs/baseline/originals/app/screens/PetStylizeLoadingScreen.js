import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet, Image } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { upsertPet, upsertPetResult } from "../../src/services/petService";
import { saveOriginalPetPhoto, stylizePet } from "../../src/services/petStylize";

export default function PetStylizeLoadingScreen({ route, navigation }) {
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [errorCode, setErrorCode] = useState("");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(null);
  const [isRetryWaiting, setIsRetryWaiting] = useState(false);
  const [isFallbackSaving, setIsFallbackSaving] = useState(false);
  const localUri = route?.params?.localUri;
  const imageBase64 = route?.params?.imageBase64;
  const mimeType = route?.params?.mimeType;
  const previewSource = localUri
    ? { uri: localUri }
    : imageBase64
      ? { uri: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` }
      : null;

  const logEdgeError = (error) => {
    const status = error?.context?.status ?? error?.status;
    const body = error?.context?.body;
    const bodySnippet = typeof body === "string" ? body.slice(0, 400) : "";
    console.error("PET_STYLIZE_EDGE_ERROR", {
      status,
      bodySnippet,
      message: error?.message,
      code: error?.errorCode,
      requestId: error?.requestId,
    });
  };

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

  useEffect(() => {
    let isActive = true;
    const runStylize = async () => {
      if (!user?.id || !imageBase64) {
        setErrorMessage("We couldn't find your photo. Please try again.");
        return;
      }
      try {
        await updatePetProcessing({ processing_status: "processing", processing_error: null });
        if (retryCount > 0 && errorCode === "RATE_LIMIT") {
          const jitter = Math.floor(Math.random() * 300);
          const baseDelay = retryCount === 1 ? 1000 : 3000;
          const retryDelay = retryAfterSeconds ? Math.max(baseDelay, retryAfterSeconds * 1000) : baseDelay;
          setIsRetryWaiting(true);
          await new Promise((resolve) => setTimeout(resolve, retryDelay + jitter));
          setIsRetryWaiting(false);
        }
        const result = await stylizePet({
          userId: user.id,
          imageBase64,
          mimeType,
          style: "cute_max",
        });
        const writeResult = await upsertPetResult(user.id, {
          stylized_url: result.stylizedUrl,
          cutout_url: result.cutoutUrl,
          mask_url: result.maskUrl,
          photo_url: result.renderUrl || result.stylizedUrl || result.cutoutUrl || null,
          original_photo_url: result.originalUrl || null,
          processing_status: "ready",
          processing_error: null,
        });
        if (!isActive) return;
        navigation.replace("PetStylizeResult", {
          stylizedUrl: result.stylizedUrl,
          cutoutUrl: result.cutoutUrl,
          renderUrl: result.renderUrl,
          renderSource: result.renderSource,
          mimeType: result.mimeType,
          savedStylized: !!writeResult?.savedStylized,
          localUri,
        });
      } catch (error) {
        console.error("PET_STYLIZE_ERROR", {
          message: error?.message,
          code: error?.errorCode || error?.code,
          details: error?.details,
          hint: error?.hint,
          stack: error?.stack,
        });
        logEdgeError(error);
        await updatePetProcessing({
          processing_status: "error",
          processing_error: buildProcessingError(error),
        });
        if (isActive) {
          const summary = error?.userMessage || "Please try again.";
          setErrorMessage(`We couldn't stylize your pet right now. ${summary}`);
          setErrorCode(error?.errorCode || "");
          setRetryAfterSeconds(error?.retryAfterSeconds || null);
          if (__DEV__) {
            const detailText = error?.devDetails || error?.message || JSON.stringify(error);
            setErrorDetails(detailText);
          }
        }
      }
    };

    runStylize();
    return () => {
      isActive = false;
    };
  }, [user?.id, imageBase64, mimeType, navigation, attempt, retryCount]);

  const handleRetry = () => {
    if (retryCount >= 2) {
      return;
    }
    setErrorMessage("");
    setErrorDetails("");
    setAttempt((prev) => prev + 1);
    setRetryCount((prev) => prev + 1);
  };

  const handleUseOriginal = async () => {
    if (!user?.id || !imageBase64 || isFallbackSaving) {
      return;
    }
    try {
      setIsFallbackSaving(true);
      await saveOriginalPetPhoto({
        userId: user.id,
        imageBase64,
        mimeType,
      });
      navigation.goBack();
    } catch (error) {
      setErrorMessage("We couldn't save the original photo. Please try again.");
      if (__DEV__) {
        const detailText = error?.message || JSON.stringify(error);
        setErrorDetails(detailText);
      }
    } finally {
      setIsFallbackSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Painting your companion...</Text>
      <Text style={styles.subtitle}>This usually takes a few seconds.</Text>
      {previewSource ? <Image source={previewSource} style={styles.previewImage} /> : null}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          {__DEV__ && errorDetails ? <Text style={styles.errorDetails}>{errorDetails}</Text> : null}
          <Pressable style={styles.errorButton} onPress={() => navigation.goBack()}>
            <Text style={styles.errorButtonText}>Go back</Text>
          </Pressable>
          <Pressable
            style={[styles.errorButton, styles.retryButton]}
            onPress={handleRetry}
            disabled={retryCount >= 2}
          >
            <Text style={styles.errorButtonText}>
              {retryCount >= 2 ? "Retry limit reached" : isRetryWaiting ? "Retrying..." : "Retry"}
            </Text>
          </Pressable>
          {errorCode === "RATE_LIMIT" ? (
            <Pressable
              style={[styles.errorButton, styles.secondaryButton]}
              onPress={handleUseOriginal}
              disabled={isFallbackSaving}
            >
              <Text style={styles.errorButtonText}>
                {isFallbackSaving ? "Saving original..." : "Use original photo for now"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ActivityIndicator size="large" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#0f172a",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(148, 163, 184, 0.85)",
    marginBottom: 24,
    textAlign: "center",
  },
  previewImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    marginBottom: 16,
  },
  errorBanner: {
    marginTop: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(225, 29, 72, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.4)",
  },
  errorText: {
    color: "#fecdd3",
    fontSize: 12,
    textAlign: "center",
  },
  errorDetails: {
    marginTop: 8,
    fontSize: 10,
    color: "rgba(148, 163, 184, 0.9)",
    textAlign: "left",
  },
  errorButton: {
    marginTop: 10,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  retryButton: {
    marginTop: 8,
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  errorButtonText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
});
