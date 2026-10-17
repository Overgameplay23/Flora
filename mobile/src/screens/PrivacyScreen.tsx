import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import { Lead, ScreenTitle, SectionTitle } from "../components/common/Headings";
import { useTheme } from "../theme/theme";
import { fonts, space, type } from "../theme/tokens";
import policy from "../legal/privacy.json";

function updatedLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateKey : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/**
 * The privacy policy, bundled with the app so it reads the same offline and needs no website for review
 * (App Store Guideline 5.1.1(i)). One source: src/legal/privacy.json, which `node scripts/export-privacy.js` also
 * turns into the hostable page docs/legal/privacy-policy.html.
 */
export default function PrivacyScreen() {
  const { surface, link } = useTheme();
  const body = [type.body, { color: surface.textSecondary }];

  return (
    <Screen>
      <ScreenTitle>{policy.title}</ScreenTitle>
      <Text style={[type.meta, styles.updated, { color: surface.textTertiary }]}>Updated {updatedLabel(policy.updated)}</Text>
      <Lead style={styles.intro}>{policy.intro}</Lead>

      {policy.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <SectionTitle>{section.heading}</SectionTitle>
          {(section.paragraphs ?? []).map((paragraph) => (
            <Text key={paragraph} style={[body, styles.paragraph]}>
              {paragraph}
            </Text>
          ))}
          {(section.bullets ?? []).map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <Text style={[body, styles.bulletDot]}>•</Text>
              <Text style={[body, styles.bulletText]}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}

      {policy.contactEmail ? (
        <Card variant="sunken" style={styles.section}>
          <Text style={[type.bodyStrong, { color: surface.text }]}>Questions or requests</Text>
          <Text
            style={[type.body, styles.paragraph, { color: link, fontFamily: fonts.bodyBold }]}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`mailto:${policy.contactEmail}`)}
          >
            {policy.contactEmail}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  updated: { marginTop: 4 },
  intro: { marginTop: space.rowGap },
  section: { marginTop: space.sectionGap - 6 },
  paragraph: { marginTop: 8 },
  bulletRow: { flexDirection: "row", marginTop: 8 },
  bulletDot: { width: 18 },
  bulletText: { flex: 1 },
});
