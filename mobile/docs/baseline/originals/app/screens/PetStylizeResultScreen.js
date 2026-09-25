import React, { useEffect, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { supabase } from "../../src/lib/supabase";

export default function PetStylizeResultScreen({ route, navigation }) {
  const { user, setProfile } = useAuth();
  const stylizedUrl = route?.params?.stylizedUrl;
  const cutoutUrl = route?.params?.cutoutUrl;
  const savedStylized = route?.params?.savedStylized !== false;
  const renderUrl = route?.params?.renderUrl || stylizedUrl || cutoutUrl || null;
  const renderSource = route?.params?.renderSource || (renderUrl ? "url" : "missing");
  const maskOriginal = renderSource === "originalMasked";
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const goToPetTab = () => {
    const routeNames = navigation.getState().routeNames || [];
    if (routeNames.includes("MainTabs")) {
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Pet" } }],
      });
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleTryAgain = () => {
    const routeNames = navigation.getState().routeNames || [];
    if (routeNames.includes("PetSetup")) {
      navigation.navigate("PetSetup");
      return;
    }
    if (routeNames.includes("MainTabs")) {
      navigation.navigate("MainTabs", { screen: "Pet" });
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  useEffect(() => {
    const refreshProfile = async () => {
      if (!user?.id || !setProfile) return;
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (error) {
        console.error("PET_PROFILE_REFRESH_ERROR", { error });
        return;
      }
      setProfile(data);
    };
    refreshProfile();
  }, [user?.id, setProfile]);

  useEffect(() => {
    if (__DEV__) {
      console.log("PET_RESULT_RENDER_SOURCE", {
        renderSource,
        url: renderUrl || "local",
      });
    }
  }, [renderSource, renderUrl]);

  const handleDone = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMessage("");
    try {
      goToPetTab();
    } catch (error) {
      console.error("PET_DONE_ERROR", { error });
      setErrorMessage("We couldn't finish this flow. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{savedStylized ? "Meet your new pet" : "Preview ready"}</Text>
      <Text style={styles.subtitle}>
        {savedStylized
          ? "Your stylized pet is saved."
          : "Your original pet photo is saved. Stylized save is waiting on schema updates."}
      </Text>
      {renderUrl ? (
        <Image
          source={{ uri: renderUrl }}
          style={maskOriginal ? styles.imageMasked : styles.image}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>Image unavailable</Text>
        </View>
      )}

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={handleDone}>
        {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryButtonText}>Done</Text>}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={handleTryAgain}>
        <Text style={styles.secondaryButtonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
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
    marginBottom: 20,
    textAlign: "center",
  },
  image: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: "rgba(148, 163, 184, 0.35)",
    marginBottom: 16,
  },
  imageMasked: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: "rgba(148, 163, 184, 0.35)",
    marginBottom: 16,
  },
  imagePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  placeholderText: {
    color: "rgba(148, 163, 184, 0.7)",
    fontSize: 12,
  },
  errorBanner: {
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(225, 29, 72, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.4)",
  },
  errorText: {
    color: "#fecdd3",
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: "#34d399",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "rgba(148, 163, 184, 0.9)",
    fontSize: 12,
  },
});
