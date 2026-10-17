import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { confirmAsync, notify } from "../../src/utils/confirm";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { patchPetLocally, setPetNameLocally } from "../../src/services/petStore";
import { fetchCatalog, fetchUserPlants } from "../../src/services/garden";
import { fetchDaysTogether } from "../../src/services/homeStats";
import { savePetName, upsertPet, upsertPetResult } from "../../src/services/petService";
import { stylizePet } from "../../src/services/petStylize";
import { sanitizeLegacyPetUrl } from "../../src/utils/petImages";
import GardenStage from "../../src/components/garden/GardenStage";
import SceneOverlay from "../../src/components/garden/SceneOverlay";
import Card from "../../src/components/common/Card";
import Button from "../../src/components/common/Button";
import IconTile from "../../src/components/common/IconTile";
import Sheet from "../../src/components/common/Sheet";
import StatStrip from "../../src/components/common/StatStrip";
import TextField from "../../src/components/common/TextField";
import PressableScale from "../../src/components/common/PressableScale";
import { PetLoading } from "../../src/components/pet/PetMoments";
import { useSceneStatusBar } from "../../src/hooks/useSceneStatusBar";
import { useTheme, useThemeHour } from "../../src/theme/theme";
import { fonts, ink, radius, surfaces, type } from "../../src/theme/tokens";
import { tapLight, warning } from "../../src/utils/haptics";
import { moodSentence, petMoodFromStores } from "../../src/domain/petMood";
import { sanctuaryCopy, sanctuaryFor } from "../../src/domain/sanctuary";
import { isAdopted } from "../../src/domain/shelter";
import { petTalkAvailable } from "../../src/services/petTalk";
import { unifiedStreak } from "../../src/domain/streaks";
import { recomputePetState } from "../../src/services/retention";
import { playDing } from "../../src/utils/sfx";

const PET_NAME_MAX_CHARS = 24;

function buildProcessingError(error) {
  const raw = error?.userMessage || error?.message || "Stylize failed.";
  if (typeof raw !== "string") return "Stylize failed.";
  const trimmed = raw.replace(/data:[^ ]+/gi, "").replace(/\s+/g, " ").trim();
  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
}

function ActionTile({ icon, category, label, hint, onPress, disabled }) {
  const { surface } = useTheme();
  return (
    <Card
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={hint}
      containerStyle={styles.tileSlot}
      style={[styles.tile, disabled && styles.disabled]}
    >
      <IconTile icon={icon} category={category} size={40} />
      <Text style={[type.bodyStrong, styles.tileLabel, { color: surface.text }]}>{label}</Text>
      {hint ? (
        <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * The Pet tab: the pet at home in its garden, with everything that is about the pet itself -
 * petting it, talking to it, naming it, changing its photo, and the painting state of its portrait.
 */
export default function PetScreen() {
  const { user, profile, userStats, petEmotionState } = useAuth();
  // Days Together, the same number Home shows: days with any care, over all time (never the account's age)
  const [together, setTogether] = useState(null);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const appTheme = useTheme();
  const { surface, sky } = appTheme;
  const hour = useThemeHour();
  const overSceneNight = sky.statusBar === "light";
  const overScene = overSceneNight ? surfaces.night : surfaces.light;
  useSceneStatusBar(sky.statusBar);
  const { pet, sources, look, species, name, displayName, memorial, status, hasAnyImage, hasProcessedImage, processingStatus, refresh } = usePet();
  const inMemorial = !!memorial;
  const place = sanctuaryCopy(sanctuaryFor(species));

  const [scenePlants, setScenePlants] = useState([]);
  const [reaction, setReaction] = useState(null);
  const [petCount, setPetCount] = useState(0);
  const [renameOpen, setRenameOpen] = useState(false);
  // "Talk" only appears once the pet-talk function reports a configured key
  const [talkOn, setTalkOn] = useState(false);
  useEffect(() => {
    let alive = true;
    petTalkAvailable().then((value) => alive && setTalkOn(value));
    return () => {
      alive = false;
    };
  }, []);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [serverStreak, setServerStreak] = useState(null);
  const petTimer = useRef(null);

  const loadPlants = useCallback(async () => {
    if (!user?.id) {
      setScenePlants([]);
      return;
    }
    try {
      const [owned, catalog] = await Promise.all([fetchUserPlants(), fetchCatalog()]);
      const maxLevelById = new Map((catalog || []).map((plant) => [String(plant.id), plant.max_level]));
      setScenePlants(
        (owned || []).map((row) => ({
          id: String(row.plant_id),
          level: Number(row.level) || 0,
          maxLevel: Number(maxLevelById.get(String(row.plant_id))) || 5,
          purchasedAt: row.purchased_at || null,
        }))
      );
    } catch (error) {
      console.warn("PET_SCENE_PLANTS_LOAD_ERROR", error?.message || String(error));
      setScenePlants([]);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadPlants();
      recomputePetState()
        .then((state) => setServerStreak(state?.streak_days ?? null))
        .catch(() => {});
      if (user?.id) {
        fetchDaysTogether(user.id)
          .then((count) => setTogether(count))
          .catch(() => {});
      }
    }, [refresh, loadPlants, user?.id])
  );

  useEffect(() => () => petTimer.current && clearTimeout(petTimer.current), []);

  const mood = petMoodFromStores({ liveState: petEmotionState, dailyMood: userStats?.pet_mood_state, hour: new Date().getHours() });
  const streak = unifiedStreak(serverStreak, profile?.current_streak ?? profile?.streak_count ?? userStats?.streak ?? 0);
  const isProcessing = processingStatus === "processing";
  const isError = processingStatus === "error";
  const sceneHeight = Math.round(Math.min(460, Math.max(340, width * 0.95)));

  const handlePetTheDog = useCallback(() => {
    if (inMemorial) {
      navigation.navigate("Memorial");
      return;
    }
    if (!hasAnyImage && !look) {
      navigation.navigate("Onboarding", { mode: "look" });
      return;
    }
    setReaction("love");
    setPetCount((count) => count + 1);
    playDing();
    tapLight();
    if (user?.id) {
      // Legacy "state" column; harmless, kept so older data readers still see activity.
      upsertPet(user.id, { state: "happy" }).catch(() => {});
    }
  }, [hasAnyImage, inMemorial, look, navigation, user?.id]);

  const openRename = () => {
    setNameDraft(name);
    setNameError("");
    setRenameOpen(true);
  };

  const handleSaveName = async () => {
    const next = String(nameDraft || "").trim();
    if (!next) {
      setNameError("Please enter a name.");
      return;
    }
    if (next.length > PET_NAME_MAX_CHARS) {
      setNameError(`Name must be ${PET_NAME_MAX_CHARS} characters or fewer.`);
      return;
    }
    if (!user?.id) return;
    setSavingName(true);
    setNameError("");
    try {
      const saved = await savePetName(user.id, next);
      setPetNameLocally(user.id, saved);
      setRenameOpen(false);
      await refresh();
    } catch (error) {
      setNameError(error?.message || "Could not save the name.");
    } finally {
      setSavingName(false);
    }
  };

  const handleRetryStylize = async () => {
    if (!user?.id || retrying) return;
    const originalUrl = sources?.original || sanitizeLegacyPetUrl(profile?.pet_photo_url || null);
    if (!originalUrl) {
      notify("Missing photo", "We couldn't find the original photo to retry. Please choose a photo again.");
      return;
    }
    setRetrying(true);
    patchPetLocally(user.id, { processing_status: "processing", processing_error: null });
    try {
      await upsertPet(user.id, { processing_status: "processing", processing_error: null });
      const result = await stylizePet({ userId: user.id, imageUrl: originalUrl, style: "portrait" });
      await upsertPetResult(user.id, {
        stylized_url: result.stylizedUrl,
        cutout_url: result.cutoutUrl,
        mask_url: result.maskUrl,
        photo_url: result.renderUrl || result.stylizedUrl || result.cutoutUrl || null,
        original_photo_url: result.originalUrl || originalUrl || null,
        processing_status: "ready",
        processing_error: null,
      });
      await refresh();
    } catch (error) {
      console.error("PET_RETRY_STYLIZE_ERROR", { message: error?.message });
      const safeMessage = buildProcessingError(error);
      await upsertPet(user.id, { processing_status: "error", processing_error: safeMessage }).catch(() => {});
      patchPetLocally(user.id, { processing_status: "error", processing_error: safeMessage });
      warning();
      // an all-opaque result repoints the row at the photo (petStylize.js); reload so this session's
      // cached locators cannot open the overwritten white-backed files later
      await refresh().catch(() => {});
    } finally {
      setRetrying(false);
    }
  };

  const changePhoto = async () => {
    if (hasAnyImage) {
      const ok = await confirmAsync({
        title: "Replace the photo?",
        message: `${displayName} will be painted again from the new photo.`,
        confirmText: "Choose photo",
      });
      if (!ok) return;
    }
    navigation.navigate("Onboarding", { mode: "replace" });
  };

  const petHint = useMemo(() => {
    if (inMemorial) return "Resting peacefully";
    if (!hasAnyImage && !look) return "Choose a look to meet your pet";
    if (petCount === 0) return `Tap ${displayName} to say hello`;
    if (petCount < 3) return `${displayName} liked that`;
    return `${displayName} is very loved today`;
  }, [displayName, hasAnyImage, inMemorial, look, petCount]);

  if (status === "loading" && !pet) {
    return (
      <View style={[styles.center, { backgroundColor: surface.canvas, paddingTop: insets.top }]}>
        <PetLoading />
      </View>
    );
  }

  const plantsGrowing = scenePlants.filter((plant) => plant.level > 0).length;

  return (
    <View style={[styles.screen, { backgroundColor: surface.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GardenStage
          height={sceneHeight}
          variant="pet"
          hour={hour}
          petWander
          petImageSources={sources}
          petLook={look}
          plants={scenePlants}
          allowOriginal
          petMood={mood}
          petReaction={reaction}
          onPetReactionEnd={() => setReaction(null)}
          onPetPress={handlePetTheDog}
          petResting={inMemorial}
          petScale={1.05}
          accessibilityLabel={`${displayName} in the ${place.place}. ${moodSentence(mood, displayName, species)}`}
        >
          <SceneOverlay
            sky={sky}
            topInset={insets.top}
            title={name || "Your pet"}
            subtitle={inMemorial ? `Remembering ${displayName}` : moodSentence(mood, displayName, species)}
            titleAccessory={
              <PressableScale
                onPress={openRename}
                hitSlop={8}
                pressedScale={0.9}
                accessibilityRole="button"
                accessibilityLabel="Rename pet"
                style={[styles.renameButton, { backgroundColor: overScene.paperOverScene, boxShadow: overScene.shadow }]}
              >
                <Ionicons name="pencil" size={14} color={overScene.text} />
              </PressableScale>
            }
          />
          <View style={styles.sceneBottom} pointerEvents="none">
            <View style={[styles.hintPill, { backgroundColor: overScene.paperOverScene, boxShadow: overScene.shadow }]}>
              <Ionicons name={inMemorial ? "moon" : "heart"} size={13} color={overSceneNight ? appTheme.tone("connection").mid : appTheme.tone("connection").strong} />
              <Text style={[type.meta, styles.hintText, { color: overScene.text }]}>{petHint}</Text>
            </View>
          </View>
        </GardenStage>

        <View style={[styles.sheet, { backgroundColor: surface.canvas }]}>
          <StatStrip
            items={[
              { value: streak, label: streak === 1 ? "day in a row" : "days in a row", icon: "flame-outline", category: "energy" },
              { value: together ?? "—", label: together === 1 ? "day together" : "days together", icon: "heart-outline", category: "connection" },
              { value: plantsGrowing, label: place.plantsStat, icon: "leaf-outline", category: "body" },
            ]}
          />

          {isProcessing ? (
            <Card tone="calm" style={styles.noticeCard}>
              <View style={styles.noticeRow}>
                <View style={[styles.noticeSpinner, { backgroundColor: appTheme.tone("calm").tileOnFill }]}>
                  <ActivityIndicator color={appTheme.tone("calm").accent} />
                </View>
                <View style={styles.noticeBody}>
                  <Text style={[type.bodyStrong, { color: surface.text }]}>Painting {displayName}…</Text>
                  <Text style={[type.meta, styles.noticeText, { color: surface.textSecondary }]}>The photo is being turned into a portrait. This can take a minute.</Text>
                </View>
              </View>
            </Card>
          ) : isError ? (
            <Card tone="connection" style={styles.noticeCard}>
              <View style={styles.noticeRow}>
                <IconTile icon="alert-circle-outline" category="connection" on="fill" size={40} />
                <View style={styles.noticeBody}>
                  <Text style={[type.bodyStrong, { color: surface.text }]}>The portrait didn't finish</Text>
                  <Text style={[type.meta, styles.noticeText, { color: surface.textSecondary }]}>{pet?.processing_error || "Something went wrong while painting."}</Text>
                  <Button label={retrying ? "Retrying…" : "Try painting again"} icon="color-palette-outline" size="sm" loading={retrying} onPress={handleRetryStylize} containerStyle={styles.noticeButton} />
                </View>
              </View>
            </Card>
          ) : hasAnyImage && !hasProcessedImage ? (
            <Card tone="play" style={styles.noticeCard}>
              <View style={styles.noticeRow}>
                <IconTile icon="image-outline" category="play" on="fill" size={40} />
                <View style={styles.noticeBody}>
                  <Text style={[type.bodyStrong, { color: surface.text }]}>Showing the photo for now</Text>
                  <Text style={[type.meta, styles.noticeText, { color: surface.textSecondary }]}>{displayName}'s painted portrait isn't ready yet. You can retry any time.</Text>
                  <Button label={retrying ? "Painting…" : "Paint the portrait"} icon="color-palette-outline" size="sm" loading={retrying} onPress={handleRetryStylize} containerStyle={styles.noticeButton} />
                </View>
              </View>
            </Card>
          ) : null}

          {inMemorial ? (
            <Card tone="calm" onPress={() => navigation.navigate("Memorial")} accessibilityLabel="Memories" style={styles.bigCard}>
              <View style={styles.bigRow}>
                <IconTile icon="book-outline" category="calm" on="fill" size={52} />
                <View style={styles.bigBody}>
                  <Text style={[type.h3, { color: surface.text }]}>Memories of {displayName}</Text>
                  <Text style={[type.meta, { color: surface.textSecondary }]}>Write one down, or sit quietly for a minute</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={appTheme.tone("calm").accent} />
              </View>
            </Card>
          ) : (
            <Card tone="play" onPress={() => navigation.navigate("Play")} accessibilityLabel={`Play with ${displayName}`} style={styles.bigCard}>
              <View style={styles.bigRow}>
                <IconTile icon="tennisball-outline" category="play" on="fill" size={52} />
                <View style={styles.bigBody}>
                  <Text style={[type.h3, { color: surface.text }]}>Play with {displayName}</Text>
                  <Text style={[type.meta, { color: surface.textSecondary }]}>Fetch · Bubbles · Pet the pet · Treat Catch · Memory Match</Text>
                </View>
                <View style={[styles.bigGo, { backgroundColor: appTheme.bloom }]}>
                  <Ionicons name="play" size={18} color={ink.primary} />
                </View>
              </View>
            </Card>
          )}

          <View style={styles.tiles}>
            {inMemorial ? (
              <ActionTile icon="leaf-outline" category="calm" label="Quiet minute" hint={`Breathe slowly with ${displayName}`} onPress={() => navigation.navigate("Breathing")} />
            ) : (
              <>
                <ActionTile icon="book-outline" category="connection" label="Journal" hint={`${displayName} asks a question`} onPress={() => navigation.navigate("Journal")} />
                <ActionTile icon="leaf-outline" category="calm" label="Breathe together" hint="One slow minute" onPress={() => navigation.navigate("Breathing")} />
              </>
            )}
            {talkOn && !inMemorial ? (
              <ActionTile icon="chatbubble-ellipses-outline" category="calm" label="Talk" hint={`A few words with ${displayName}`} onPress={() => navigation.navigate("PetTalk")} />
            ) : null}
            <ActionTile icon="sunny-outline" category="energy" label="Check in" hint="How are you today?" onPress={() => navigation.navigate("CheckIn")} />
            <ActionTile icon="color-palette-outline" category="focus" label={look ? "Change look" : "Choose look"} hint={look ? `${look.species === "cat" ? "Cat" : "Dog"} · colours, ears, markings` : "Dog or cat"} onPress={() => navigation.navigate("Onboarding", { mode: "look" })} />
            {isAdopted(look) ? null : (
              <ActionTile icon="camera-outline" category="play" label={hasAnyImage ? "New photo" : "Add photo"} hint={hasAnyImage ? "Painted portrait" : "Optional portrait"} onPress={changePhoto} />
            )}
            <ActionTile icon="create-outline" category="rest" label="Rename" hint={name ? name : "Pick a name"} onPress={openRename} />
          </View>
        </View>
      </ScrollView>

      <Sheet
        visible={renameOpen}
        onClose={() => setRenameOpen(false)}
        locked={savingName}
        title={name ? "Rename your pet" : "Name your pet"}
        subtitle="A name they'll hear every day."
        pet={{ mood: "happy", size: 72 }}
        footer={
          <>
            <Button label="Save" onPress={handleSaveName} loading={savingName} />
            <Button label="Cancel" variant="quiet" size="md" onPress={() => setRenameOpen(false)} disabled={savingName} containerStyle={styles.cancel} />
          </>
        }
      >
        <TextField
          value={nameDraft}
          onChangeText={(text) => {
            setNameDraft(text);
            if (nameError) setNameError("");
          }}
          placeholder="Enter a name"
          autoCapitalize="words"
          maxLength={PET_NAME_MAX_CHARS}
          editable={!savingName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSaveName}
          accessibilityLabel="Pet name"
          error={!!nameError}
          note={nameError || null}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 110 },
  renameButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sceneBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 44,
    alignItems: "center",
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  hintText: { marginLeft: 6, fontFamily: fonts.bodyBold },
  sheet: {
    marginTop: -30,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: "continuous",
    paddingTop: 22,
    paddingHorizontal: 20,
  },
  noticeCard: { marginTop: 12 },
  noticeRow: { flexDirection: "row", alignItems: "flex-start" },
  noticeSpinner: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  noticeBody: { flex: 1, marginLeft: 12 },
  noticeText: { marginTop: 2 },
  noticeButton: { marginTop: 10 },
  bigCard: { marginTop: 12 },
  bigRow: { flexDirection: "row", alignItems: "center" },
  bigBody: { flex: 1, marginHorizontal: 12 },
  bigGo: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
  },
  tileSlot: { width: "48.5%", marginBottom: 10 },
  tile: { minHeight: 112 },
  tileLabel: { marginTop: 10 },
  disabled: { opacity: 0.6 },
  cancel: { alignSelf: "center" },
});
