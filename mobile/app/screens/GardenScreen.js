import React, { useMemo, useState } from "react";
import { SafeAreaView, View, Text, ActivityIndicator, StyleSheet, Pressable, FlatList } from "react-native";
import { notify } from "../../src/utils/confirm";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { getGardenProgress } from "../../src/services/dailyLoop";
import { fetchCatalog, fetchGardenPoints, fetchUserPlants, upgradePlant } from "../../src/services/garden";
import GardenScene from "../../src/components/GardenScene";
import PlantGlyph from "../../src/components/garden/PlantGlyph";
import { plantStageForLevel } from "../../src/domain/gardenScene";
import { sanctuaryCopy, sanctuaryFor, stageWord } from "../../src/domain/sanctuary";

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

const RARITY_COLORS = {
  uncommon: { bg: "rgba(103,232,249,0.14)", fg: "#a5f3fc" },
  rare: { bg: "rgba(165,180,252,0.16)", fg: "#c7d2fe" },
  epic: { bg: "rgba(249,168,212,0.16)", fg: "#fbcfe8" },
};

/**
 * The Garden tab: the sanctuary (garden for dogs, window nook for cats) and the plants that grow in it.
 * Points from small things go into growing them; nothing here counts down or punishes.
 */
export default function GardenScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { sources: petSources, name: petName, look: petLook, species, refresh: refreshPet } = usePet();
  const theme = sanctuaryFor(species);
  const copy = sanctuaryCopy(theme);
  const [loading, setLoading] = useState(true);
  const [progressCount, setProgressCount] = useState(0);
  const [catalogRows, setCatalogRows] = useState([]);
  const [userPlantsRows, setUserPlantsRows] = useState([]);
  const [pointsSummary, setPointsSummary] = useState({ remainingPoints: 0, earnedPoints: 0, spentPoints: 0 });
  const [upgradingPlantId, setUpgradingPlantId] = useState(null);

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
      } catch (error) {
        console.error("GARDEN_UPGRADE_ERROR", { message: error?.message || String(error), plantId: plant?.id });
        notify("That didn't take", error?.message || "Could not grow this plant just now.");
      } finally {
        setUpgradingPlantId(null);
      }
    },
    [loadGardenUpgradeData, upgradingPlantId, user?.id]
  );

  const remainingPoints = toSafeInt(pointsSummary?.remainingPoints, 0);
  const growing = plants.filter((plant) => plant.owned).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#35d07f" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={plants}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{copy.tabTitle}</Text>
              <Text style={styles.subtitle}>{copy.tabSubtitle}</Text>
            </View>
            <GardenScene petImageSources={petSources} petLook={petLook} plants={scenePlants} petName={petName || null} />
            <View style={styles.pointsCard}>
              <View style={styles.pointsMain}>
                <Text style={styles.pointsValue}>{remainingPoints}</Text>
                <View style={styles.pointsBody}>
                  <Text style={styles.pointsTitle}>points to spend</Text>
                  <Text style={styles.pointsMeta}>
                    {toSafeInt(pointsSummary?.earnedPoints, 0)} earned · {growing} {growing === 1 ? copy.plantWord : `${copy.plantWord}s`} growing
                  </Text>
                </View>
              </View>
              {progressCount > 0 ? (
                <Pressable style={styles.progressLink} onPress={() => navigation.navigate("GardenProgress")} hitSlop={6} accessibilityRole="button">
                  <Text style={styles.progressLinkText}>Earlier unlocks ({progressCount}) ›</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item }) => {
          const busy = upgradingPlantId === item.id;
          const affordable = item.isMax || remainingPoints >= item.nextCost;
          const buttonDisabled = !!upgradingPlantId || item.isMax || !affordable;
          const verb = item.owned ? copy.growVerb : copy.plantVerb;
          const buttonLabel = item.isMax ? "Fully grown" : busy ? "Growing…" : `${verb} · ${item.nextCost} pts`;
          const rarity = String(item.rarity || "common").toLowerCase();
          const rarityStyle = RARITY_COLORS[rarity];
          return (
            <View style={[styles.plantCard, item.isMax && styles.plantCardMax]}>
              <View style={styles.plantTop}>
                <PlantGlyph stage={item.stage} potted={theme === "nook"} width={44} height={66} />
                <View style={styles.plantHead}>
                  <Text style={styles.plantName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.plantStage}>{stageWord(item.stage, theme)}</Text>
                  {rarityStyle ? (
                    <View style={[styles.rarityPill, { backgroundColor: rarityStyle.bg }]}>
                      <Text style={[styles.rarityText, { color: rarityStyle.fg }]}>{rarity}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.dots} accessible accessibilityLabel={`Level ${item.level} of ${item.maxLevel}`}>
                {Array.from({ length: item.maxLevel }).map((_, index) => (
                  <View key={index} style={[styles.dot, index < item.level && styles.dotOn]} />
                ))}
              </View>
              <Pressable
                style={[styles.growButton, item.isMax ? styles.growButtonMax : item.owned ? styles.growButtonOwned : styles.growButtonNew, buttonDisabled && !item.isMax ? styles.growButtonDisabled : null]}
                disabled={buttonDisabled}
                onPress={() => handleUpgrade(item)}
                accessibilityRole="button"
                accessibilityLabel={`${buttonLabel} ${item.name}`}
              >
                <Text style={[styles.growButtonText, item.isMax && styles.growButtonTextMax]}>{buttonLabel}</Text>
              </Pressable>
              {!item.isMax && !affordable ? <Text style={styles.needMore}>{item.nextCost - remainingPoints} more to go</Text> : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No plants configured yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1420", paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  header: { marginTop: 6, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#f8fafc" },
  subtitle: { marginTop: 3, fontSize: 13, color: "rgba(148,163,184,0.9)" },
  listContent: { paddingBottom: 90, paddingTop: 6 },
  pointsCard: {
    marginTop: 12,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.28)",
    backgroundColor: "rgba(53,208,127,0.10)",
  },
  pointsMain: { flexDirection: "row", alignItems: "center" },
  pointsValue: { color: "#f8fafc", fontSize: 32, fontWeight: "800", marginRight: 12, minWidth: 48 },
  pointsBody: { flex: 1 },
  pointsTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  pointsMeta: { color: "rgba(148,163,184,0.9)", fontSize: 12, marginTop: 2 },
  progressLink: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 2 },
  progressLinkText: { color: "#86efac", fontSize: 12, fontWeight: "600" },
  gridRow: { justifyContent: "space-between" },
  plantCard: {
    width: "48.5%",
    marginBottom: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(18,24,38,0.95)",
  },
  plantCardMax: { borderColor: "rgba(53,208,127,0.35)" },
  plantTop: { flexDirection: "row", alignItems: "center" },
  plantHead: { flex: 1, marginLeft: 8 },
  plantName: { color: "#f8fafc", fontSize: 15, fontWeight: "700" },
  plantStage: { marginTop: 2, color: "rgba(148,163,184,0.9)", fontSize: 12 },
  rarityPill: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  rarityText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  dots: { flexDirection: "row", gap: 5, marginTop: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "rgba(148,163,184,0.22)" },
  dotOn: { backgroundColor: "#35d07f" },
  growButton: {
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  growButtonOwned: { borderColor: "rgba(53,208,127,0.6)", backgroundColor: "rgba(53,208,127,0.16)" },
  growButtonNew: { borderColor: "rgba(148,163,184,0.35)", backgroundColor: "rgba(148,163,184,0.12)" },
  growButtonMax: { borderColor: "transparent", backgroundColor: "transparent" },
  growButtonDisabled: { opacity: 0.45 },
  growButtonText: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  growButtonTextMax: { color: "#86efac" },
  needMore: { marginTop: 6, color: "rgba(148,163,184,0.75)", fontSize: 11, textAlign: "center" },
  emptyText: { color: "rgba(148,163,184,0.85)", marginTop: 20, textAlign: "center" },
});
