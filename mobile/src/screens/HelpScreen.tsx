import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import { Lead, ScreenTitle } from "../components/common/Headings";
import { ListGroup, ListRow } from "../components/common/ListGroup";
import { useTheme } from "../theme/theme";
import { fonts, space, type } from "../theme/tokens";
import support from "../legal/support.json";
import privacy from "../legal/privacy.json";

/**
 * Help & support, bundled with the app so it works offline. One source: src/legal/support.json, which
 * `node scripts/export-privacy.js` also turns into docs/legal/support.html for the App Store's Support URL.
 * The contact email is privacy.json's; the contact card stays hidden until it is filled in.
 */
export default function HelpScreen({ navigation }: any) {
  const { surface, link } = useTheme();
  const contactEmail: string = privacy.contactEmail;

  return (
    <Screen>
      <ScreenTitle>{support.title}</ScreenTitle>
      <Lead style={styles.intro}>{support.intro}</Lead>

      {support.questions.map((item) => (
        <View key={item.q} style={styles.item}>
          <Text style={[type.h3, { color: surface.text }]} accessibilityRole="header">
            {item.q}
          </Text>
          <Text style={[type.body, styles.answer, { color: surface.textSecondary }]}>{item.a}</Text>
        </View>
      ))}

      {contactEmail ? (
        <Card variant="sunken" style={styles.item}>
          <Text style={[type.bodyStrong, { color: surface.text }]}>Still stuck? Write to us</Text>
          <Text
            style={[type.body, styles.answer, { color: link, fontFamily: fonts.bodyBold }]}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`mailto:${contactEmail}`)}
          >
            {contactEmail}
          </Text>
        </Card>
      ) : null}

      <ListGroup style={styles.item}>
        <ListRow icon="shield-checkmark-outline" category="calm" label="Privacy" hint="What we keep, and what stays on this phone" onPress={() => navigation.navigate("Privacy")} />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.rowGap },
  item: { marginTop: space.sectionGap - 8 },
  answer: { marginTop: 6 },
});
