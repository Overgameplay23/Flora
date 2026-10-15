import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { categoryTone, radius, type, type Surface } from "../../theme/tokens";

export type MoreItem = {
  key: string;
  title: string;
  subtitle: string;
  /** Ionicons glyph */
  icon: string;
  category: string;
  onPress: () => void;
};

/** "More with {pet}": the things beyond today's list (play, breathe, write, check in, cycle) as a swipeable row. */
export default function MoreCarousel({ items, surface }: { items: MoreItem[]; surface: Surface }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller}>
      {items.map((item) => {
        const tone = categoryTone(item.category);
        return (
          <PressableScale
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.subtitle}`}
            style={[styles.card, { boxShadow: surface.shadow }]}
          >
            <LinearGradient
              colors={surface.isNight ? [surface.paper, surface.paper] : [tone.tint, "#FFFBF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            >
              <View style={[styles.icon, { backgroundColor: surface.isNight ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.8)" }]}>
                <Ionicons name={item.icon as any} size={22} color={surface.isNight ? tone.mid : tone.strong} />
              </View>
              <View style={styles.text}>
                <Text style={[type.bodyStrong, { color: surface.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>
            </LinearGradient>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    marginHorizontal: -20,
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 10,
  },
  card: {
    width: 156,
    minHeight: 148,
    borderRadius: radius.card - 4,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  fill: {
    flex: 1,
    padding: 14,
    gap: 12,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    gap: 1,
  },
});
