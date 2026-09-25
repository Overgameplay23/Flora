import React, { useMemo, useState } from "react";
import { SafeAreaView, View, Text, ActivityIndicator, StyleSheet, Pressable, FlatList, Alert } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { getGardenProgress } from "../../src/services/dailyLoop";
import { fetchCatalog, fetchGardenPoints, fetchUserPlants, upgradePlant } from "../../src/services/garden";
import GardenScene from "../../src/components/GardenScene";

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

export default function GardenScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { sources: petSources, name: petName, look: petLook, refresh: refreshPet } = usePet();
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
        Alert.alert("Upgrade failed", error?.message || "Could not upgrade this plant.");
      } finally {
        setUpgradingPlantId(null);
      }
    },
    [loadGardenUpgradeData, upgradingPlantId, user?.id]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
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
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Your Garden</Text>
              <Text style={styles.subtitle}>Grow your collection and upgrade levels with points.</Text>
            </View>
            <GardenScene petImageSources={petSources} petLook={petLook} plants={scenePlants} petName={petName || null} />
            <View style={styles.pointsCard}>
              <Text style={styles.pointsTitle}>Available points: {toSafeInt(pointsSummary?.remainingPoints, 0)}</Text>
              <Text style={styles.pointsMeta}>
                Earned {toSafeInt(pointsSummary?.earnedPoints, 0)} · Spent {toSafeInt(pointsSummary?.spentPoints, 0)}
              </Text>
              <View style={styles.pointsFooterRow}>
                <Text style={styles.pointsMeta}>Legacy unlocks: {progressCount}</Text>
                <Pressable style={styles.progressLink} onPress={() => navigation.navigate("GardenProgress")} hitSlop={6}>
                  <Text style={styles.progressLinkText}>View legacy progress</Text>
                </Pressable>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const buttonDisabled = !!upgradingPlantId || item.isMax;
          const buttonLabel = item.isMax
            ? "Max level"
            : upgradingPlantId === item.id
              ? "Updating..."
              : item.owned
                ? `Upgrade (${item.nextCost})`
                : `Unlock (${item.nextCost})`;
          return (
            <View style={styles.plantCard}>
              <Text style={styles.plantName}>{item.name}</Text>
              <Text style={styles.plantMeta}>
                {item.owned ? `Lvl ${item.level}/${item.maxLevel}` : "Locked"} · {String(item.rarity || "common")}
              </Text>
              {!item.isMax ? <Text style={styles.plantMeta}>Next cost: {item.nextCost} pts</Text> : null}
              <Pressable
                style={[
                  styles.upgradeButton,
                  item.isMax ? styles.upgradeButtonMax : item.owned ? styles.upgradeButtonOwned : styles.upgradeButtonLocked,
                  buttonDisabled ? styles.upgradeButtonDisabled : null,
                ]}
                disabled={buttonDisabled}
                onPress={() => handleUpgrade(item)}
              >
                <Text style={styles.upgradeButtonText}>{buttonLabel}</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No plants configured yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginTop: 6, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#e2e8f0" },
  subtitle: { fontSize: 12, color: "rgba(148,163,184,0.85)" },
  listContent: { paddingBottom: 90, paddingTop: 6 },
  pointsCard: {
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  pointsTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  pointsMeta: { color: "rgba(148,163,184,0.85)", fontSize: 12, marginTop: 4 },
  gridRow: { justifyContent: "space-between" },
  plantCard: {
    width: "48.5%",
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  plantName: { color: "#e2e8f0", fontSize: 14, fontWeight: "700" },
  plantMeta: {
    marginTop: 4,
    color: "rgba(148,163,184,0.85)",
    fontSize: 11,
  },
  upgradeButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeButtonOwned: {
    borderColor: "rgba(52,211,153,0.65)",
    backgroundColor: "rgba(16,185,129,0.18)",
  },
  upgradeButtonLocked: {
    borderColor: "rgba(59,130,246,0.55)",
    backgroundColor: "rgba(37,99,235,0.16)",
  },
  upgradeButtonMax: {
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(148,163,184,0.16)",
  },
  upgradeButtonDisabled: {
    opacity: 0.7,
  },
  upgradeButtonText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: {
    color: "rgba(148,163,184,0.85)",
    marginTop: 20,
    textAlign: "center",
  },
  pointsFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLink: {
    marginTop: 4,
    paddingVertical: 2,
  },
  progressLinkText: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "600",
  },
});
