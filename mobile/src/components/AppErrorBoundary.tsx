import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { brand, ink, skies, type } from "../theme/tokens";
import { diagLog } from "../utils/diagLog";

type Props = { children: React.ReactNode };
type State = { error: Error | null; attempt: number };

/** What the crash screen says; pure so the tests can read it. */
export const CRASH_COPY = {
  title: "Something went sideways",
  body: "Luna ran into a problem it didn't expect. Everything you've saved is safe. Try again, and if it keeps happening, close the app and open it again.",
  retry: "Try again",
} as const;

/**
 * The last line of defence: a rendering error anywhere below shows a calm screen instead of a white page (web) or
 * a closed app (a release build on a phone). It logs the error to diagLog, which testers can copy from Diagnostics
 * (Profile: tap the version five times); crash reporting (docs/LAUNCH.md item 13) will hook in here too.
 * It draws only plain views with token values, never the theme, the pet or navigation, because the error may come
 * from any of those. "Try again" remounts everything below with fresh state.
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("APP_CRASH", error);
    diagLog("APP_CRASH", {
      name: error?.name,
      message: error?.message,
      // the first few frames are enough to find the screen; the full stack can hold user text
      componentStack: String(info?.componentStack || "").trim().split("\n").slice(0, 6).join("\n"),
    });
  }

  private retry = () => {
    this.setState((state) => ({ error: null, attempt: state.attempt + 1 }));
  };

  render() {
    const { error, attempt } = this.state;
    if (!error) return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
    return (
      <View style={styles.page} accessibilityRole="alert">
        <View style={styles.glow}>
          <View style={styles.moon} />
        </View>
        <Text style={[type.title, styles.title]} accessibilityRole="header">
          {CRASH_COPY.title}
        </Text>
        <Text style={[type.body, styles.body]}>{CRASH_COPY.body}</Text>
        <Pressable onPress={this.retry} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={[type.bodyStrong, styles.buttonLabel]}>{CRASH_COPY.retry}</Text>
        </Pressable>
        {__DEV__ ? <Text style={[type.meta, styles.detail]}>{String(error?.message || error)}</Text> : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // the dusk of the splash screen and the app icon, so a crash still feels like Luna
  page: { flex: 1, backgroundColor: skies.dusk.top, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  glow: { width: 132, height: 132, borderRadius: 66, backgroundColor: "rgba(246,241,233,0.16)", alignItems: "center", justifyContent: "center", marginBottom: 28 },
  moon: { width: 88, height: 88, borderRadius: 44, backgroundColor: ink.night },
  title: { color: ink.night, textAlign: "center" },
  body: { color: ink.nightSecondary, textAlign: "center", marginTop: 12, maxWidth: 340 },
  button: { marginTop: 28, minWidth: 180, height: 50, borderRadius: 25, backgroundColor: brand.bloom, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  pressed: { opacity: 0.85 },
  buttonLabel: { color: ink.primary },
  detail: { color: ink.nightTertiary, textAlign: "center", marginTop: 20 },
});
