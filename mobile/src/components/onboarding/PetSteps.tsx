import React from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GardenStage from "../garden/GardenStage";
import PetRig from "../pet/vector/PetRig";
import PetLookEditor from "../pet/PetLookEditor";
import Chip from "../common/Chip";
import TextField from "../common/TextField";
import PressableScale from "../common/PressableScale";
import { SceneCard, StepHeading } from "./OnboardingFrame";
import type { PetPhoto } from "../../utils/pickPetPhotos";
import type { PetImageSources } from "../garden/usePetCandidates";
import type { PetReaction } from "../pet/PetPortrait";
import type { LookSuggestion } from "../../domain/photoLook";
import { DEFAULT_LOOK, type PetLook, type Species, speciesLabel } from "../../domain/petLook";
import { type Companion, shelterFor } from "../../domain/shelter";
import { PET_PHOTO_MAX, paintingLine } from "../../domain/onboarding";
import { useTheme } from "../../theme/theme";
import { radius, type } from "../../theme/tokens";

// The pet half of the first run (and the whole of "new photos" / "change look"): content only; the
// screen owns the state and puts the step's buttons in the frame's footer.

export function WelcomeStep({ sceneHeight }: { sceneHeight: number }) {
  return (
    <View>
      <SceneCard>
        <GardenStage height={sceneHeight} variant="welcome" hidePet accessibilityLabel="An empty garden with a patch of soil, waiting" />
      </SceneCard>
      <StepHeading
        title="Bring your best friend to life"
        lead="A cozy garden where taking care of yourself takes care of them. Each small act of care, a glass of water, a walk, a check-in, helps their garden grow."
      />
    </View>
  );
}

type SpeciesStepProps = {
  species: Species;
  onPick: (species: Species) => void;
  title: string;
  lead: string;
  /** the saved look, shown on its own species card */
  existingLook?: PetLook | null;
};

export function SpeciesStep({ species, onPick, title, lead, existingLook }: SpeciesStepProps) {
  const theme = useTheme();
  const { surface } = theme;
  return (
    <View>
      <StepHeading title={title} lead={lead} />
      <View style={styles.speciesRow}>
        {(["dog", "cat"] as Species[]).map((option) => {
          const active = species === option;
          const preview = existingLook && existingLook.species === option ? existingLook : DEFAULT_LOOK[option];
          const tone = theme.tone(option === "dog" ? "play" : "calm");
          return (
            <PressableScale
              key={option}
              onPress={() => onPick(option)}
              pressedScale={0.96}
              accessibilityRole="radio"
              accessibilityLabel={speciesLabel(option)}
              accessibilityState={{ selected: active }}
              containerStyle={styles.speciesSlot}
              style={[
                styles.speciesCard,
                { backgroundColor: active ? tone.fill : surface.paper, borderColor: active ? tone.accent : surface.hairline, boxShadow: active ? "none" : surface.shadow },
              ]}
            >
              <PetRig look={preview} size={124} mood={active ? "happy" : "calm"} />
              <Text style={[type.bodyStrong, { color: active ? tone.accent : surface.text }]}>{speciesLabel(option)}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

type ShelterStepProps = { species: Species; companion: Companion | null; onPick: (companion: Companion) => void };

export function ShelterStep({ species, companion, onPick }: ShelterStepProps) {
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone("connection");
  return (
    <View>
      <StepHeading title="Meet the shelter" lead="Each of them is looking for someone. Pick who feels right; you can change their look and name any time." />
      <View>
        {shelterFor(species).map((c) => {
          const active = companion?.id === c.id;
          return (
            <PressableScale
              key={c.id}
              onPress={() => onPick(c)}
              pressedScale={0.97}
              accessibilityRole="radio"
              accessibilityLabel={`${c.name}: ${c.bio}`}
              accessibilityState={{ selected: active }}
              style={[styles.shelterCard, { backgroundColor: active ? tone.fill : surface.paper, borderColor: active ? tone.accent : surface.hairline, boxShadow: active ? "none" : surface.shadow }]}
            >
              <PetRig look={c.look} size={84} mood={active ? "happy" : "calm"} />
              <View style={styles.shelterBody}>
                <Text style={[type.bodyStrong, { color: surface.text }]}>{c.name}</Text>
                <Text style={[type.meta, { color: surface.textSecondary }]}>{c.bio}</Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color={tone.accent} /> : null}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

type LookStepProps = {
  look: PetLook;
  onChange: (next: PetLook) => void;
  photoUri?: string | null;
  suggestion?: LookSuggestion | null;
  onUsePhotoColours?: () => void;
};

export function LookStep({ look, onChange, photoUri, suggestion, onUsePhotoColours }: LookStepProps) {
  const theme = useTheme();
  const { surface } = theme;
  return (
    <View>
      <StepHeading
        title="Make it look like yours"
        lead={suggestion ? "We picked colours from the photo. Adjust anything until it feels right." : "Start from a preset, then adjust the coat, eyes, ears and markings."}
      />
      <View style={[styles.editorCard, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}>
        <PetLookEditor
          look={look}
          onChange={onChange}
          aside={
            photoUri ? (
              <View style={styles.photoAside}>
                <Image source={{ uri: photoUri }} style={styles.photoAsideImage} resizeMode="cover" accessibilityLabel="Your photo" />
                {suggestion && onUsePhotoColours ? (
                  <Pressable style={[styles.asideButton, { backgroundColor: surface.sunken }]} onPress={onUsePhotoColours} accessibilityRole="button">
                    <Text style={[type.micro, { color: surface.text }]}>USE PHOTO COLOURS</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}

type PhotoStepProps = {
  photos: PetPhoto[];
  picking: boolean;
  petName: string;
  replace: boolean;
  onAdd: (source: "camera" | "library") => void;
  onRemove: (index: number) => void;
};

export function PhotoStep({ photos, picking, petName, replace, onAdd, onRemove }: PhotoStepProps) {
  const theme = useTheme();
  const { surface } = theme;
  const left = PET_PHOTO_MAX - photos.length;
  const who = petName === "your pet" ? "Your pet" : petName;
  return (
    <View>
      <StepHeading
        title={replace ? "New photos" : "Add photos of them"}
        lead={`Pick 1 to ${PET_PHOTO_MAX} clear photos. ${who} is painted from the photos alone, nothing to choose by hand. Good light and the whole body showing make the truest portrait.`}
      />
      <View style={styles.photoRow} accessibilityRole="list">
        {photos.map((item, index) => (
          <View key={`${item.uri}-${index}`} style={[styles.photoThumb, { backgroundColor: surface.sunken }]}>
            <Image source={{ uri: item.uri }} style={styles.photoThumbImage} resizeMode="cover" accessibilityLabel={`Photo ${index + 1} of ${photos.length}`} />
            <Pressable style={[styles.photoRemove, { backgroundColor: surface.paper }]} onPress={() => onRemove(index)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`}>
              <Ionicons name="close" size={14} color={surface.text} />
            </Pressable>
          </View>
        ))}
        {left > 0 ? (
          <Pressable
            style={[styles.photoThumb, styles.photoAdd, { borderColor: surface.track, backgroundColor: surface.sunken }]}
            onPress={() => onAdd("library")}
            disabled={picking}
            accessibilityRole="button"
            accessibilityLabel={photos.length === 0 ? "Choose photos" : `Add another photo, ${left} more allowed`}
          >
            {picking ? <ActivityIndicator color={theme.bloom} /> : <Ionicons name={photos.length === 0 ? "images-outline" : "add"} size={28} color={surface.textSecondary} />}
          </Pressable>
        ) : null}
      </View>
      {photos.length > 0 ? (
        <Text style={[type.meta, styles.photoCount, { color: surface.textSecondary }]}>
          {photos.length === 1 ? "1 photo" : `${photos.length} photos`}
          {left > 0 ? ` · you can add ${left} more` : ""}
        </Text>
      ) : null}
      <View style={styles.tips}>
        <Text style={[type.meta, { color: surface.textTertiary }]}>• The photos stay private to your account.</Text>
        <Text style={[type.meta, { color: surface.textTertiary }]}>
          {replace ? "• Painting takes about a minute. If it can't finish, your photo is kept and you can retry any time." : "• Painting takes about a minute and runs while you answer a few questions."}
        </Text>
      </View>
    </View>
  );
}

type NameStepProps = {
  photoUri?: string | null;
  look: PetLook;
  value: string;
  onChange: (text: string) => void;
  error?: string | null;
  onSubmit: () => void;
  suggestions: string[];
  lead: string;
};

export function NameStep({ photoUri, look, value, onChange, error, onSubmit, suggestions, lead }: NameStepProps) {
  const { surface } = useTheme();
  return (
    <View>
      <View style={styles.hero}>
        {photoUri ? (
          <View style={[styles.photoFrame, { backgroundColor: surface.sunken, boxShadow: surface.shadow }]}>
            <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" accessibilityLabel="Your pet" />
          </View>
        ) : (
          <PetRig look={look} size={150} mood="happy" />
        )}
      </View>
      <StepHeading title="What's their name?" lead={lead} center />
      <TextField
        value={value}
        onChangeText={onChange}
        placeholder="Their name"
        autoCapitalize="words"
        maxLength={24}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Pet name"
        error={!!error}
        note={error || null}
      />
      {suggestions.length > 0 ? (
        <View style={styles.chips}>
          {suggestions.map((idea) => (
            <Chip key={idea} label={idea} selected={value.trim() === idea} onPress={() => onChange(idea)} category="connection" />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type PaintingStepProps = {
  sceneHeight: number;
  previewSources: PetImageSources | null;
  look: PetLook | null;
  petName: string;
  status: "idle" | "running" | "done" | "kept-photo" | "failed";
  message?: string | null;
  elapsed: number;
};

/** The explicit painting wait, used by the "new photos" flow (the first run paints in the background). */
export function PaintingStep({ sceneHeight, previewSources, look, petName, status, message, elapsed }: PaintingStepProps) {
  const theme = useTheme();
  const { surface } = theme;
  return (
    <View>
      <SceneCard>
        <GardenStage height={sceneHeight} variant="welcome" petImageSources={previewSources} petLook={previewSources ? null : look} allowOriginal petMood="calm" accessibilityLabel={`${petName} waiting in the garden while the portrait is painted`} />
      </SceneCard>
      {status === "failed" ? (
        <StepHeading title="That didn't work" lead={`${message || "We couldn't save the photo."} Check your connection and try again.`} />
      ) : (
        <View>
          <StepHeading title={`Painting ${petName}…`} lead={paintingLine(elapsed, petName)} />
          <ActivityIndicator color={theme.bloom} style={styles.spinner} />
          <Text style={[type.meta, styles.footnote, { color: surface.textTertiary }]}>This usually takes under a minute. You can keep the screen open or come back later.</Text>
        </View>
      )}
    </View>
  );
}

type MeetStepProps = {
  sceneHeight: number;
  petSources: PetImageSources | null;
  look: PetLook | null;
  petName: string;
  place: string;
  reaction: PetReaction | null;
  onReactionEnd: () => void;
  onPetPress: () => void;
  keptPhoto: boolean;
};

export function MeetStep({ sceneHeight, petSources, look, petName, place, reaction, onReactionEnd, onPetPress, keptPhoto }: MeetStepProps) {
  return (
    <View>
      <SceneCard>
        <GardenStage
          height={sceneHeight}
          variant="home"
          petImageSources={petSources}
          petLook={look}
          allowOriginal
          petMood="happy"
          petReaction={reaction}
          onPetReactionEnd={onReactionEnd}
          onPetPress={onPetPress}
          accessibilityLabel={`${petName} sitting in the ${place}`}
        />
      </SceneCard>
      <StepHeading
        title={`${petName} moved in`}
        lead={
          keptPhoto
            ? "The painted portrait didn't finish, so the photo is kept for later. You can retry from the Pet tab any time."
            : `Tap ${petName} to say hello. They'll be here on Home, in the ${place}, and whenever you check in.`
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  speciesRow: {
    flexDirection: "row",
    gap: 12,
  },
  speciesSlot: {
    flex: 1,
  },
  speciesCard: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: radius.card,
    borderCurve: "continuous",
    borderWidth: 1.5,
    gap: 6,
  },
  shelterCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.row,
    borderCurve: "continuous",
    borderWidth: 1.5,
    marginBottom: 10,
  },
  shelterBody: {
    flex: 1,
    marginHorizontal: 12,
  },
  editorCard: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 12,
  },
  photoAside: {
    alignItems: "center",
    gap: 8,
  },
  photoAsideImage: {
    width: 84,
    height: 84,
    borderRadius: radius.tile,
  },
  asideButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
  },
  photoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  photoCount: {
    marginTop: 10,
  },
  tips: {
    marginTop: 18,
    gap: 4,
  },
  hero: {
    alignItems: "center",
    marginTop: 6,
  },
  photoFrame: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  spinner: {
    marginTop: 4,
  },
  footnote: {
    marginTop: 12,
    textAlign: "center",
  },
});
