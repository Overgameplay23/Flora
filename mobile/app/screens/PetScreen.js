import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { patchPetLocally, setPetNameLocally } from "../../src/services/petStore";
import { fetchCatalog, fetchUserPlants } from "../../src/services/garden";
import { savePetName, upsertPet, upsertPetResult } from "../../src/services/petService";
import { stylizePet } from "../../src/services/petStylize";
import { sanitizeLegacyPetUrl } from "../../src/utils/petImages";
import GardenStage from "../../src/components/garden/GardenStage";
import { moodSentence, petMoodFromStores } from "../../src/domain/petMood";
import { unifiedStreak } from "../../src/domain/streaks";
import { recomputePetState } from "../../src/services/retention";
import { playDing } from "../../src/utils/sfx";

const PET_NAME_MAX_CHARS = 24;

function daysTogether(profile) {
  const raw = profile?.created_at;
  if (!raw) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(1, Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1);
}

function buildProcessingError(error) {
  const raw = error?.userMessage || error?.message || "Stylize failed.";
  if (typeof raw !== "string") return "Stylize failed.";
  const trimmed = raw.replace(/data:[^ ]+/gi, "").replace(/\s+/g, " ").trim();
  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
}

function ActionTile({ icon, label, hint, onPress, tone = "default", disabled }) {
  return (
    <Pressable
      style={[styles.tile, tone === "primary" && styles.tilePrimary, disabled && styles.tileDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <View style={[styles.tileIcon, tone === "primary" && styles.tileIconPrimary]}>
        <Feather name={icon} size={18} color={tone === "primary" ? "#0f172a" : "#e2e8f0"} />
      </View>
      <Text style={[styles.tileLabel, tone === "primary" && styles.tileLabelPrimary]}>{label}</Text>
      {hint ? <Text style={[styles.tileHint, tone === "primary" && styles.tileHintPrimary]}>{hint}</Text> : null}
    </Pressable>
  );
}

/**
 * The Pet tab: the pet at home in its garden, with everything that is about the pet itself -
 * petting it, talking to it, naming it, changing its photo, and the painting state of its portrait.
 */
export default function PetScreen() {
  const { user, profile, userStats, petEmotionState } = useAuth();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { pet, sources, look, name, displayName, status, hasAnyImage, hasProcessedImage, processingStatus, refresh } = usePet();

  const [scenePlants, setScenePlants] = useState([]);
  const [reaction, setReaction] = useState(null);
  const [petCount, setPetCount] = useState(0);
  const [renameOpen, setRenameOpen] = useState(false);
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
    }, [refresh, loadPlants])
  );

  useEffect(() => () => petTimer.current && clearTimeout(petTimer.current), []);

  const mood = petMoodFromStores({ liveState: petEmotionState, dailyMood: userStats?.pet_mood_state, hour: new Date().getHours() });
  const together = daysTogether(profile);
  const streak = unifiedStreak(serverStreak, profile?.current_streak ?? profile?.streak_count ?? userStats?.streak ?? 0);
  const isProcessing = processingStatus === "processing";
  const isError = processingStatus === "error";
  const sceneHeight = Math.round(Math.min(360, Math.max(260, width * 0.78)));

  const handlePetTheDog = useCallback(() => {
    if (!hasAnyImage && !look) {
      navigation.navigate("Onboarding", { mode: "look" });
      return;
    }
    setReaction("love");
    setPetCount((count) => count + 1);
    playDing();
    if (user?.id) {
      // Legacy "state" column; harmless, kept so older data readers still see activity.
      upsertPet(user.id, { state: "happy" }).catch(() => {});
    }
  }, [hasAnyImage, navigation, user?.id]);

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
      Alert.alert("Missing photo", "We couldn't find the original photo to retry. Please choose a photo again.");
      return;
    }
    setRetrying(true);
    patchPetLocally(user.id, { processing_status: "processing", processing_error: null });
    try {
      await upsertPet(user.id, { processing_status: "processing", processing_error: null });
      const result = await stylizePet({ userId: user.id, imageUrl: originalUrl, style: "cute_max" });
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
    } finally {
      setRetrying(false);
    }
  };

  const changePhoto = () => {
    if (hasAnyImage) {
      Alert.alert("Replace the photo?", `${displayName} will be painted again from the new photo.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Choose photo", onPress: () => navigation.navigate("Onboarding", { mode: "replace" }) },
      ]);
      return;
    }
    navigation.navigate("Onboarding", { mode: "replace" });
  };

  const petHint = useMemo(() => {
    if (!hasAnyImage && !look) return "Choose a look to meet your pet";
    if (petCount === 0) return `Tap ${displayName} to say hello`;
    if (petCount < 3) return `${displayName} liked that`;
    return `${displayName} is very loved today`;
  }, [displayName, hasAnyImage, petCount]);

  if (status === "loading" && !pet) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#35d07f" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sceneWrap}>
          <GardenStage
            height={sceneHeight}
            variant="pet"
            petImageSources={sources}
            petLook={look}
            plants={scenePlants}
            allowOriginal
            petMood={mood}
            petReaction={reaction}
            onPetReactionEnd={() => setReaction(null)}
            onPetPress={handlePetTheDog}
            petScale={1.05}
            accessibilityLabel={`${displayName} in the garden. ${moodSentence(mood, displayName)}`}
          >
            <View style={styles.sceneTop} pointerEvents="box-none">
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {name || "Your pet"}
                </Text>
                <Pressable style={styles.renameButton} onPress={openRename} hitSlop={8} accessibilityRole="button" accessibilityLabel="Rename pet">
                  <Feather name="edit-2" size={14} color="#e2e8f0" />
                </Pressable>
              </View>
              <Text style={styles.moodLine}>{moodSentence(mood, displayName)}</Text>
            </View>
            <View style={styles.sceneBottom} pointerEvents="none">
              <View style={styles.hintPill}>
                <Feather name="heart" size={12} color="#f9a8d4" />
                <Text style={styles.hintText}>{petHint}</Text>
              </View>
            </View>
          </GardenStage>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>{streak === 1 ? "day in a row" : "days in a row"}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{together ?? "—"}</Text>
            <Text style={styles.statLabel}>{together === 1 ? "day together" : "days together"}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{scenePlants.filter((plant) => plant.level > 0).length}</Text>
            <Text style={styles.statLabel}>plants growing</Text>
          </View>
        </View>

        {isProcessing ? (
          <View style={styles.noticeCard}>
            <ActivityIndicator color="#35d07f" />
            <View style={styles.noticeBody}>
              <Text style={styles.noticeTitle}>Painting {displayName}…</Text>
              <Text style={styles.noticeText}>The photo is being turned into a portrait. This can take a minute.</Text>
            </View>
          </View>
        ) : isError ? (
          <View style={[styles.noticeCard, styles.noticeCardError]}>
            <Feather name="alert-circle" size={18} color="#fca5a5" />
            <View style={styles.noticeBody}>
              <Text style={styles.noticeTitle}>The portrait didn't finish</Text>
              <Text style={styles.noticeText}>{pet?.processing_error || "Something went wrong while painting."}</Text>
              <Pressable style={[styles.noticeButton, retrying && styles.tileDisabled]} onPress={handleRetryStylize} disabled={retrying}>
                <Text style={styles.noticeButtonText}>{retrying ? "Retrying…" : "Try painting again"}</Text>
              </Pressable>
            </View>
          </View>
        ) : hasAnyImage && !hasProcessedImage ? (
          <View style={styles.noticeCard}>
            <Feather name="image" size={18} color="#a7f3d0" />
            <View style={styles.noticeBody}>
              <Text style={styles.noticeTitle}>Showing the photo for now</Text>
              <Text style={styles.noticeText}>{displayName}'s painted portrait isn't ready yet. You can retry any time.</Text>
              <Pressable style={[styles.noticeButton, retrying && styles.tileDisabled]} onPress={handleRetryStylize} disabled={retrying}>
                <Text style={styles.noticeButtonText}>{retrying ? "Painting…" : "Paint the portrait"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable style={styles.playButton} onPress={() => navigation.navigate("Play")} accessibilityRole="button" accessibilityLabel={`Play with ${displayName}`}>
          <View style={styles.playIcon}>
            <Feather name="play" size={20} color="#0f172a" />
          </View>
          <View style={styles.playBody}>
            <Text style={styles.playTitle}>Play with {displayName}</Text>
            <Text style={styles.playHint}>Fetch · Bubbles</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#0f172a" />
        </Pressable>

        <View style={styles.tiles}>
          <ActionTile icon="message-circle" label="Talk" hint={`Chat with ${displayName}`} onPress={() => navigation.navigate("PetChat")} />
          <ActionTile icon="sun" label="Check in" hint="How are you today?" onPress={() => navigation.navigate("CheckIn")} />
          <ActionTile icon="feather" label={look ? "Change look" : "Choose look"} hint={look ? `${look.species === "cat" ? "Cat" : "Dog"} · colours, ears, markings` : "Dog or cat"} onPress={() => navigation.navigate("Onboarding", { mode: "look" })} />
          <ActionTile icon="camera" label={hasAnyImage ? "New photo" : "Add photo"} hint={hasAnyImage ? "Painted portrait" : "Optional portrait"} onPress={changePhoto} />
          <ActionTile icon="edit-3" label="Rename" hint={name ? name : "Pick a name"} onPress={openRename} />
        </View>
      </ScrollView>

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => (savingName ? null : setRenameOpen(false))}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{name ? "Rename your pet" : "Name your pet"}</Text>
            <TextInput
              value={nameDraft}
              onChangeText={(text) => {
                setNameDraft(text);
                if (nameError) setNameError("");
              }}
              placeholder="Enter a name"
              placeholderTextColor="rgba(148,163,184,0.9)"
              autoCapitalize="words"
              maxLength={PET_NAME_MAX_CHARS}
              editable={!savingName}
              style={styles.modalInput}
              autoFocus
            />
            {nameError ? <Text style={styles.modalError}>{nameError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setRenameOpen(false)} disabled={savingName}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalSave, savingName && styles.tileDisabled]} onPress={handleSaveName} disabled={savingName}>
                <Text style={styles.modalSaveText}>{savingName ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  content: { paddingBottom: 110 },
  sceneWrap: {
    overflow: "hidden",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  sceneTop: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
  },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    textShadowColor: "rgba(15,23,42,0.65)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    maxWidth: "80%",
  },
  renameButton: {
    marginLeft: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  moodLine: {
    marginTop: 4,
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(15,23,42,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sceneBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: "center",
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  hintText: { marginLeft: 6, color: "#f8fafc", fontSize: 12, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: "#e2e8f0", fontSize: 20, fontWeight: "800" },
  statLabel: { marginTop: 2, color: "rgba(148,163,184,0.9)", fontSize: 11, fontWeight: "600" },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  noticeCardError: { borderColor: "rgba(248,113,113,0.45)" },
  noticeBody: { flex: 1, marginLeft: 12 },
  noticeTitle: { color: "#e2e8f0", fontSize: 14, fontWeight: "700" },
  noticeText: { marginTop: 3, color: "rgba(203,213,225,0.9)", fontSize: 12, lineHeight: 17 },
  noticeButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(52,211,153,0.18)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.6)",
  },
  noticeButtonText: { color: "#a7f3d0", fontSize: 12, fontWeight: "700" },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#35d07f",
  },
  playIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(15,23,42,0.16)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  playBody: { flex: 1 },
  playTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  playHint: { marginTop: 2, color: "rgba(15,23,42,0.75)", fontSize: 12, fontWeight: "600" },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 12,
  },
  tile: {
    width: "48.5%",
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    minHeight: 96,
  },
  tilePrimary: { backgroundColor: "#35d07f", borderColor: "#35d07f" },
  tileDisabled: { opacity: 0.6 },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.18)",
  },
  tileIconPrimary: { backgroundColor: "rgba(15,23,42,0.16)" },
  tileLabel: { marginTop: 10, color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  tileLabelPrimary: { color: "#0f172a" },
  tileHint: { marginTop: 2, color: "rgba(148,163,184,0.9)", fontSize: 11 },
  tileHintPrimary: { color: "rgba(15,23,42,0.75)" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "#0f172a",
    padding: 16,
  },
  modalTitle: { color: "#e2e8f0", fontSize: 20, fontWeight: "800" },
  modalInput: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    backgroundColor: "rgba(15,23,42,0.55)",
    color: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalError: { marginTop: 8, color: "#fca5a5", fontSize: 12, fontWeight: "600" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  modalCancel: { paddingHorizontal: 14, paddingVertical: 10, marginRight: 6 },
  modalCancelText: { color: "rgba(148,163,184,0.95)", fontWeight: "700" },
  modalSave: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16a34a",
  },
  modalSaveText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
});
