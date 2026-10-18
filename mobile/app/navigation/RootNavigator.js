import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../src/contexts/AuthContext";
import { deriveAppGate } from "../../src/domain/appGate";
import LoginScreen from "../../src/screens/LoginScreen";
import SignupScreen from "../../src/screens/SignupScreen";
import ForgotPasswordScreen from "../../src/screens/ForgotPasswordScreen";
import ConfirmEmailScreen from "../../src/screens/ConfirmEmailScreen";
import PetSetupScreen from "../../src/screens/PetSetupScreen.tsx";
import OnboardingScreen from "../../src/screens/onboarding/OnboardingScreen";
import PetStylizeLoadingScreen from "../screens/PetStylizeLoadingScreen";
import PetStylizeResultScreen from "../screens/PetStylizeResultScreen";
import AppNavigator, { stackScreenOptions } from "./AppNavigator";
import ShareCardScreen from "../../src/screens/ShareCardScreen";
import EnvWarningBanner from "../../src/components/EnvWarningBanner";
import NetworkBlockBanner from "../../src/components/NetworkBlockBanner";
import AuthStatusBanner from "../../src/components/AuthStatusBanner";
import Button from "../../src/components/common/Button";
import IconTile from "../../src/components/common/IconTile";
import PetMascot from "../../src/components/pet/PetMascot";
import { PetLoading, useHasPet } from "../../src/components/pet/PetMoments";
import { navigationThemeFor, useTheme } from "../../src/theme/theme";
import { type } from "../../src/theme/tokens";

const RootStack = createNativeStackNavigator();
const AuthStackNav = createNativeStackNavigator();
const AppStackNav = createNativeStackNavigator();

/** While the session wakes up: the sky of the hour, and the pet breathing if it is already known. */
export function SplashScreen() {
  const { sky } = useTheme();
  return (
    <LinearGradient colors={[sky.top, sky.mid, sky.horizon]} locations={[0, 0.55, 1]} style={styles.splash}>
      <PetLoading size={120} />
      <Text style={[type.h2, styles.splashTitle, { color: sky.text }]}>Waking the garden…</Text>
    </LinearGradient>
  );
}

/**
 * Shown when the profile cannot be loaded and this device has no memory of whether the user already
 * has a pet. Sending them to pet setup here would make an existing user re-create their pet (R-04).
 */
export function UnreachableScreen({ onRetry, onSignOut, retrying }) {
  const { surface } = useTheme();
  const hasPet = useHasPet();
  return (
    <View style={[styles.unreachable, { backgroundColor: surface.canvas }]}>
      {hasPet ? <PetMascot size={120} mood="calm" /> : <IconTile icon="cloud-offline-outline" category="rest" size={72} round />}
      <Text style={[type.title, styles.unreachableTitle, { color: surface.text }]} accessibilityRole="header">
        Can't reach your garden
      </Text>
      <Text style={[type.callout, styles.unreachableBody, { color: surface.textSecondary }]}>
        We couldn't load your profile. Check your connection and try again; nothing has been lost.
      </Text>
      <Button label="Try again" onPress={onRetry} loading={retrying} size="md" containerStyle={styles.retryButton} style={styles.retryInner} />
      <Button label="Sign out" onPress={onSignOut} variant="quiet" size="md" containerStyle={styles.signOutButton} />
    </View>
  );
}

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Signup" component={SignupScreen} />
      <AuthStackNav.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStackNav.Screen name="ConfirmEmail" component={ConfirmEmailScreen} />
    </AuthStackNav.Navigator>
  );
}

function AppStack({ needsPetSetup }) {
  const { surface } = useTheme();
  return (
    <AppStackNav.Navigator screenOptions={{ headerShown: false }}>
      {needsPetSetup ? (
        <>
          <AppStackNav.Screen name="Onboarding" component={OnboardingScreen} initialParams={{ mode: "first" }} />
          <AppStackNav.Screen name="PetSetup" component={PetSetupScreen} />
          <AppStackNav.Screen name="PetStylizeLoading" component={PetStylizeLoadingScreen} />
          <AppStackNav.Screen name="PetStylizeResult" component={PetStylizeResultScreen} />
          {/* onboarding's reveal can share the first painting before the main app exists */}
          <AppStackNav.Screen name="ShareCard" component={ShareCardScreen} options={{ ...stackScreenOptions(surface), headerShown: true, title: "Share" }} />
        </>
      ) : (
        <AppStackNav.Screen name="MainApp" component={AppNavigator} />
      )}
    </AppStackNav.Navigator>
  );
}

export default function RootNavigator() {
  const {
    session,
    profile,
    profileStatus,
    cachedHasPet,
    initializing,
    authServiceMessage,
    clearAuthServiceMessage,
    retryHydrate,
    signOut,
    onboardingActive,
  } = useAuth();
  const [retrying, setRetrying] = React.useState(false);
  const theme = useTheme();
  const navigationTheme = React.useMemo(() => navigationThemeFor(theme), [theme]);
  const hasUser = !!session?.user;
  const gate = deriveAppGate({
    hasUser,
    profileStatus,
    profileHasPet: profile ? !!profile.pet_photo_url : null,
    cachedHasPet,
    // the first-run flow keeps the screen until it finishes, even once the pet's photo marks the profile
    onboardingActive: !!onboardingActive,
  });

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryHydrate();
    } finally {
      setRetrying(false);
    }
  };

  let content;
  if (initializing || gate === "splash") {
    content = <SplashScreen />;
  } else if (gate === "unreachable") {
    content = (
      <UnreachableScreen
        retrying={retrying}
        onRetry={handleRetry}
        onSignOut={() => {
          signOut().catch((error) => console.error("UNREACHABLE_SIGNOUT_ERROR", error));
        }}
      />
    );
  } else {
    content = (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {gate === "auth" ? (
          <RootStack.Screen name="AuthStack" component={AuthStack} />
        ) : (
          <RootStack.Screen name="AppStack">{() => <AppStack needsPetSetup={gate === "setup"} />}</RootStack.Screen>
        )}
      </RootStack.Navigator>
    );
  }

  const statusBar = initializing || gate === "splash" ? theme.sky.statusBar : theme.statusBar;

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.canvas }}>
      {/* one status bar for the whole app, on the paper of the hour; Home follows its sky while in front */}
      <StatusBar style={statusBar} />
      <NavigationContainer theme={navigationTheme}>{content}</NavigationContainer>
      <EnvWarningBanner />
      <NetworkBlockBanner />
      <AuthStatusBanner message={authServiceMessage} onDismiss={clearAuthServiceMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  splashTitle: {
    marginTop: 4,
    textAlign: "center",
  },
  unreachable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  unreachableTitle: {
    marginTop: 18,
    textAlign: "center",
  },
  unreachableBody: {
    marginTop: 8,
    textAlign: "center",
    maxWidth: 340,
  },
  retryButton: {
    marginTop: 22,
    alignSelf: "center",
  },
  retryInner: {
    minWidth: 180,
  },
  signOutButton: {
    marginTop: 6,
    alignSelf: "center",
  },
});
