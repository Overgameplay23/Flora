import "./global.css";
import React from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './app/navigation/RootNavigator';
import { runStartupNetworkDiagnostics } from "./src/utils/net";
import { useAppFonts } from "./src/theme/fonts";

// Kick off connectivity probes before the app renders; failures are logged but won't block startup.
void runStartupNetworkDiagnostics();

// Dev-only: on web, ?preview=home renders Home with fixture data (src/screens/dev/HomePreviewScreen.tsx)
// so the design can be checked without signing in.
const DESIGN_PREVIEW =
  __DEV__ && Platform.OS === "web" && typeof window !== "undefined" && /[?&]preview=home\b/.test(window.location?.search || "");

export default function App() {
  // Fraunces + Nunito (src/theme/tokens.ts); a failed load falls through to the system font.
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;
  if (DESIGN_PREVIEW) {
    const { SafeAreaProvider } = require("react-native-safe-area-context");
    const HomePreviewScreen = require("./src/screens/dev/HomePreviewScreen").default;
    return (
      <SafeAreaProvider>
        <AuthProvider>
          <HomePreviewScreen />
        </AuthProvider>
      </SafeAreaProvider>
    );
  }
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
