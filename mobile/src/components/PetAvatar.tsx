import React, { memo, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type PetAvatarProps = {
  uri?: string | null;
  size?: number;
  label?: string | null;
};

function toInitial(label: string | null | undefined) {
  const value = String(label || "").trim();
  if (!value) return "P";
  return value.charAt(0).toUpperCase();
}

function PetAvatarBase({ uri, size = 48, label }: PetAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    setImageLoaded(false);
  }, [uri]);

  const initial = useMemo(() => toInitial(label), [label]);
  const canShowImage = !!uri && !loadFailed;
  const diameter = Math.max(24, Math.floor(size));
  const borderRadius = Math.floor(diameter / 2);

  return (
    <View
      style={[
        styles.container,
        {
          width: diameter,
          height: diameter,
          borderRadius,
        },
      ]}
    >
      {canShowImage ? (
        <Image
          source={{ uri: String(uri) }}
          style={[
            styles.image,
            {
              width: diameter - 2,
              height: diameter - 2,
              borderRadius: Math.floor((diameter - 2) / 2),
              opacity: imageLoaded ? 1 : 0,
            },
          ]}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
          onError={() => setLoadFailed(true)}
        />
      ) : null}
      {!canShowImage || !imageLoaded ? (
        <View
          style={[
            styles.placeholder,
            {
              width: diameter - 2,
              height: diameter - 2,
              borderRadius: Math.floor((diameter - 2) / 2),
            },
          ]}
        >
          <Text style={[styles.placeholderText, { fontSize: Math.max(12, Math.floor(diameter * 0.38)) }]}>{initial}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "rgba(203,213,225,0.75)",
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    position: "absolute",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
  },
  placeholderText: {
    color: "#e2e8f0",
    fontWeight: "800",
  },
});

const PetAvatar = memo(PetAvatarBase);

export default PetAvatar;
