import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "../common/Sheet";
import Button from "../common/Button";
import { milestoneIcon, milestoneLine, milestoneTitle } from "../../domain/milestones";
import { useTheme } from "../../theme/theme";
import { brand, radius, type } from "../../theme/tokens";

type MilestoneSheetProps = {
  /** the threshold reached; null hides the sheet */
  days: number | null;
  petName: string;
  onClose: () => void;
  onKeepsakes: () => void;
};

/** A Days Together milestone: the pet, its line, and the keepsake it leaves. One moment, then back to the day. */
export default function MilestoneSheet({ days, petName, onClose, onKeepsakes }: MilestoneSheetProps) {
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone("play");
  const visible = days != null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={visible ? milestoneTitle(days) : null}
      subtitle={visible ? milestoneLine(days, petName) : null}
      pet={{ mood: "excited", size: 96 }}
      footer={
        <>
          <Button label="Keep going" onPress={onClose} />
          <Button label="See your keepsakes" variant="quiet" onPress={onKeepsakes} />
        </>
      }
    >
      {visible ? (
        <View style={[styles.keepsake, { backgroundColor: tone.fill, boxShadow: surface.shadow }]} accessible accessibilityLabel={`${milestoneTitle(days)} added to your keepsakes`}>
          <View style={[styles.tile, { backgroundColor: tone.tileOnFill }]}>
            <Ionicons name={milestoneIcon(days) as any} size={26} color={brand.goldStrong} />
          </View>
          <View style={styles.body}>
            <Text style={[type.micro, { color: tone.accent }]}>KEEPSAKE</Text>
            <Text style={[type.bodyStrong, { color: surface.text }]}>{milestoneTitle(days)}</Text>
            <Text style={[type.meta, { color: surface.textSecondary }]}>Added to the moments {petName} keeps for you.</Text>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  keepsake: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.row,
    borderCurve: "continuous",
    marginTop: 4,
  },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
});
