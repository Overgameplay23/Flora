import React from "react";
import { ActivityIndicator, View, Text, StyleSheet, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../../src/contexts/AuthContext";
import { deriveAppGate } from "../../src/domain/appGate";
import LoginScreen from "../../src/screens/LoginScreen";
import SignupScreen from "../../src/screens/SignupScreen";
import PetSetupScreen from "../../src/screens/PetSetupScreen.tsx";
import OnboardingScreen from "../../src/screens/onboarding/OnboardingScreen";
import PetStylizeLoadingScreen from "../screens/PetStylizeLoadingScreen";
import PetStylizeResultScreen from "../screens/PetStylizeResultScreen";
import AppNavigator from "./AppNavigator";
import EnvWarningBanner from "../../src/components/EnvWarningBanner";
import NetworkBlockBanner from "../../src/components/NetworkBlockBanner";
import AuthStatusBanner from "../../src/components/AuthStatusBanner";

const RootStack = createNativeStackNavigator();
const AuthStackNav = createNativeStackNavigator();
const AppStackNav = createNativeStackNavigator();

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator />
      <Text style={styles.splashText}>Loading...</Text>
    </View>
  );
}

/**
 * Shown when the profile cannot be loaded and this device has no memory of whether the user already
 * has a pet. Sending them to pet setup here would make an existing user re-create their pet (R-04).
 */
function UnreachableScreen({ onRetry, onSignOut, retrying }) {
  return (
    <View style={styles.splash}>
      <Text style={styles.unreachableTitle}>Can't reach your garden</Text>
      <Text style={styles.unreachableBody}>
        We couldn't load your profile. Check your connection and try again; nothing has been lost.
      </Text>
      <Pressable style={[styles.retryButton, retrying && styles.retryButtonDisabled]} onPress={onRetry} disabled={retrying}>
        {retrying ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.retryButtonText}>Try again</Text>}
      </Pressable>
      <Pressable style={styles.signOutButton} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Signup" component={SignupScreen} />
    </AuthStackNav.Navigator>
  );
}

function AppStack({ needsPetSetup }) {
  return (
    <AppStackNav.Navigator screenOptions={{ headerShown: false }}>
      {needsPetSetup ? (
        <>
          <AppStackNav.Screen name="Onboarding" component={OnboardingScreen} initialParams={{ mode: "first" }} />
          <AppStackNav.Screen name="PetSetup" component={PetSetupScreen} />
          <AppStackNav.Screen name="PetStylizeLoading" component={PetStylizeLoadingScreen} />
          <AppStackNav.Screen name="PetStylizeResult" component={PetStylizeResultScreen} />
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
  } = useAuth();
  const [retrying, setRetrying] = React.useState(false);
  const hasUser = !!session?.user;
  const gate = deriveAppGate({
    hasUser,
    profileStatus,
    profileHasPet: profile ? !!profile.pet_photo_url : null,
    cachedHasPet,
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

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>{content}</NavigationContainer>
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
    backgroundColor: "#0f172a",
    paddingHorizontal: 28,
  },
  splashText: {
    marginTop: 10,
    color: "rgba(226,232,240,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
  unreachableTitle: {
    color: "#e2e8f0",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  unreachableBody: {
    marginTop: 8,
    color: "rgba(203,213,225,0.9)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    minWidth: 160,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#34d399",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  retryButtonDisabled: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 15,
  },
  signOutButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signOutText: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
});
