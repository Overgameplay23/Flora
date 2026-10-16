import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { useSignedPetPhotoUrl } from "../../src/services/petPhotoUrls";
import Screen from "../../src/components/common/Screen";
import Button from "../../src/components/common/Button";
import { Lead, ScreenTitle } from "../../src/components/common/Headings";
import { useTheme } from "../../src/theme/theme";
import { radius, type } from "../../src/theme/tokens";

/** The older painted-portrait result (reached from PetSetup): the painting, then Done or try again. */
export default function PetStylizeResultScreen({ route, navigation }) {
  const { user, setProfile } = useAuth();
  const theme = useTheme();
  const { surface } = theme;
  const stylizedUrl = route?.params?.stylizedUrl;
  const cutoutUrl = route?.params?.cutoutUrl;
  const savedStylized = route?.params?.savedStylized !== false;
  const storedRenderUrl = route?.params?.renderUrl || stylizedUrl || cutoutUrl || null;
  // the pets bucket is private: show a short-lived signed URL for the stored locator
  const renderUrl = useSignedPetPhotoUrl(storedRenderUrl);
  const renderSource = route?.params?.renderSource || (storedRenderUrl ? "url" : "missing");
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
        url: storedRenderUrl || "local",
      });
    }
  }, [renderSource, storedRenderUrl]);

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
    <Screen scroll={false} centered>
      {renderUrl ? (
        <View style={[styles.frame, maskOriginal && styles.frameRound, { backgroundColor: theme.tone("body").fill, boxShadow: surface.shadow }]}>
          <Image source={{ uri: renderUrl }} style={[styles.image, maskOriginal && styles.frameRound]} accessibilityLabel="Your painted pet" />
        </View>
      ) : (
        <View style={[styles.frame, styles.placeholder, { backgroundColor: surface.sunken }]}>
          <Text style={[type.meta, { color: surface.textTertiary }]}>Image unavailable</Text>
        </View>
      )}
      <ScreenTitle center style={styles.title}>
        {savedStylized ? "Meet your pet" : "Preview ready"}
      </ScreenTitle>
      <Lead center style={styles.lead}>
        {savedStylized ? "The painted portrait is saved. They'll be on Home, in the garden, and whenever you check in." : "Your original photo is saved; the painted version could not be stored yet."}
      </Lead>
      {errorMessage ? <Text style={[type.meta, styles.error, { color: theme.alert }]}>{errorMessage}</Text> : null}
      <Button label="Done" onPress={handleDone} loading={saving} containerStyle={styles.primary} />
      <Button label="Try again" variant="quiet" size="md" onPress={handleTryAgain} containerStyle={styles.secondary} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 236,
    height: 236,
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  frameRound: {
    borderRadius: 118,
  },
  image: {
    width: 236,
    height: 236,
  },
  placeholder: {
    borderRadius: 118,
  },
  title: {
    marginTop: 4,
  },
  lead: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  error: {
    marginTop: 10,
    textAlign: "center",
  },
  primary: {
    marginTop: 22,
    alignSelf: "stretch",
  },
  secondary: {
    marginTop: 6,
    alignSelf: "center",
  },
});
