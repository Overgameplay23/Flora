import React, { forwardRef, useState } from "react";
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/theme";
import { fonts, radius, type } from "../../theme/tokens";

type TextFieldProps = TextInputProps & {
  label?: string | null;
  /** a line under the field: help text, or an error when `error` is set */
  note?: string | null;
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

/** A warm, sunken text field with an optional label; the edge warms to bloom while focused. */
const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, note, error = false, multiline, style, containerStyle, onFocus, onBlur, ...rest },
  ref
) {
  const theme = useTheme();
  const { surface } = theme;
  const [focused, setFocused] = useState(false);
  const edge = error ? theme.alert : focused ? theme.bloom : surface.hairline;
  return (
    <View style={containerStyle}>
      {label ? <Text style={[type.meta, styles.label, { color: surface.textSecondary }]}>{label}</Text> : null}
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={surface.textTertiary}
        selectionColor={theme.bloom}
        textAlignVertical={multiline ? "top" : "center"}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: surface.sunken, borderColor: edge, color: surface.text },
          style,
        ]}
        {...rest}
      />
      {note ? <Text style={[type.meta, styles.note, { color: error ? theme.alert : surface.textTertiary }]}>{note}</Text> : null}
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
  },
  multiline: {
    minHeight: 110,
  },
  note: {
    marginTop: 6,
    marginLeft: 4,
  },
});
