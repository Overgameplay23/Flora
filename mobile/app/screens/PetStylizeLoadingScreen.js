import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Image } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { upsertPet, upsertPetResult } from "../../src/services/petService";
import { saveOriginalPetPhoto, stylizePet } from "../../src/services/petStylize";
import Screen from "../../src/components/common/Screen";
import Button from "../../src/components/common/Button";
import Card from "../../src/components/common/Card";
import { Lead, ScreenTitle } from "../../src/components/common/Headings";
import { paintingLine } from "../../src/domain/onboarding";
import { useTheme } from "../../src/theme/theme";
import { radius, type } from "../../src/theme/tokens";

/**
 * The older "paint my photo" wait (reached from PetSetup): the photo in a soft ring while the Edge Function
 * paints, then on to the result; on failure, retry (twice), go back, or keep the original for now. On the
 * design system; the logic is unchanged.
 */
export default function PetStylizeLoadingScreen({ route, navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const { surface } = theme;
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [errorCode, setErrorCode] = useState("");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(null);
  const [isRetryWaiting, setIsRetryWaiting] = useState(false);
  const [isFallbackSaving, setIsFallbackSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const localUri = route?.params?.localUri;
  const imageBase64 = route?.params?.imageBase64;
  const mimeType = route?.params?.mimeType;
  const previewSource = localUri
    ? { uri: localUri }
    : imageBase64
      ? { uri: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` }
      : null;

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [attempt]);

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
          setErrorMessage(`We couldn't paint your pet right now. ${summary}`);
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
    setElapsed(0);
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
    <Screen scroll={false} centered>
      {previewSource ? (
        <View style={[styles.ring, { borderColor: theme.tone("play").mid, backgroundColor: surface.sunken }]}>
          <Image source={previewSource} style={styles.previewImage} accessibilityLabel="Your photo" />
        </View>
      ) : null}
      {errorMessage ? (
        <Card style={styles.errorCard}>
          <Text style={[type.bodyStrong, { color: surface.text }]}>That didn't work</Text>
          <Text style={[type.callout, styles.errorText, { color: theme.alert }]}>{errorMessage}</Text>
          {__DEV__ && errorDetails ? <Text style={[type.micro, styles.errorDetails, { color: surface.textTertiary }]}>{errorDetails}</Text> : null}
          <Button
            label={retryCount >= 2 ? "Retry limit reached" : isRetryWaiting ? "Retrying…" : "Try again"}
            onPress={handleRetry}
            disabled={retryCount >= 2 || isRetryWaiting}
            size="md"
            containerStyle={styles.errorButton}
          />
          {errorCode === "RATE_LIMIT" ? (
            <Button label={isFallbackSaving ? "Saving original…" : "Use the original photo for now"} variant="secondary" size="md" onPress={handleUseOriginal} loading={isFallbackSaving} containerStyle={styles.errorButton} />
          ) : null}
          <Button label="Go back" variant="quiet" size="md" onPress={() => navigation.goBack()} containerStyle={styles.errorButton} />
        </Card>
      ) : (
        <View style={styles.wait}>
          <ScreenTitle center>Painting your pet…</ScreenTitle>
          <Lead center style={styles.lead}>
            {paintingLine(elapsed, "your pet")}
          </Lead>
          <ActivityIndicator color={theme.bloom} style={styles.spinner} />
          <Text style={[type.meta, styles.footnote, { color: surface.textTertiary }]}>This usually takes under a minute. You can keep the screen open or come back later.</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  previewImage: {
    width: 156,
    height: 156,
    borderRadius: 78,
  },
  wait: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  lead: {
    marginTop: 8,
  },
  spinner: {
    marginTop: 18,
  },
  footnote: {
    marginTop: 16,
    textAlign: "center",
  },
  errorCard: {
    alignSelf: "stretch",
    gap: 4,
  },
  errorText: {
    marginTop: 4,
  },
  errorDetails: {
    marginTop: 6,
  },
  errorButton: {
    marginTop: 10,
    alignSelf: "center",
  },
});
