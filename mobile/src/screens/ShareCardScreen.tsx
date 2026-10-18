import React, { useCallback, useRef, useState } from "react";
import { Platform, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { captureRef } from "react-native-view-shot";
import Screen from "../components/common/Screen";
import Button from "../components/common/Button";
import { Lead, ScreenTitle } from "../components/common/Headings";
import PetShareCard from "../components/share/PetShareCard";
import { usePet } from "../hooks/usePet";
import { useSignedPetPhotoUrl } from "../services/petPhotoUrls";
import { paintingOf, realPhotoOf, shareCardCopy } from "../domain/shareCard";
import { useTheme } from "../theme/theme";
import { space, type } from "../theme/tokens";
import { notify } from "../utils/confirm";

/**
 * Share the card (ROADMAP item 8): the real pet next to its painting, made on the phone and handed to the share sheet
 * (TikTok, Instagram, Messages, Save Image). Nothing is uploaded; the person picks where it goes.
 */
export default function ShareCardScreen() {
  const { sources, look, displayName, memorial } = usePet();
  const { surface } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(Math.min(width - space.gutter * 2, 340));
  const realUri = useSignedPetPhotoUrl(realPhotoOf(sources));
  const paintingLocator = paintingOf(sources);
  const paintingUri = useSignedPetPhotoUrl(paintingLocator);
  const copy = shareCardCopy({ petName: displayName, painted: !!paintingLocator, memorial: !!memorial });
  const cardRef = useRef<View>(null);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const onReady = useCallback((next: boolean) => setReady(next), []);

  const share = async () => {
    if (!ready || sharing) return;
    setSharing(true);
    try {
      if (Platform.OS === "web") {
        // the web build has no share sheet for files: the card downloads instead
        const dataUri = await captureRef(cardRef, { format: "png", quality: 1, result: "data-uri" });
        const link = (globalThis as any).document?.createElement("a");
        if (link) {
          link.href = dataUri;
          link.download = `${displayName || "my-pet"}-luna.png`.replace(/\s+/g, "-").toLowerCase();
          link.click();
        }
      } else {
        const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
        await Share.share({ url: uri, title: copy.shareTitle }, { subject: copy.shareTitle });
      }
    } catch (error: any) {
      console.warn("SHARE_CARD_ERROR", error?.message || String(error));
      notify("The card didn't come together", "Please try again in a moment.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen>
      <ScreenTitle>{memorial ? `Share ${displayName}` : `Show off ${displayName}`}</ScreenTitle>
      <Lead style={styles.lead}>
        {`The real ${displayName} next to ${paintingLocator ? "the painting" : "the drawing"}, ready for TikTok, Reels or a story. It's made on your phone; nothing is uploaded.`}
      </Lead>
      <View style={styles.cardWrap}>
        <PetShareCard ref={cardRef} width={cardWidth} realUri={realUri} paintingUri={paintingUri} look={look} copy={copy} onReady={onReady} />
      </View>
      <Button
        label={ready ? "Share the card" : "Getting the pictures ready…"}
        icon={ready ? "share-outline" : undefined}
        onPress={share}
        loading={sharing}
        disabled={!ready}
        containerStyle={styles.button}
      />
      {!paintingLocator ? (
        <Text style={[type.meta, styles.note, { color: surface.textTertiary }]}>Once {displayName}'s painting is ready, the card uses it instead of the drawing.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: 6 },
  cardWrap: { alignItems: "center", marginTop: space.sectionGap - 8 },
  button: { marginTop: space.sectionGap - 8 },
  note: { textAlign: "center", marginTop: 10 },
});
