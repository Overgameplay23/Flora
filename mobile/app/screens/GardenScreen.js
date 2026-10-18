import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { notify } from "../../src/utils/confirm";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { getGardenProgress } from "../../src/services/dailyLoop";
import { fetchCatalog, fetchGardenPoints, fetchUserPlants, upgradePlant } from "../../src/services/garden";
import GardenStage from "../../src/components/garden/GardenStage";
import SceneOverlay, { SceneChip } from "../../src/components/garden/SceneOverlay";
import PlantGlyph from "../../src/components/garden/PlantGlyph";
import Button from "../../src/components/common/Button";
import Chip from "../../src/components/common/Chip";
import { SectionTitle } from "../../src/components/common/Headings";
import { PetEmptyState, PetLoading } from "../../src/components/pet/PetMoments";
import { plantStageForLevel } from "../../src/domain/gardenScene";
import { sanctuaryCopy, sanctuaryFor, stageWord } from "../../src/domain/sanctuary";
import { useSceneStatusBar } from "../../src/hooks/useSceneStatusBar";
import { useTheme, useThemeHour } from "../../src/theme/theme";
import { brand, fonts, radius, type } from "../../src/theme/tokens";
import { tapSoft, warning } from "../../src/utils/haptics";

function toSafeInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function toUpgradeCost(plant, level) {
  const currentLevel = Math.max(0, toSafeInt(level, 0));
  const exponent = currentLevel <= 0 ? 0 : currentLevel - 1;
  const baseCost = Math.max(1, toSafeInt(plant?.base_cost, 10));
  const multiplier = Number(plant?.cost_multiplier);
  const safeMultiplier = Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 1.6;
  return Math.ceil(baseCost * Math.pow(safeMultiplier, exponent));
}

// rarity reads as a colour family, not a loot tier: teal, lavender, rose
const RARITY_CATEGORY = { uncommon: "focus", rare: "calm", epic: "connection" };

/**
 * The Garden tab: the sanctuary (garden for dogs, window nook for cats) and the plants that grow in it.
 * Sprouts from small things go into growing them; nothing here counts down or punishes. The painted scene
 * runs full-bleed under the status bar, with a warm paper sheet over its lower edge, as on Home.
 */
export default function GardenScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { sources: petSources, name: petName, look: petLook, species, memorial, refresh: refreshPet } = usePet();
  const theme = sanctuaryFor(species);
  const copy = sanctuaryCopy(theme);
  const appTheme = useTheme();
  const { surface, sky } = appTheme;
  const hour = useThemeHour();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sceneHeight = Math.round(Math.min(440, Math.max(320, height * 0.44)));
  const cardWidth = Math.floor((Math.min(width, 640) - 40 - 12) / 2);
  const overSceneNight = sky.statusBar === "light";
  useSceneStatusBar(sky.statusBar);
  const [loading, setLoading] = useState(true);
  const [progressCount, setProgressCount] = useState(0);
  const [catalogRows, setCatalogRows] = useState([]);
  const [userPlantsRows, setUserPlantsRows] = useState([]);
  const [pointsSummary, setPointsSummary] = useState({ remainingPoints: 0, earnedPoints: 0, spentPoints: 0 });
  const [upgradingPlantId, setUpgradingPlantId] = useState(null);
  const [reaction, setReaction] = useState(null);

  const loadPet = React.useCallback(async () => {
    if (!user?.id) {
      setProgressCount(0);
      return;
    }
    await refreshPet();
    try {
      const progress = await getGardenProgress(user.id);
      setProgressCount(progress.rows?.length ?? 0);
    } catch (error) {
      console.error("GARDEN_PROGRESS_LOAD_ERROR", { message: error?.message });
    }
  }, [refreshPet, user?.id]);

  const loadGardenUpgradeData = React.useCallback(async () => {
    if (!user?.id) {
      setCatalogRows([]);
      setUserPlantsRows([]);
      setPointsSummary({ remainingPoints: 0, earnedPoints: 0, spentPoints: 0 });
      return;
    }
    const [catalog, userPlants, points] = await Promise.all([fetchCatalog(), fetchUserPlants(), fetchGardenPoints()]);
    setCatalogRows(Array.isArray(catalog) ? catalog : []);
    setUserPlantsRows(Array.isArray(userPlants) ? userPlants : []);
    setPointsSummary(points || { remainingPoints: 0, earnedPoints: 0, spentPoints: 0 });
  }, [user?.id]);

  const loadScreenData = React.useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPet(), loadGardenUpgradeData()]);
    } catch (error) {
      console.error("GARDEN_SCREEN_LOAD_ERROR", { message: error?.message || String(error) });
    } finally {
      setLoading(false);
    }
  }, [loadGardenUpgradeData, loadPet]);

  useFocusEffect(
    React.useCallback(() => {
      loadScreenData();
    }, [loadScreenData])
  );

  const plantById = useMemo(() => {
    const next = new Map();
    (userPlantsRows || []).forEach((row) => {
      if (!row?.plant_id) return;
      next.set(String(row.plant_id), row);
    });
    return next;
  }, [userPlantsRows]);

  const plants = useMemo(
    () =>
      (catalogRows || []).map((plant) => {
        const owned = plantById.get(String(plant.id)) || null;
        const level = toSafeInt(owned?.level, 0);
        const maxLevel = Math.max(1, toSafeInt(plant?.max_level, 5));
        const isMax = level >= maxLevel;
        const nextCost = isMax ? 0 : toUpgradeCost(plant, level);
        return {
          ...plant,
          owned: !!owned,
          level,
          maxLevel,
          isMax,
          nextCost,
          stage: plantStageForLevel(level, maxLevel),
        };
      }),
    [catalogRows, plantById]
  );

  // Owned plants for the scene: each is rooted in the painted soil patch at its growth stage.
  const scenePlants = useMemo(
    () =>
      plants
        .filter((plant) => plant.owned)
        .map((plant) => ({
          id: String(plant.id),
          level: plant.level,
          maxLevel: plant.maxLevel,
          purchasedAt: plantById.get(String(plant.id))?.purchased_at || null,
        })),
    [plants, plantById]
  );

  const handleUpgrade = React.useCallback(
    async (plant) => {
      if (!user?.id || !plant?.id || upgradingPlantId) return;
      setUpgradingPlantId(plant.id);
      try {
        const result = await upgradePlant(String(plant.id));
        setPointsSummary((prev) => ({
          ...prev,
          remainingPoints: toSafeInt(result?.remainingPoints, prev?.remainingPoints || 0),
        }));
        await loadGardenUpgradeData();
        // the pet notices the garden growing
        tapSoft();
        setReaction("cheer");
      } catch (error) {
        console.error("GARDEN_UPGRADE_ERROR", { message: error?.message || String(error), plantId: plant?.id });
        warning();
        notify("That didn't take", error?.message || "Could not grow this plant just now.");
      } finally {
        setUpgradingPlantId(null);
      }
    },
    [loadGardenUpgradeData, upgradingPlantId, user?.id]
  );

  const remainingPoints = toSafeInt(pointsSummary?.remainingPoints, 0);
  const growing = plants.filter((plant) => plant.owned).length;
  const plantLabel = (count) => (count === 1 ? copy.plantWord : `${copy.plantWord}s`);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: surface.canvas, paddingTop: insets.top }]}>
        <PetLoading label={copy.tabTitle} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: surface.canvas }]}>
      <FlatList
        data={plants}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <GardenStage
              height={sceneHeight}
              variant="garden"
              theme={theme}
              hour={hour}
              petImageSources={petSources}
              petLook={petLook}
              plants={scenePlants}
              petResting={!!memorial}
              petWander
              petReaction={reaction}
              onPetReactionEnd={() => setReaction(null)}
              accessibilityLabel={`${petName || "Your pet"} ${memorial ? "resting in" : "in"} the ${copy.place}. ${
                growing === 0 ? "Nothing is planted yet." : `${growing} ${plantLabel(growing)} growing.`
              }`}
            >
              <SceneOverlay
                sky={sky}
                topInset={insets.top}
                title={copy.tabTitle}
                subtitle={copy.tabSubtitle}
                right={<SceneChip icon="leaf" iconColor={brand.sprout} iconTint={brand.sproutTint} value={String(remainingPoints)} label="Sprouts" night={overSceneNight} />}
              />
            </GardenStage>

            <View style={[styles.sheet, { backgroundColor: surface.canvas }]}>
              <View style={[styles.sproutsCard, { backgroundColor: surface.isNight ? surface.paper : brand.sproutTint, boxShadow: surface.shadow }]}>
                <View style={[styles.sproutsIcon, { backgroundColor: surface.isNight ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)" }]}>
                  <Ionicons name="leaf" size={24} color={surface.isNight ? appTheme.tone("body").mid : brand.sprout} />
                </View>
                <View style={styles.sproutsBody}>
                  <Text style={[styles.sproutsValue, { color: surface.text }]}>
                    {remainingPoints} <Text style={[type.bodyStrong, { color: surface.text }]}>Sprouts to spend</Text>
                  </Text>
                  <Text style={[type.meta, { color: surface.textSecondary }]}>
                    {toSafeInt(pointsSummary?.earnedPoints, 0)} earned from small things · {growing} {plantLabel(growing)} growing
                  </Text>
                  {progressCount > 0 ? (
                    <Pressable style={styles.progressLink} onPress={() => navigation.navigate("GardenProgress")} hitSlop={8} accessibilityRole="link">
                      <Text style={[type.meta, { color: appTheme.link, fontFamily: fonts.bodyBold }]}>Earlier unlocks ({progressCount})</Text>
                      <Ionicons name="chevron-forward" size={14} color={appTheme.link} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {plants.length > 0 ? <SectionTitle>{theme === "nook" ? "Pots for the sill" : "Plants for the garden"}</SectionTitle> : null}
            </View>
          </>
        }
        renderItem={({ item }) => {
          const busy = upgradingPlantId === item.id;
          const affordable = item.isMax || remainingPoints >= item.nextCost;
          const buttonDisabled = !!upgradingPlantId || item.isMax || !affordable;
          const verb = item.owned ? copy.growVerb : copy.plantVerb;
          const rarity = String(item.rarity || "common").toLowerCase();
          const rarityCategory = RARITY_CATEGORY[rarity];
          const tone = appTheme.tone("body");
          return (
            <View style={[styles.plantCard, { width: cardWidth, backgroundColor: item.owned ? tone.fill : surface.paper, boxShadow: surface.shadow }]}>
              <View style={[styles.plantWell, { backgroundColor: item.owned ? tone.tileOnFill : surface.sunken }]}>
                <PlantGlyph stage={item.stage} potted={theme === "nook"} width={48} height={72} />
                {item.isMax ? (
                  <View style={[styles.maxBadge, { backgroundColor: surface.isNight ? tone.mid : tone.strong }]}>
                    <Ionicons name="checkmark" size={14} color={surface.isNight ? surface.canvas : brand.cream} />
                  </View>
                ) : null}
              </View>
              <Text style={[type.bodyStrong, styles.plantName, { color: surface.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[type.meta, { color: surface.textSecondary }]}>{stageWord(item.stage, theme)}</Text>
              {rarityCategory ? <Chip label={rarity.charAt(0).toUpperCase() + rarity.slice(1)} category={rarityCategory} selected style={styles.rarity} /> : null}
              <View style={styles.dots} accessible accessibilityLabel={`Level ${item.level} of ${item.maxLevel}`}>
                {Array.from({ length: item.maxLevel }).map((_, index) => (
                  <View key={index} style={[styles.dot, { backgroundColor: index < item.level ? (surface.isNight ? tone.mid : brand.sprout) : surface.track }]} />
                ))}
              </View>
              {item.isMax ? (
                <Text style={[type.meta, styles.fullyGrown, { color: tone.accent }]}>Fully grown</Text>
              ) : (
                <Button
                  label={busy ? "Growing…" : `${verb} · ${item.nextCost}`}
                  icon={busy ? undefined : "leaf"}
                  size="sm"
                  variant={item.owned ? "secondary" : "primary"}
                  block
                  disabled={buttonDisabled}
                  loading={busy}
                  onPress={() => handleUpgrade(item)}
                  accessibilityLabel={`${verb} ${item.name} for ${item.nextCost} Sprouts`}
                  containerStyle={styles.growButton}
                />
              )}
              {!item.isMax && !affordable ? (
                <Text style={[type.meta, styles.needMore, { color: surface.textTertiary }]}>{item.nextCost - remainingPoints} more Sprouts to go</Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <PetEmptyState
            title={`Nothing to ${copy.plantVerb.toLowerCase()} yet`}
            body="The seed shelf is empty right now. Come back after a little care and there will be something to grow."
            mood="calm"
            size={96}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingBottom: 100 },
  sheet: {
    marginTop: -30,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: "continuous",
    paddingTop: 22,
    paddingHorizontal: 20,
  },
  sproutsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  sproutsIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  sproutsBody: { flex: 1, marginLeft: 14 },
  sproutsValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  progressLink: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 6, alignSelf: "flex-start" },
  gridRow: { justifyContent: "space-between", paddingHorizontal: 20, maxWidth: 640, width: "100%", alignSelf: "center" },
  plantCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  plantWell: {
    height: 92,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6,
  },
  maxBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  plantName: { marginTop: 10 },
  rarity: { alignSelf: "flex-start", marginTop: 6, minHeight: 24, paddingHorizontal: 9 },
  dots: { flexDirection: "row", gap: 5, marginTop: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  growButton: { marginTop: 12 },
  fullyGrown: { marginTop: 12, fontFamily: fonts.bodyBold },
  needMore: { marginTop: 6, textAlign: "center" },
});
