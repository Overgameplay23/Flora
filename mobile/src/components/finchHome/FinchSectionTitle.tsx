import React from "react";
import { Text, StyleSheet } from "react-native";

type FinchSectionTitleProps = {
  children: React.ReactNode;
};

function FinchSectionTitle({ children }: FinchSectionTitleProps) {
  return <Text style={styles.title}>{children}</Text>;
}

export default React.memo(FinchSectionTitle);

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#e2e8f0",
  },
});
