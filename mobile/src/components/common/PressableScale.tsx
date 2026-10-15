import React, { useRef } from "react";
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import { springs } from "../../theme/tokens";

type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** layout for the outer touch target (e.g. { flex: 1 } in a row); `style` dresses the part that scales */
  containerStyle?: StyleProp<ViewStyle>;
  /** how far it gives under the finger (0.97 cards, 0.92 small buttons) */
  pressedScale?: number;
  children?: React.ReactNode;
};

/** A Pressable that gives slightly under the finger and springs back: every tappable surface gets a press state. */
export default function PressableScale({ style, containerStyle, pressedScale = 0.97, children, onPressIn, onPressOut, disabled, ...rest }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, ...springs.snappy }).start();
  return (
    <Pressable
      {...rest}
      style={containerStyle}
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) to(pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        to(1);
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
