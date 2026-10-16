import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Sheet from "../common/Sheet";
import Button from "../common/Button";
import Chip from "../common/Chip";
import TextField from "../common/TextField";
import { CUSTOM_CATEGORIES, CUSTOM_MINUTES, CUSTOM_TITLE_MAX, type CustomMinutes, inferCategory, validateCustomTitle } from "../../domain/customTasks";
import type { CareCategory } from "../../domain/plan/types";
import { useTheme } from "../../theme/theme";
import { type } from "../../theme/tokens";

export type AddTaskInput = { title: string; category: CareCategory; minutes: number };

type AddTaskSheetProps = {
  visible: boolean;
  petName: string;
  saving?: boolean;
  onSave: (input: AddTaskInput) => void;
  onClose: () => void;
};

/** "Add your own": a title, a colour and about how long. The colour follows the words until it is picked by hand. */
export default function AddTaskSheet({ visible, petName, saving = false, onSave, onClose }: AddTaskSheetProps) {
  const { surface } = useTheme();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CareCategory | null>(null);
  const [minutes, setMinutes] = useState<CustomMinutes>(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setCategory(null);
      setMinutes(5);
      setError(null);
    }
  }, [visible]);

  const effectiveCategory: CareCategory = category ?? inferCategory(title);

  const submit = () => {
    const valid = validateCustomTitle(title);
    if (valid.ok === false) {
      setError(valid.error);
      return;
    }
    onSave({ title: valid.title, category: effectiveCategory, minutes });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add your own"
      subtitle={`Anything that counts as care for you. ${petName} will cheer for it like the rest.`}
      pet={{ mood: "happy", size: 72 }}
      locked={saving}
      footer={<Button label={saving ? "Adding…" : "Add to today's care"} onPress={submit} loading={saving} />}
    >
      <TextField
        label="What is it?"
        placeholder="Take my meds, water the plants, call Nan…"
        value={title}
        onChangeText={(text) => {
          setTitle(text);
          if (error) setError(null);
        }}
        maxLength={CUSTOM_TITLE_MAX}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        error={!!error}
        note={error}
        editable={!saving}
      />
      <Text style={[type.micro, styles.label, { color: surface.textTertiary }]}>COLOUR</Text>
      <View style={styles.chips}>
        {CUSTOM_CATEGORIES.map((option) => (
          <Chip key={option.id} label={option.label} icon={option.icon} category={option.id} selected={effectiveCategory === option.id} onPress={() => setCategory(option.id)} disabled={saving} />
        ))}
      </View>
      <Text style={[type.micro, styles.label, { color: surface.textTertiary }]}>ABOUT HOW LONG</Text>
      <View style={styles.chips}>
        {CUSTOM_MINUTES.map((option) => (
          <Chip key={option} label={`${option} min`} category={effectiveCategory} selected={minutes === option} onPress={() => setMinutes(option)} disabled={saving} />
        ))}
      </View>
      <Text style={[type.meta, styles.hint, { color: surface.textTertiary }]}>It stays on your list every day until you put it away (press and hold it on Home).</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 16,
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hint: {
    marginTop: 16,
  },
});
