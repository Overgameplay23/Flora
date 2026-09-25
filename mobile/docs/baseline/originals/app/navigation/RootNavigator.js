import React from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../../src/contexts/AuthContext";
import LoginScreen from "../../src/screens/LoginScreen";
import SignupScreen from "../../src/screens/SignupScreen";
import PetSetupScreen from "../../src/screens/PetSetupScreen.tsx";
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
  const { session, profile, initializing, authServiceMessage, clearAuthServiceMessage } = useAuth();
  const hasUser = !!session?.user;
  const needsPetSetup = hasUser && !profile?.pet_photo_url;

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        {initializing ? (
          <SplashScreen />
        ) : (
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            {hasUser ? (
              <RootStack.Screen name="AppStack">
                {() => <AppStack needsPetSetup={needsPetSetup} />}
              </RootStack.Screen>
            ) : (
              <RootStack.Screen name="AuthStack" component={AuthStack} />
            )}
          </RootStack.Navigator>
        )}
      </NavigationContainer>
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
  },
  splashText: {
    marginTop: 10,
    color: "rgba(226,232,240,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
});
