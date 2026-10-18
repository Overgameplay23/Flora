import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Sheet from "../common/Sheet";
import Button from "../common/Button";
import IconTile from "../common/IconTile";
import { useTheme } from "../../theme/theme";
import { radius, type } from "../../theme/tokens";
import type { WelcomeMoment } from "../../domain/welcomeBack";

type WelcomeBackSheetProps = {
  /** null hides the sheet */
  moment: WelcomeMoment | null;
  onClose: () => void;
  onOpenRun: () => void;
};

/**
 * The first open after two or more days away (src/domain/welcomeBack.ts): the pet's hello, that the bond is still
 * there, how the Cozy Run fared, and a small day. One moment, then Home with its gentle plan.
 */
export default function WelcomeBackSheet({ moment, onClose, onOpenRun }: WelcomeBackSheetProps) {
  const theme = useTheme();
  const { surface } = theme;
  return (
    <Sheet
      visible={!!moment}
      onClose={onClose}
      title={moment?.title ?? null}
      subtitle={moment?.petLine ?? null}
      pet={{ mood: "happy", size: 96 }}
      footer={
        <>
          <Button label="Let's start small" onPress={onClose} />
          {moment?.openRun ? <Button label="See the Cozy Run" variant="quiet" onPress={onOpenRun} /> : null}
        </>
      }
    >
      {moment?.lines.map((line) => (
        <View key={line.id} style={[styles.row, { backgroundColor: theme.tone(line.category).fill }]} accessible accessibilityLabel={line.text}>
          <IconTile icon={line.icon} category={line.category} size={40} on="fill" />
          <Text style={[type.body, styles.text, { color: surface.text }]}>{line.text}</Text>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginTop: 10,
    borderRadius: radius.row,
    borderCurve: "continuous",
  },
  text: { flex: 1 },
});
