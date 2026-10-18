import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Chip from "../components/common/Chip";
import Sheet from "../components/common/Sheet";
import { ScreenTitle, SectionTitle } from "../components/common/Headings";
import PetPortrait, { type PetReaction } from "../components/pet/PetPortrait";
import SpeechBubble from "../components/pet/SpeechBubble";
import { accessoryArt } from "../components/wardrobe/art";
import { usePet } from "../hooks/usePet";
import { useWardrobe, type BuyResult } from "../services/wardrobeStore";
import { fetchGardenPoints } from "../services/garden";
import { WARDROBE_CATEGORIES, SLOT_LABELS, inSeason, itemsFor, wardrobeItem } from "../domain/wardrobe/catalog";
import { cleanOutfit, fittingCta, takeOff, tasksToGo, toggleItem, type FittingCta } from "../domain/wardrobe/fittingRoom";
import type { FitAdjust, OutfitSelection, OutfitSlot, WardrobeCategory, WardrobeItem } from "../domain/wardrobe/types";
import { useTheme } from "../theme/theme";
import { brand, fonts, radius, type } from "../theme/tokens";
import * as haptics from "../utils/haptics";

// The Wardrobe: a fitting room with the user's own pet. Trying on is instant and free (items are drawn over the
// pet at its anchor points); keeping something costs Sprouts, which only care earns. One main button says
// what is possible right now, kindly, including "not yet".

const SLOTS: OutfitSlot[] = ["head", "face", "neck"];
const COLLECTION_ORDER = ["Everyday", "Garden Party", "Autumn"];
const NUDGE = 0.015;
const SCALE_STEP = 0.06;

function ItemArt({ item, size }: { item: WardrobeItem; size: number }) {
  const art = accessoryArt(item.art);
  if (!art) return <Ionicons name="shirt-outline" size={size * 0.5} color="rgba(46,40,56,0.4)" />;
  // fit inside a size x 1.1*size box, keeping the drawing's aspect
  const drawWidth = Math.min(size, (size * 1.1) / Math.max(0.1, art.aspect));
  const Art = art.Component;
  return <Art width={drawWidth} height={drawWidth * art.aspect} />;
}

function petLineFor(cta: FittingCta, petName: string): string {
  switch (cta.kind) {
    case "wearing":
      return `${petName} feels great in this.`;
    case "wear":
      return "Let's go with this look!";
    case "claim":
      return "A gift? For me? I love it.";
    case "buy":
      return `Ooh, the ${cta.item.name.toLowerCase()}? I think it suits me.`;
    case "short":
      return `Almost! About ${tasksToGo(cta.missing)} more care ${tasksToGo(cta.missing) === 1 ? "task" : "tasks"} and it's ours.`;
    case "season":
      return "That one comes back every autumn.";
    default:
      return "We can play dress-up now. Keeping things comes very soon.";
  }
}

export default function WardrobeScreen() {
  const theme = useTheme();
  const { surface, sky, night } = theme;
  const { width } = useWindowDimensions();
  const pet = usePet();
  const species = pet.species === "cat" ? "cat" : "dog";
  const wardrobe = useWardrobe();
  const worn = useMemo(() => cleanOutfit(wardrobe.outfit), [wardrobe.outfit]);

  const [trying, setTrying] = useState<OutfitSelection>(worn);
  const [lastTriedId, setLastTriedId] = useState<string | null>(null);
  const [category, setCategory] = useState<WardrobeCategory | "all">("all");
  const [balance, setBalance] = useState<number | null>(null);
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [confirm, setConfirm] = useState<WardrobeItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fitOpen, setFitOpen] = useState(false);
  const [fitDraft, setFitDraft] = useState<FitAdjust>(wardrobe.fit);
  const [line, setLine] = useState<string | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  // The tab stays mounted, so the focus callback below is the first render's: it reads the live outfit through
  // a ref. Until the person starts trying things, the stage also follows the store when it loads or changes.
  const outfitRef = useRef(wardrobe.outfit);
  outfitRef.current = wardrobe.outfit;
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setTrying(worn);
  }, [worn]);

  const loadBalance = useCallback(async () => {
    try {
      const summary = await fetchGardenPoints();
      setBalance(summary.remainingPoints);
    } catch (_error) {
      setBalance(null);
    }
  }, []);

  // each visit starts from what the pet actually wears
  useFocusEffect(
    useCallback(() => {
      void wardrobe.refresh();
      void loadBalance();
      touched.current = false;
      setTrying(cleanOutfit(outfitRef.current));
      setLastTriedId(null);
      setNotice(null);
      setLine(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadBalance])
  );

  const cta = fittingCta({ worn, trying, owned: wardrobe.owned, balance, serverReady: wardrobe.serverReady, lastTriedId });
  const petName = pet.displayName;

  const onTry = (item: WardrobeItem) => {
    haptics.selection();
    setNotice(null);
    setLine(null);
    touched.current = true;
    setTrying((prev) => toggleItem(prev, item));
    setLastTriedId(item.id);
    setReaction("wiggle");
  };

  const wearLook = async (outfit: OutfitSelection) => {
    setBusy(true);
    const ok = await wardrobe.equip(outfit, wardrobe.fit);
    setBusy(false);
    if (ok) {
      haptics.success();
      setReaction("love");
      setLine(`${petName} is wearing it now. Everywhere.`);
    } else {
      haptics.warning();
      setNotice("Couldn't save the look. Try again in a moment.");
    }
  };

  const getItem = async (item: WardrobeItem) => {
    setBusy(true);
    setNotice(null);
    const result = await wardrobe.buy(item.id);
    if (result.ok === false) {
      // (the project runs without strictNullChecks, so the union is narrowed by hand)
      const failure = result as Extract<BuyResult, { ok: false }>;
      setBusy(false);
      setConfirm(null);
      haptics.warning();
      setNotice(failure.message);
      if (failure.reason === "insufficient") void loadBalance();
      return;
    }
    if (result.remainingSprouts != null) setBalance(result.remainingSprouts);
    else void loadBalance();
    setConfirm(null);
    // bought to be worn: put on what is owned now (another tried piece that is not owned yet stays on the stage
    // and is offered next)
    const ownedNow = new Set([...wardrobe.owned, item.id]);
    const look = Object.fromEntries(Object.entries(trying).filter(([, id]) => !!id && ownedNow.has(id))) as OutfitSelection;
    const ok = await wardrobe.equip(look, wardrobe.fit);
    setBusy(false);
    if (ok) {
      haptics.success();
      setReaction("love");
      setLine(`${item.name}! ${petName} loves it.`);
    } else {
      setLine(`The ${item.name.toLowerCase()} is yours.`);
      setNotice("It's in your wardrobe. Tap Wear this look to put it on.");
    }
  };

  const onMainButton = () => {
    if (busy) return;
    if (cta.kind === "wear") void wearLook(trying);
    else if (cta.kind === "claim") void getItem(cta.item);
    else if (cta.kind === "buy") setConfirm(cta.item);
  };

  const mainLabel = (() => {
    switch (cta.kind) {
      case "wearing":
        return "Wearing this look";
      case "wear":
        return "Wear this look";
      case "claim":
        return `Claim the ${cta.item.name.toLowerCase()} · free`;
      case "buy":
        return `Get it · ${cta.price} Sprouts`;
      case "short":
        return `Need ${cta.missing} more Sprouts`;
      case "season":
        return "Back next autumn";
      default:
        return "Try-on only for now";
    }
  })();
  const mainEnabled = cta.kind === "wear" || cta.kind === "claim" || cta.kind === "buy";

  const items = itemsFor(species).filter((item) => category === "all" || item.category === category);
  const sections = COLLECTION_ORDER.map((collection) => ({ collection, items: items.filter((item) => item.collection === collection) })).filter(
    (section) => section.items.length > 0
  );
  const owned = new Set(wardrobe.owned);
  const columnWidth = Math.floor((Math.min(width, 520) - 40 - 10) / 2);
  const stageSize = Math.min(240, Math.round(width * 0.58));

  return (
    <Screen topInset bottomPad={60}>
      <View style={styles.headerRow}>
        <ScreenTitle>Wardrobe</ScreenTitle>
        <View style={[styles.sprouts, { backgroundColor: surface.paper, boxShadow: surface.shadow }]} accessible accessibilityLabel={`${balance ?? "Unknown"} Sprouts`}>
          <View style={[styles.sproutIcon, { backgroundColor: brand.sproutTint }]}>
            <Ionicons name="leaf" size={14} color={brand.sprout} />
          </View>
          <Text style={[styles.sproutValue, { color: surface.text }]}>{balance ?? "–"}</Text>
          <Text style={[type.meta, { color: surface.textSecondary }]}>Sprouts</Text>
        </View>
      </View>

      {/* the fitting room */}
      {/* the backdrop clips to its rounded card; the pet layer does not, so a tall hat is never cut off */}
      <View style={styles.stage}>
        <View style={[styles.backdrop, { boxShadow: surface.shadow }]}>
          <LinearGradient colors={night ? [sky.top, surface.paper] : [sky.mid, surface.paper]} style={StyleSheet.absoluteFill} />
          <View style={[styles.floor, { backgroundColor: night ? "rgba(255,255,255,0.05)" : "rgba(78,138,62,0.12)" }]} />
        </View>
        <View style={styles.petSlot}>
          <PetPortrait
            sources={pet.sources}
            look={pet.look}
            size={stageSize}
            mood="happy"
            reaction={reaction}
            onReactionEnd={() => setReaction(null)}
            outfit={trying}
            fit={fitOpen ? fitDraft : undefined}
            emptyLabel="Add your pet"
            accessibilityLabel={`${petName} in the fitting room`}
          />
        </View>
        {/* after the pet, so the pet's words stay readable over whatever it is wearing */}
        <View style={styles.bubbleSlot} pointerEvents="none">
          <SpeechBubble text={line ?? petLineFor(cta, petName)} tail="bottom-left" night={night} maxWidth={Math.min(260, width - 80)} />
        </View>
      </View>

      {/* what is on, piece by piece */}
      <View style={styles.onRow}>
        {SLOTS.map((slot) => {
          const item = wardrobeItem(trying[slot]);
          if (!item) return null;
          return (
            <Pressable
              key={slot}
              onPress={() => {
                touched.current = true;
                setTrying((prev) => takeOff(prev, slot));
              }}
              accessibilityRole="button"
              accessibilityLabel={`Take off the ${item.name}`}
              style={[styles.onChip, { backgroundColor: theme.tone(item.tone).fill }]}
            >
              <Text style={[type.meta, { color: surface.text }]} numberOfLines={1}>
                {SLOT_LABELS[slot]}: {item.name}
              </Text>
              <Ionicons name="close" size={14} color={surface.textSecondary} />
            </Pressable>
          );
        })}
        {Object.keys(trying).length > 0 && wardrobe.serverReady ? (
          <Pressable
            onPress={() => {
              setFitDraft(wardrobe.fit);
              setFitError(null);
              setFitOpen(true);
            }}
            accessibilityRole="button"
            style={[styles.onChip, { backgroundColor: surface.sunken }]}
          >
            <Ionicons name="move-outline" size={14} color={surface.textSecondary} />
            <Text style={[type.meta, { color: surface.text }]}>Adjust fit</Text>
          </Pressable>
        ) : null}
      </View>

      <Button
        label={mainLabel}
        onPress={onMainButton}
        variant={mainEnabled ? "primary" : "secondary"}
        disabled={!mainEnabled || busy}
        loading={busy && cta.kind !== "buy"}
        icon={cta.kind === "buy" || cta.kind === "short" ? "leaf" : cta.kind === "wearing" ? "checkmark" : undefined}
        containerStyle={styles.mainButton}
      />
      {notice ? <Text style={[type.meta, styles.notice, { color: theme.alert }]}>{notice}</Text> : null}
      {cta.kind === "notReady" ? (
        <Text style={[type.meta, styles.notice, { color: surface.textSecondary }]}>
          Try on anything. Keeping items opens as soon as the latest update reaches the server.
        </Text>
      ) : null}

      {/* the shelves */}
      <View style={styles.chips}>
        {WARDROBE_CATEGORIES.map((option) => (
          <Chip key={option.id} label={option.label} icon={option.icon} selected={category === option.id} onPress={() => setCategory(option.id)} category="play" />
        ))}
      </View>

      {sections.map((section) => {
        const autumnNow = section.collection === "Autumn" ? inSeason(section.items[0]) : true;
        return (
          <View key={section.collection}>
            <SectionTitle>{section.collection}</SectionTitle>
            {section.collection === "Autumn" ? (
              <Text style={[type.meta, styles.sectionHint, { color: surface.textSecondary }]}>
                {autumnNow ? "In season now, and back every autumn." : "Returns every autumn. Anything you own stays yours."}
              </Text>
            ) : null}
            <View style={styles.grid}>
              {section.items.map((item) => {
                const isOwned = owned.has(item.id);
                const isWorn = worn[item.slot] === item.id;
                const isTrying = trying[item.slot] === item.id;
                const tone = theme.tone(item.tone);
                const status = isWorn ? "Wearing" : isOwned ? "Owned" : item.priceSprouts === 0 ? "Free gift" : String(item.priceSprouts);
                return (
                  <Card
                    key={item.id}
                    tone={item.tone}
                    onPress={() => onTry(item)}
                    accessibilityLabel={`${item.name}. ${item.description} ${isOwned ? "Owned." : item.priceSprouts === 0 ? "Free." : `${item.priceSprouts} Sprouts.`}${isTrying ? " Trying on." : ""}`}
                    containerStyle={{ width: columnWidth }}
                    style={[styles.itemCard, isTrying && { borderColor: tone.accent, borderWidth: 2 }]}
                  >
                    <View style={[styles.itemArt, { backgroundColor: tone.tileOnFill }]}>
                      <ItemArt item={item} size={Math.round(columnWidth * 0.5)} />
                    </View>
                    <Text style={[type.bodyStrong, styles.itemName, { color: surface.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.itemMeta}>
                      {!isOwned && item.priceSprouts > 0 ? <Ionicons name="leaf" size={13} color={brand.sprout} /> : null}
                      <Text style={[styles.itemStatus, { color: isOwned ? tone.accent : surface.textSecondary }]}>{status}</Text>
                      {item.rarity !== "common" ? (
                        <Text style={[styles.rarity, { color: tone.accent }]}>{item.rarity === "rare" ? "Rare" : "Special"}</Text>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* get it? */}
      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        locked={busy}
        title={confirm ? `Get the ${confirm.name.toLowerCase()}?` : null}
        subtitle={confirm ? `${confirm.priceSprouts} Sprouts. Yours to keep, always.` : null}
        pet={{ mood: "happy", size: 72 }}
        footer={
          <View style={styles.sheetButtons}>
            <Button label={confirm ? `Get it · ${confirm.priceSprouts} Sprouts` : "Get it"} icon="leaf" onPress={() => confirm && getItem(confirm)} loading={busy} />
            <Button label="Not now" variant="quiet" onPress={() => setConfirm(null)} disabled={busy} />
          </View>
        }
      >
        {confirm ? <Text style={[type.callout, { color: surface.textSecondary }]}>{confirm.description}</Text> : null}
      </Sheet>

      {/* adjust fit */}
      <Sheet
        visible={fitOpen}
        onClose={() => setFitOpen(false)}
        locked={busy}
        title="Adjust the fit"
        subtitle={`Every pet is shaped a little differently. Nudge each piece until it sits just right on ${petName}.`}
        footer={
          <View style={styles.sheetButtons}>
            <Button
              label="Save the fit"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                const ok = await wardrobe.equip(worn, fitDraft);
                setBusy(false);
                if (ok) {
                  haptics.success();
                  setFitOpen(false);
                } else {
                  haptics.warning();
                  setFitError("Couldn't save the fit. Try again in a moment.");
                }
              }}
            />
            <Button label="Cancel" variant="quiet" onPress={() => setFitOpen(false)} disabled={busy} />
          </View>
        }
      >
        {fitError ? <Text style={[type.meta, styles.fitError, { color: theme.alert }]}>{fitError}</Text> : null}
        <View style={styles.fitPreview}>
          <PetPortrait sources={pet.sources} look={pet.look} size={180} mood="calm" outfit={trying} fit={fitDraft} showShadow={false} />
        </View>
        {SLOTS.filter((slot) => trying[slot]).map((slot) => {
          const current = fitDraft[slot] ?? { dx: 0, dy: 0, scale: 1 };
          const set = (patch: Partial<{ dx: number; dy: number; scale: number }>) => {
            haptics.selection();
            setFitDraft((prev) => ({ ...prev, [slot]: { ...current, ...patch } }));
          };
          return (
            <View key={slot} style={[styles.fitRow, { borderColor: surface.hairline }]}>
              <Text style={[type.bodyStrong, styles.fitLabel, { color: surface.text }]}>{wardrobeItem(trying[slot])?.name ?? SLOT_LABELS[slot]}</Text>
              <View style={styles.fitControls}>
                {[
                  { icon: "arrow-back", label: "Move left", onPress: () => set({ dx: current.dx - NUDGE }) },
                  { icon: "arrow-forward", label: "Move right", onPress: () => set({ dx: current.dx + NUDGE }) },
                  { icon: "arrow-up", label: "Move up", onPress: () => set({ dy: current.dy - NUDGE }) },
                  { icon: "arrow-down", label: "Move down", onPress: () => set({ dy: current.dy + NUDGE }) },
                  { icon: "remove", label: "Smaller", onPress: () => set({ scale: Math.max(0.5, current.scale - SCALE_STEP) }) },
                  { icon: "add", label: "Bigger", onPress: () => set({ scale: Math.min(2, current.scale + SCALE_STEP) }) },
                  { icon: "refresh", label: "Reset", onPress: () => set({ dx: 0, dy: 0, scale: 1 }) },
                ].map((control) => (
                  <Pressable
                    key={control.label}
                    onPress={control.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={`${control.label}, ${SLOT_LABELS[slot]}`}
                    hitSlop={4}
                    style={[styles.fitButton, { backgroundColor: surface.sunken }]}
                  >
                    <Ionicons name={control.icon as any} size={18} color={surface.text} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sprouts: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
    paddingRight: 12,
    minHeight: 34,
    borderRadius: radius.pill,
  },
  sproutIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  sproutValue: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 15,
    marginRight: 4,
  },
  stage: {
    height: 340,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.hero,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  floor: {
    position: "absolute",
    left: "12%",
    right: "12%",
    bottom: 18,
    height: 46,
    borderRadius: 999,
  },
  bubbleSlot: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    alignItems: "flex-start",
    zIndex: 2,
  },
  petSlot: {
    marginBottom: 14,
  },
  onRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  onChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: radius.pill,
    maxWidth: "100%",
  },
  mainButton: {
    marginTop: 14,
  },
  notice: {
    marginTop: 8,
    textAlign: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 22,
  },
  sectionHint: {
    marginTop: -6,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  itemCard: {
    padding: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  itemArt: {
    height: 96,
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  itemName: {
    marginTop: 8,
    fontSize: 15,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  itemStatus: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  rarity: {
    marginLeft: "auto",
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  sheetButtons: {
    gap: 6,
  },
  fitPreview: {
    alignItems: "center",
    // room for a hat above the preview pet, so it does not cover the sheet's subtitle
    marginTop: 44,
    marginBottom: 10,
  },
  fitError: {
    textAlign: "center",
    marginBottom: 4,
  },
  fitRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  fitLabel: {
    marginBottom: 8,
  },
  fitControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  fitButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
