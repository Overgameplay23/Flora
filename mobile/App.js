import "./global.css";
import React from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './app/navigation/RootNavigator';
import { runStartupNetworkDiagnostics } from "./src/utils/net";
import { useAppFonts } from "./src/theme/fonts";
import { ThemeProvider } from "./src/theme/theme";

// Kick off connectivity probes before the app renders; failures are logged but won't block startup.
void runStartupNetworkDiagnostics();

// Dev-only: on web, ?preview=<screen> renders that screen with a fixture pet and no session
// (src/screens/dev/DesignPreview.tsx), so the design can be checked without signing in.
const DESIGN_PREVIEW =
  __DEV__ && Platform.OS === "web" && typeof window !== "undefined"
    ? (/[?&]preview=([a-z-]+)/i.exec(window.location?.search || "") || [])[1] || null
    : null;

export default function App() {
  // Fraunces + Nunito (src/theme/tokens.ts); a failed load falls through to the system font.
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;
  if (DESIGN_PREVIEW) {
    const DesignPreview = require("./src/screens/dev/DesignPreview").default;
    return <DesignPreview name={DESIGN_PREVIEW.toLowerCase()} />;
  }
  // the theme (light or night paper by the local hour) wraps everything, navigation included
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
