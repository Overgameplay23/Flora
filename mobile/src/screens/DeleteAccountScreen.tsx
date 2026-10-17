import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import TextField from "../components/common/TextField";
import { Lead, ScreenTitle } from "../components/common/Headings";
import PetMascot from "../components/pet/PetMascot";
import { useTheme } from "../theme/theme";
import { space, type } from "../theme/tokens";
import { notify } from "../utils/confirm";
import { AccountDeletionError, CONFIRM_WORD, confirmWordMatches, deleteMyAccount } from "../services/accountDeletion";

/**
 * Delete the account from inside the app (App Store Guideline 5.1.1(v)). Plain about what goes, one deliberate
 * step, no guilt and no maze: the pet is sad to see you go only in the sense that it says goodbye.
 * Once it works the person is signed out and lands on the sign-in screen.
 */
export default function DeleteAccountScreen({ navigation }: any) {
  const { user } = useAuth();
  const { displayName, memorial } = usePet();
  const { surface } = useTheme();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = confirmWordMatches(draft);

  const gone = [
    memorial ? `${displayName}'s memorial, the memories you wrote and the photos` : `${displayName}'s photos and painting`,
    "Check-ins, care tasks, habits, the garden and Sprouts",
    "Journal, scrapbook, keepsakes and journeys",
    "Everything this account kept on this phone, cycle notes included",
  ];

  const run = async () => {
    if (!user?.id || !ready || busy) return;
    setBusy(true);
    try {
      await deleteMyAccount(user.id);
      notify("Your account is deleted", "Everything is gone from our servers and from this phone. Take good care of yourself.");
    } catch (error) {
      const step = error instanceof AccountDeletionError ? error.step : "account";
      console.error("ACCOUNT_DELETION_ERROR", step, error);
      if (step === "photos") {
        notify("Nothing was deleted", "We couldn't remove your pet's photos, so we stopped before touching anything else. Check your connection and try again.");
      } else {
        // the photos are already gone by this step, so "nothing was deleted" would not be true
        notify("Your account is still here", "Your pet's photos were removed, but we couldn't delete the rest. Check your connection and try again.");
      }
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <PetMascot size={96} />
      </View>
      <ScreenTitle center>Delete your account</ScreenTitle>
      <Lead center style={styles.lead}>
        This removes your account and everything in it, for good. It can't be undone.
      </Lead>

      <Card variant="sunken" style={styles.block}>
        <Text style={[type.bodyStrong, { color: surface.text }]}>What goes</Text>
        {gone.map((line) => (
          <View key={line} style={styles.row}>
            <Ionicons name="close-circle-outline" size={18} color={surface.textSecondary} style={styles.rowIcon} />
            <Text style={[type.body, styles.rowText, { color: surface.textSecondary }]}>{line}</Text>
          </View>
        ))}
      </Card>

      <TextField
        label={`Type "${CONFIRM_WORD}" to confirm`}
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
        containerStyle={styles.block}
      />

      <Button
        label="Delete my account"
        variant="plum"
        onPress={run}
        loading={busy}
        disabled={!ready}
        accessibilityHint="Deletes your account and everything in it"
        containerStyle={styles.block}
      />
      <Button label="Keep my account" variant="quiet" size="md" onPress={() => navigation.goBack()} disabled={busy} containerStyle={styles.keep} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginTop: 12, marginBottom: 8 },
  lead: { marginTop: 6 },
  block: { marginTop: space.rowGap * 2 },
  row: { flexDirection: "row", alignItems: "flex-start", marginTop: space.rowGap },
  rowIcon: { marginTop: 2, marginRight: 8 },
  rowText: { flex: 1 },
  keep: { alignSelf: "center", marginTop: 4 },
});
